#!/usr/bin/env bun
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { parseArgs } from "node:util";

const packageDir = import.meta.dir;
const dataDir = path.join(os.homedir(), ".local/share/omp-local");
const releasesDir = path.join(dataDir, "releases");
const currentLink = path.join(dataDir, "current");
const codingAgent = "@oh-my-pi/pi-coding-agent";
const npmRegistry = "https://registry.npmjs.org";
const platformTag = `${process.platform}-${process.arch}`;
const usage = `Usage: omp update [--check|-c] [--force|-f] [--version VERSION]
       omp update --plugins|-l
       omp update --help

Stable releases only: without --version, use npm latest; keep the active build if it is already at or above latest.
--check reports current and target without installing; --force rebuilds even the same version.
--version selects and rebuilds a stable X.Y.Z tag; --plugins upgrades plugins without replacing the host.
Unsupported: --canary and --stable are not available in this source-built updater.`;
let stage: string | undefined;

type Manifest = { version: string; dist: { tarball: string } };

async function manifest(pkg: string, version: string): Promise<Manifest> {
	const response = await fetch(`${npmRegistry}/${encodeURIComponent(pkg)}/${version}`);
	if (!response.ok) throw new Error(`npm metadata for ${pkg}@${version}: HTTP ${response.status}`);
	const data: Manifest = await response.json();
	return data;
}

async function sourceVersion(file: string): Promise<string> {
	const data: { version: string } = await Bun.file(file).json();
	return data.version;
}

async function download(url: string, destination: string): Promise<void> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Download ${url}: HTTP ${response.status}`);
	await Bun.write(destination, response);
}

async function run(command: string[], cwd: string): Promise<void> {
	console.log(`+ ${command.join(" ")}`);
	const proc = Bun.spawn(command, { cwd, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
	const code = await proc.exited;
	if (code !== 0) throw new Error(`${command[0]} exited ${code}`);
}

async function activeRelease(): Promise<string | undefined> {
	try {
		const target = await fs.readlink(currentLink);
		return path.resolve(dataDir, target);
	} catch (error) {
		const fsError = error as NodeJS.ErrnoException;
		if (fsError.code === "ENOENT") return undefined;
		throw error;
	}
}

function parse(args: string[]) {
	const { values } = parseArgs({
		args,
		strict: true,
		allowPositionals: false,
		options: {
			check: { type: "boolean", short: "c" },
			force: { type: "boolean", short: "f" },
			version: { type: "string" },
			plugins: { type: "boolean", short: "l" },
			help: { type: "boolean" },
		},
	});
	if (values.help) {
		if (args.length !== 1) throw new Error(usage);
		return values;
	}
	if (values.version !== undefined && !/^\d+\.\d+\.\d+$/.test(values.version)) throw new Error(usage);
	if (values.plugins && args.length !== 1) throw new Error(usage);
	return values;
}

async function main(): Promise<void> {
	const options = parse(process.argv.slice(2));
	if (options.help) {
		console.log(usage);
		return;
	}
	const previous = await activeRelease();
	if (options.plugins) {
		if (!previous) throw new Error("No active local release for plugin upgrade");
		await run(["bun", path.join(currentLink, "packages/coding-agent/dist/cli.js"), "update", "--plugins"], process.cwd());
		return;
	}

	const version = options.version ?? (await manifest(codingAgent, "latest")).version;
	const currentVersion = previous ? await sourceVersion(path.join(previous, "packages/coding-agent/package.json")) : undefined;
	console.log(`Current: ${currentVersion ?? "none"}; target: ${version}`);
	if (options.check) return;
	if (currentVersion !== undefined && Bun.semver.order(currentVersion, version) >= 0 && !options.force && options.version === undefined) {
		console.log("Already up to date; use --force to rebuild the latest version.");
		return;
	}

	await fs.mkdir(releasesDir, { recursive: true });
	stage = await fs.mkdtemp(path.join(releasesDir, `v${version}-`));
	console.log(`Staging ${version} at ${stage}`);
	const sourceArchive = path.join(stage, ".source.tar.gz");
	await download(`https://github.com/can1357/oh-my-pi/archive/refs/tags/v${version}.tar.gz`, sourceArchive);
	await run(["tar", "-xzf", sourceArchive, "--strip-components=1", "-C", stage], stage);
	await fs.unlink(sourceArchive);

	const stagedVersion = await sourceVersion(path.join(stage, "packages/coding-agent/package.json"));
	if (stagedVersion !== version) throw new Error(`Source version ${stagedVersion} does not match ${version}`);
	const { patches } = await Bun.file(path.join(packageDir, "patches.json")).json();
	for (const patch of patches) {
		const filename = path.join(packageDir, patch);
		const args = ["patch", "--batch", "--forward", "--fuzz=0", "-p1", "-i", filename];
		await run(args, stage);
	}

	await run(["bun", "install", "--frozen-lockfile"], stage);
	const leaf = `@oh-my-pi/pi-natives-${platformTag}`;
	const nativeArchive = path.join(stage, ".native.tar.gz");
	const nativePackage = path.join(stage, ".native-package");
	await fs.mkdir(nativePackage);
	await download((await manifest(leaf, version)).dist.tarball, nativeArchive);
	await run(["tar", "-xzf", nativeArchive, "--strip-components=1", "-C", nativePackage], stage);
	const nativeDir = path.join(stage, "packages/natives/native");
	const names = process.arch === "x64"
		? [`pi_natives.${platformTag}-baseline.node`, `pi_natives.${platformTag}-modern.node`]
		: [`pi_natives.${platformTag}.node`];
	for (const name of names) await fs.copyFile(path.join(nativePackage, name), path.join(nativeDir, name));
	await fs.rm(nativePackage, { recursive: true });
	await fs.unlink(nativeArchive);

	await run(["bun", "--cwd=packages/coding-agent", "run", "gen:bundle"], stage);
	await run([
		"bun", "test",
		"packages/coding-agent/test/agent-session-handoff.test.ts",
		"packages/coding-agent/test/agent-session-auto-compaction-progress-guard.test.ts",
		"packages/coding-agent/test/agent-session-anthropic-native-compaction.test.ts",
		"packages/coding-agent/test/agent-session-compaction-cancellation.test.ts",
		"packages/coding-agent/test/agent-session-openai-responses-replay.test.ts",
		"packages/coding-agent/test/eval/process-entry-import.test.ts",
		"packages/coding-agent/test/worker-selector.test.ts",
		"packages/tui/test/mermaid-cache.test.ts",
		"packages/tui/test/write-figure.test.ts",
	], stage);
	await run(["env", `OMP_LOCAL_SOURCE=${stage}`, "bun", "test", path.join(packageDir, "smoke/memory.test.ts")], stage);
	await run(["bun", path.join(stage, "packages/coding-agent/dist/cli.js"), "--version"], stage);
	const smokeRoot = path.join(os.homedir(), "tmp");
	await fs.mkdir(smokeRoot, { recursive: true });
	const smokeDir = await fs.mkdtemp(path.join(smokeRoot, "omp-smoke-"));
	for (const dir of ["home", "tmp", "config", "state", "cache"]) await fs.mkdir(path.join(smokeDir, dir));
	console.log(`Smoke sandbox: ${smokeDir} (retained if the check fails)`);
	await run([
		"env", "-i",
		`PATH=${path.dirname(process.execPath)}:/usr/bin:/bin`,
		`HOME=${path.join(smokeDir, "home")}`,
		`TMPDIR=${path.join(smokeDir, "tmp")}`,
		`XDG_CONFIG_HOME=${path.join(smokeDir, "config")}`,
		`XDG_STATE_HOME=${path.join(smokeDir, "state")}`,
		`XDG_CACHE_HOME=${path.join(smokeDir, "cache")}`,
		process.execPath, path.join(stage, "packages/coding-agent/dist/cli.js"), "--smoke-test",
	], stage);
	await fs.rm(smokeDir, { recursive: true });

	await run([process.execPath, path.join(packageDir, "retention.ts"), "activate", stage, dataDir], process.cwd());
}

try {
	await fs.mkdir(dataDir, { recursive: true });
	if (process.env.OMP_LOCAL_UPDATE_LOCKED === "1") {
		await main();
	} else {
		const child = Bun.spawn(["flock", "-x", path.join(dataDir, ".update.lock"), process.execPath, import.meta.path, ...process.argv.slice(2)], {
			env: { ...process.env, OMP_LOCAL_UPDATE_LOCKED: "1" },
			stdin: "inherit", stdout: "inherit", stderr: "inherit",
		});
		process.exitCode = await child.exited;
	}
} catch (error) {
	console.error(error);
	if (stage) console.error(`Stage remains at ${stage}`);
	process.exitCode = 1;
}
