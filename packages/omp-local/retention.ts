#!/usr/bin/env bun
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

async function linkedRelease(link: string, dataDir: string): Promise<string | undefined> {
	try {
		return path.resolve(dataDir, await fs.readlink(link));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw error;
	}
}

async function replaceLink(link: string, target: string, dataDir: string): Promise<void> {
	const next = path.join(dataDir, `.link-${randomUUID()}`);
	await fs.symlink(target, next);
	await fs.rename(next, link);
}

function isGone(error: unknown): boolean {
	return (error as NodeJS.ErrnoException).code === "ENOENT" || (error as NodeJS.ErrnoException).code === "ESRCH";
}

async function liveReleases(releasesDir: string): Promise<Set<string>> {
	const names = new Set<string>();
	const prefix = `${releasesDir}${path.sep}`;
	const currentPrefix = `${path.dirname(releasesDir)}${path.sep}current${path.sep}`;
	for (const entry of await fs.readdir("/proc", { withFileTypes: true })) {
		if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
		const proc = path.join("/proc", entry.name);
		let stat;
		try {
			stat = await fs.stat(proc);
		} catch (error) {
			if (isGone(error)) continue;
			throw error;
		}
		if (stat.uid !== process.getuid()) continue;
		let cmdline: string;
		try {
			cmdline = await fs.readFile(path.join(proc, "cmdline"), "utf8");
		} catch (error) {
			if (isGone(error)) continue;
			throw error;
		}
		let maps: string;
		try {
			maps = await fs.readFile(path.join(proc, "maps"), "utf8");
		} catch (error) {
			if (isGone(error)) continue;
			const candidate = cmdline.includes(prefix) || cmdline.includes(currentPrefix) || cmdline.split("\0").some(
				(arg) => /^(?:bun|omp)$/.test(path.basename(arg)) || arg.includes("/omp-local/"),
			);
			if (candidate || (error as NodeJS.ErrnoException).code !== "EACCES") throw error;
			continue;
		}
		let identified = false;
		for (const contents of [cmdline, maps]) {
			let offset = 0;
			while ((offset = contents.indexOf(prefix, offset)) !== -1) {
				const start = offset + prefix.length;
				const name = contents.slice(start).match(/^[^/\s\0]+/)?.[0];
				if (name) names.add(name);
				if (name) identified = true;
				offset = start;
			}
		}
		if (cmdline.includes(currentPrefix) && !identified) {
			throw new Error(`Cannot identify release for live OMP process ${entry.name}`);
		}
	}
	return names;
}

// Caller holds .update.lock and exclusive .retention.lock while inspecting and deleting.
export async function cleanupReleases(dataDir: string): Promise<void> {
	const releasesDir = path.join(dataDir, "releases");
	const current = await linkedRelease(path.join(dataDir, "current"), dataDir);
	const previous = await linkedRelease(path.join(dataDir, "previous"), dataDir);
	const live = await liveReleases(releasesDir);
	const lockDir = path.join(dataDir, "release-locks");
	await fs.mkdir(lockDir, { recursive: true });
	for (const entry of await fs.readdir(releasesDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const release = path.join(releasesDir, entry.name);
		if (release === current || release === previous || live.has(entry.name)) continue;
		const lock = path.join(lockDir, `${entry.name}.lock`);
		const child = Bun.spawn(["flock", "-E", "75", "-n", "-x", lock, "rm", "-rf", "--", release], {
			stdin: "ignore", stdout: "inherit", stderr: "inherit",
		});
		const code = await child.exited;
		if (code === 75) {
			console.log(`Retained live release: ${release}`);
		} else if (code !== 0) {
			throw new Error(`Cleanup failed for ${release}: exit ${code}`);
		} else {
			console.log(`Removed unused release: ${release}`);
		}
	}
}

// Caller holds .update.lock and exclusive .retention.lock through promotion and cleanup.
export async function activateRelease(dataDir: string, stage: string): Promise<void> {
	const currentLink = path.join(dataDir, "current");
	const previousLink = path.join(dataDir, "previous");
	const previous = await linkedRelease(currentLink, dataDir);
	if (previous) await replaceLink(previousLink, previous, dataDir);
	else await fs.rm(previousLink, { force: true });
	await replaceLink(currentLink, stage, dataDir);
	console.log(`Active release: ${stage}`);
	console.log(`Previous release for rollback: ${previous ?? "none"}`);
	await cleanupReleases(dataDir);
}

if (import.meta.main) {
	const [command, stage, dataDirArg, extra] = process.argv.slice(2);
	try {
		if (command !== "activate" || !stage || !dataDirArg || extra) {
			throw new Error("Usage: retention.ts activate STAGE DATA_DIR");
		}
		const dataDir = path.resolve(dataDirArg);
		if (process.env.OMP_LOCAL_RETENTION_LOCKED === "1") {
			await activateRelease(dataDir, stage);
		} else {
			const child = Bun.spawn(["flock", "-x", path.join(dataDir, ".retention.lock"), process.execPath, import.meta.path, ...process.argv.slice(2)], {
				env: { ...process.env, OMP_LOCAL_RETENTION_LOCKED: "1" },
				stdin: "inherit", stdout: "inherit", stderr: "inherit",
			});
			process.exitCode = await child.exited;
		}
	} catch (error) {
		console.error(error);
		process.exitCode = 1;
	}
}
