import { describe, expect, test } from "bun:test";
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import type { Entry, Observation, Reflection } from "../ledger/index.js";
import observationalMemory from "../index.js";
import { launchConsolidation, type ConsolidationWorkers } from "../consolidation.js";

let observerImpl: (args: Parameters<ConsolidationWorkers["runObserver"]>[0]) => Promise<Observation[] | undefined> = async () => undefined;
let reflectorImpl: (args: Parameters<ConsolidationWorkers["runReflector"]>[0]) => Promise<Reflection[] | undefined> = async () => undefined;
let dropperImpl: (args: Parameters<ConsolidationWorkers["runDropper"]>[0]) => Promise<string[] | undefined> = async () => undefined;
const workers: ConsolidationWorkers = {
	runObserver: (args) => observerImpl(args),
	runReflector: (args) => reflectorImpl(args),
	runDropper: (args) => dropperImpl(args),
};

function observation(id: string, content: string, sourceEntryId: string): Observation {
	return { id, content, timestamp: "2026-09-29 12:00", relevance: "high", sourceEntryIds: [sourceEntryId], tokenCount: 20 };
}

type HostEvent = { willContinue?: boolean };

function harness(entries: Entry[], child = false) {
	const handlers = new Map<string, (event: HostEvent, ctx: ExtensionContext) => void>();
	let snapshot: ((entries: readonly Entry[], ctx: ExtensionContext) => string) | undefined;
	let recall: { name: string; execute: (id: string, params: { id: string }, signal: undefined, update: undefined, ctx: ExtensionContext) => Promise<{ content: Array<{ text: string }>; details: { status?: string; observations?: Array<{ status: string }> } }> } | undefined;
	let leaf = entries.at(-1)?.id ?? null;
	let branch = entries;
	let contextTokens: number | undefined;
	let resolvedModel: unknown;
	const resolvedSpecs: string[] = [];
	const credentialModels: unknown[] = [];
	const pi = {
		on: (name: string, callback: (event: HostEvent, ctx: ExtensionContext) => void) => handlers.set(name, callback),
		registerCompactionSnapshot: (callback: typeof snapshot) => { snapshot = callback; },
		registerTool: (tool: typeof recall) => { recall = tool; },
		appendEntry: (customType: string, data: unknown) => {
			leaf = "record-" + branch.length;
			branch.push({ type: "custom", id: leaf, customType, data });
		},
		typebox: { Type: { Object: (fields: unknown) => fields, String: () => "string" } },
		logger: { error: () => undefined },
	};
	const ctx = {
		model: { id: "fixture", provider: "fixture", contextWindow: 100_000 },
		getContextUsage: () => contextTokens === undefined ? undefined : { tokens: contextTokens },
		modelRegistry: { resolver: (model: unknown) => { credentialModels.push(model); return async () => "not-used"; } },
		models: { resolve: (spec: string) => { resolvedSpecs.push(spec); return resolvedModel; } },
		sessionManager: {
			getEntries: () => child ? [...branch, { type: "session_init", id: "child" }] : branch,
			getBranch: () => branch,
			getSessionId: () => "session-1",
			getLeafId: () => leaf,
		},
	} as unknown as ExtensionContext;
	observationalMemory(pi as unknown as ExtensionAPI, workers);
	return { handlers, snapshot: snapshot!, ctx, recall, entries, pi: pi as unknown as ExtensionAPI, changeLeaf: (id: string) => { leaf = id; }, changeBranch: (next: Entry[]) => { branch = next; leaf = next.at(-1)?.id ?? null; }, setContextTokens: (value: number | undefined) => { contextTokens = value; }, setResolvedModel: (model: unknown) => { resolvedModel = model; }, resolvedSpecs, credentialModels };
}

const source = (id: string, text: string): Entry => ({ type: "message", id, timestamp: "2026-09-29T12:00:00Z", message: { role: "user", content: [{ type: "text", text }], timestamp: Date.parse("2026-09-29T12:00:00Z") } });
const assistantUsage = (id: string, totalTokens: number): Entry => ({ type: "message", id, message: { role: "assistant", content: [{ type: "text", text: "done" }], stopReason: "stop", usage: { totalTokens } } });
const record = (id: string, observations: Observation[], coversUpToId: string): Entry => ({ type: "custom", id, customType: "om.observations.recorded", data: { observations, coversUpToId } });

describe("OMP observational sidecar", () => {
	test("snapshot folds its supplied branch after the latest reset, including the full active pool", () => {
		const old = observation("aaaaaaaaaaaa", "before clear", "source-old");
		const root: Entry[] = [source("source-old", "old evidence"), record("record-old", [old], "source-old")];
		const entries: Entry[] = [...root, { type: "reset_boundary", id: "reset" }, source("source-new", "new evidence")];
		const fresh = Array.from({ length: 36 }, (_, i) => observation(i.toString(16).padStart(12, "0"), `current fact ${i}`, "source-new"));
		entries.push(record("record-new", fresh, "source-new"));
		entries.push({ type: "custom", id: "drop-new", customType: "om.observations.dropped", data: { observationIds: [fresh[5].id], coversUpToId: "source-new" } });
		const sibling: Entry[] = [...root, source("source-sibling", "sibling evidence")];
		const { snapshot, ctx, changeBranch } = harness(entries);
		changeBranch(sibling);
		const text = snapshot(entries, ctx);
		expect(text).toContain("current fact 0");
		expect(text).toContain("current fact 35");
		expect(text).not.toContain("[000000000005]");
		expect(text).not.toContain("before clear");
		expect(text).toContain("observation_recall");
		const siblingText = snapshot(sibling, ctx);
		expect(siblingText).toContain("before clear");
		expect(siblingText).not.toContain("current fact 0");
		const next = observation("bbbbbbbbbbbb", "arrived later", "source-new");
		entries.push(record("record-later", [next], "source-new"));
		expect(snapshot(entries, ctx)).toContain("arrived later");
	});

	test("recalls exact source for dropped and pre-/clear observations without colliding with Mnemopi", async () => {
		const obs = observation("aaaaaaaaaaaa", "superseded summary", "source-old");
		const entries: Entry[] = [source("source-old", "exact old user wording"), record("record-old", [obs], "source-old"), { type: "custom", id: "drop-old", customType: "om.observations.dropped", data: { observationIds: [obs.id], coversUpToId: "source-old" } }, { type: "reset_boundary", id: "reset" }];
		entries.splice(-1, 0, { type: "custom", id: "reflection-old", customType: "om.reflections.recorded", data: { reflections: [{ id: "dddddddddddd", content: "durable insight", supportingObservationIds: [obs.id], tokenCount: 5 }], coversUpToId: "source-old" } });
		const { recall, ctx } = harness(entries);
		expect(recall!.name).toBe("observation_recall");
		const result = await recall!.execute("call", { id: obs.id }, undefined, undefined, ctx);
		expect(result.content[0].text).toContain("exact old user wording");
		expect(result.content[0].text).toContain("[dropped]");
		expect(result.details.observations?.[0]?.status).toBe("dropped");
		const reflection = await recall!.execute("call", { id: "dddddddddddd" }, undefined, undefined, ctx);
		expect(reflection.content[0].text).toContain("durable insight");
		expect(reflection.content[0].text).toContain("superseded summary");
		expect(reflection.content[0].text).toContain("exact old user wording");
		expect((await recall!.execute("call", { id: "invalid" }, undefined, undefined, ctx)).details.status).toBe("invalid_id");
	});

	test("task children return an empty snapshot and do not launch consolidation", () => {
		const obs = observation("cccccccccccc", "parent fact", "source-parent");
		const { handlers, snapshot, ctx, entries } = harness([source("source-parent", "parent"), record("record-parent", [obs], "source-parent")], true);
		expect(snapshot(entries, ctx)).toBe("");
		handlers.get("agent_end")!({ willContinue: false }, ctx);
		expect(entries).toHaveLength(2);
	});

	test("discards detached observer output when the branch leaf changes", async () => {
		let release!: (items: Observation[]) => void;
		let entered!: () => void;
		const started = new Promise<void>((resolve) => { entered = resolve; });
		observerImpl = () => {
			entered();
			return new Promise((resolve) => { release = resolve; });
		};
		try {
			const entries = [source("source-large", "evidence ".repeat(13_000))];
			const { pi, ctx, changeLeaf } = harness(entries);
			const pending = launchConsolidation(pi, ctx, {}, workers);
			await started;
			changeLeaf("other-branch-leaf");
			release([observation("dddddddddddd", "stale result", "source-large")]);
			await pending;
			expect(entries).toHaveLength(1);
		} finally {
			observerImpl = async () => undefined;
		}
	});

	test("own observation append advances expected leaf and permits same-run reflection", async () => {
		observerImpl = async () => [observation("eeeeeeeeeeee", "observed fact", "source-large")];
		reflectorImpl = async () => [{ id: "ffffffffffff", content: "stable conclusion", supportingObservationIds: ["eeeeeeeeeeee"], tokenCount: 20 }];
		try {
			const entries: Entry[] = [source("source-large", "evidence ".repeat(13_000))];
			const { pi, ctx } = harness(entries);
			await launchConsolidation(pi, ctx, {}, workers);
			expect(entries.filter((entry) => entry.customType === "om.observations.recorded")).toHaveLength(1);
			expect(entries.filter((entry) => entry.customType === "om.reflections.recorded")).toHaveLength(1);
		} finally {
			observerImpl = async () => undefined;
			reflectorImpl = async () => undefined;
		}
	});

	test("empty observer waits for another cadence window before retrying", async () => {
		let calls = 0;
		observerImpl = async () => { calls++; return undefined; };
		try {
			const entries: Entry[] = [source("source-first", "evidence ".repeat(6_000))];
			const { pi, ctx, changeLeaf } = harness(entries);
			const state = {};
			await launchConsolidation(pi, ctx, state, workers);
			await launchConsolidation(pi, ctx, state, workers);
			expect(calls).toBe(1);
			entries.push(source("source-second", "more evidence ".repeat(5_000)));
			changeLeaf("source-second");
			await launchConsolidation(pi, ctx, state, workers);
			expect(calls).toBe(2);
		} finally {
			observerImpl = async () => undefined;
		}
	});

	test("same-run reflection can drop pool entries while preserving their recall evidence", async () => {
		const observations = Array.from({ length: 600 }, (_, i) => ({ ...observation(i.toString(16).padStart(12, "0"), "fact " + i + " evidence ".repeat(40), "source-large"), tokenCount: 80 }));
		reflectorImpl = async () => [{ id: "ffffffffffff", content: "durable insight", supportingObservationIds: [observations[0].id], tokenCount: 20 }];
		let dropReflections: Reflection[] | undefined;
		dropperImpl = async (args) => { dropReflections = args.reflections; return [observations[0].id]; };
		try {
			const entries: Entry[] = [source("source-large", "evidence ".repeat(13_000)), record("observation-pool", observations, "source-large")];
			const { pi, ctx, recall } = harness(entries);
			await launchConsolidation(pi, ctx, {}, workers);
			expect(entries.filter((entry) => entry.customType === "om.reflections.recorded")).toHaveLength(1);
			expect(dropReflections?.map((reflection) => reflection.id)).toEqual(["ffffffffffff"]);
			expect(entries.filter((entry) => entry.customType === "om.observations.dropped")).toHaveLength(1);
			const recalled = await recall!.execute("call", { id: observations[0].id }, undefined, undefined, ctx);
			expect(recalled.details.observations?.[0]?.status).toBe("dropped");
			expect(recalled.content[0].text).toContain("evidence evidence");
		} finally {
			reflectorImpl = async () => undefined;
			dropperImpl = async () => undefined;
		}
	});

	test("agent_end does not start detached workers while an automatic continuation is pending", async () => {
		let calls = 0;
		observerImpl = async () => { calls++; return undefined; };
		try {
			const entries: Entry[] = [source("source-large", "evidence ".repeat(13_000))];
			const { handlers, ctx } = harness(entries);
			handlers.get("agent_end")!({ willContinue: true }, ctx);
			await Promise.resolve();
			expect(calls).toBe(0);
			expect(entries).toHaveLength(1);
		} finally {
			observerImpl = async () => undefined;
		}

	});

	test("a sibling turn starts while a stale branch worker remains in flight", async () => {
		const root = source("root", "root");
		const branchA: Entry[] = [root, source("source-a", "evidence ".repeat(13_000))];
		const branchB: Entry[] = [root, source("source-b", "evidence ".repeat(13_000))];
		let calls = 0;
		let releaseA: (value: Observation[] | undefined) => void = () => undefined;
		let startedA: () => void = () => undefined;
		const started = new Promise<void>((resolve) => { startedA = resolve; });
		observerImpl = async () => {
			calls++;
			if (calls === 1) { startedA(); return await new Promise<Observation[] | undefined>((resolve) => { releaseA = resolve; }); }
			return [observation("bbbbbbbbbbbb", "branch B", "source-b")];
		};
		try {
			const { handlers, ctx, changeBranch } = harness(branchA);
			handlers.get("agent_end")!({ willContinue: false }, ctx);
			await started;
			changeBranch(branchB);
			handlers.get("agent_end")!({ willContinue: false }, ctx);
			await Promise.resolve();
			expect(calls).toBe(2);
			releaseA([observation("aaaaaaaaaaaa", "stale branch A", "source-a")]);
			await new Promise<void>((resolve) => setImmediate(resolve));
			expect(branchA.some((entry) => entry.customType === "om.observations.recorded")).toBe(false);
			expect(branchB.some((entry) => entry.customType === "om.observations.recorded")).toBe(true);
		} finally {
			releaseA(undefined);
			observerImpl = async () => undefined;
			await new Promise<void>((resolve) => setImmediate(resolve));
		}
	});

	test("empty observer cooldown follows its ancestor leaf, not a sibling", async () => {
		let calls = 0;
		observerImpl = async () => { calls++; return undefined; };
		try {
			const root = source("root", "root");
			const branchA: Entry[] = [root, source("source-a", "evidence ".repeat(13_000))];
			const { pi, ctx, changeBranch } = harness(branchA);
			const state = {};
			await launchConsolidation(pi, ctx, state, workers);
			await launchConsolidation(pi, ctx, state, workers);
			expect(calls).toBe(1);
			changeBranch([root, source("source-b", "evidence ".repeat(13_000))]);
			await launchConsolidation(pi, ctx, state, workers);
			expect(calls).toBe(2);
		} finally {
			observerImpl = async () => undefined;
		}
	});

	test("reflection cadence starts at the committed record, not its older source coverage", async () => {
		let calls = 0;
		reflectorImpl = async () => { calls++; return [{ id: "ffffffffffff", content: "stable insight", supportingObservationIds: ["aaaaaaaaaaaa"], tokenCount: 10 }]; };
		try {
			const entries: Entry[] = [source("old-source", "old"), assistantUsage("base", 10_000), source("covered", "important"), record("observation-record", [observation("aaaaaaaaaaaa", "fact", "covered")], "covered"), assistantUsage("before-reflection", 30_000)];
			const { pi, ctx, setContextTokens } = harness(entries);
			setContextTokens(30_000);
			await launchConsolidation(pi, ctx, {}, workers);
			expect(calls).toBe(1);
			expect((entries.at(-1)?.data as { coversUpToId?: string }).coversUpToId).toBe("covered");
			setContextTokens(31_000);
			await launchConsolidation(pi, ctx, {}, workers);
			expect(calls).toBe(1);
			setContextTokens(50_000);
			await launchConsolidation(pi, ctx, {}, workers);
			expect(calls).toBe(2);
		} finally {
			reflectorImpl = async () => undefined;
		}
	});

	test("raw reflection fallback counts only sources after its committed record", async () => {
		let calls = 0;
		reflectorImpl = async () => { calls++; return [{ id: "ffffffffffff", content: "stable insight", supportingObservationIds: ["aaaaaaaaaaaa"], tokenCount: 10 }]; };
		try {
			const entries: Entry[] = [source("covered", "small"), record("observation-record", [observation("aaaaaaaaaaaa", "fact", "covered")], "covered"), source("between", "evidence ".repeat(13_000))];
			const { pi, ctx } = harness(entries);
			await launchConsolidation(pi, ctx, {}, workers);
			expect(calls).toBe(1);
			await launchConsolidation(pi, ctx, {}, workers);
			expect(calls).toBe(1);
		} finally {
			reflectorImpl = async () => undefined;
		}
	});

	test("explicit worker model sets source chunk budget and credential model; absent selector uses live model", async () => {
		const chunks: string[] = [];
		const models: unknown[] = [];
		observerImpl = async (args) => {
			chunks.push(args.chunk);
			models.push(args.model);
			args.getApiKey?.(args.model);
			return undefined;
		};
		try {
			const sourceEntry = source("large-source", "evidence ".repeat(13_000));
			const selected = { id: "selected", provider: "fixture", contextWindow: 1_024 };
			const explicit = harness([sourceEntry]);
			explicit.setResolvedModel(selected);
			await launchConsolidation(explicit.pi, explicit.ctx, {}, workers, "fixture/selected");
			expect(explicit.resolvedSpecs).toEqual(["fixture/selected"]);
			expect(models[0]).toBe(selected);
			expect(explicit.credentialModels).toEqual([selected]);
			const live = harness([sourceEntry]);
			await launchConsolidation(live.pi, live.ctx, {}, workers);
			expect(live.resolvedSpecs).toEqual([]);
			expect(models[1]).toBe(live.ctx.model);
			expect(live.credentialModels).toEqual([live.ctx.model]);
			expect(chunks[0].length).toBeLessThan(chunks[1].length);
		} finally { observerImpl = async () => undefined; }
	});

	test("unresolved and empty explicit worker models fail before workers or ledger changes", async () => {
		let calls = 0;
		observerImpl = async () => { calls++; return undefined; };
		try {
			for (const spec of ["fixture/missing", ""]) {
				const entries = [source("large-source", "evidence ".repeat(13_000))];
				const { pi, ctx, resolvedSpecs } = harness(entries);
				await expect(launchConsolidation(pi, ctx, {}, workers, spec)).rejects.toThrow("worker model is unavailable");
				expect(resolvedSpecs).toEqual(spec ? [spec] : []);
				expect(entries).toHaveLength(1);
			}
			expect(calls).toBe(0);
		} finally { observerImpl = async () => undefined; }
	});

	test("empty due reflection still drops an over-target pool and preserves recall evidence", async () => {
		const observations = Array.from({ length: 600 }, (_, i) => ({ ...observation(i.toString(16).padStart(12, "0"), "fact " + i + " evidence ".repeat(40), "source-large"), tokenCount: 80 }));
		let dropReflections: Reflection[] | undefined;
		reflectorImpl = async () => undefined;
		dropperImpl = async (args) => { dropReflections = args.reflections; return [observations[0].id]; };
		try {
			const entries: Entry[] = [source("source-large", "evidence ".repeat(13_000)), record("observation-pool", observations, "source-large")];
			const { pi, ctx, recall } = harness(entries);
			await launchConsolidation(pi, ctx, {}, workers);
			expect(dropReflections).toEqual([]);
			expect(entries.some((entry) => entry.customType === "om.reflections.recorded")).toBe(false);
			expect(entries.some((entry) => entry.customType === "om.observations.dropped")).toBe(true);
			const recalled = await recall!.execute("call", { id: observations[0].id }, undefined, undefined, ctx);
			expect(recalled.details.observations?.[0]?.status).toBe("dropped");
			expect(recalled.content[0].text).toContain("evidence evidence");
		} finally { reflectorImpl = async () => undefined; dropperImpl = async () => undefined; }
	});

	test("failed due reflection still drops eligible observations and rethrows the original error", async () => {
		const observations = Array.from({ length: 600 }, (_, i) => ({ ...observation(i.toString(16).padStart(12, "0"), "fact " + i + " evidence ".repeat(40), "source-large"), tokenCount: 80 }));
		const failure = new Error("reflection failed");
		reflectorImpl = async () => { throw failure; };
		dropperImpl = async () => [observations[0].id];
		try {
			const entries: Entry[] = [source("source-large", "evidence ".repeat(13_000)), record("observation-pool", observations, "source-large")];
			const { pi, ctx, recall } = harness(entries);
			await expect(launchConsolidation(pi, ctx, {}, workers)).rejects.toBe(failure);
			expect(entries.some((entry) => entry.customType === "om.observations.dropped")).toBe(true);
			expect((await recall!.execute("call", { id: observations[0].id }, undefined, undefined, ctx)).details.observations?.[0]?.status).toBe("dropped");
			dropperImpl = async () => { throw new Error("drop failed"); };
			await expect(launchConsolidation(pi, ctx, {}, workers)).rejects.toBe(failure);
		} finally { reflectorImpl = async () => undefined; dropperImpl = async () => undefined; }
	});

	test("stale branch after a due reflection cannot append a drop", async () => {
		const observations = Array.from({ length: 600 }, (_, i) => ({ ...observation(i.toString(16).padStart(12, "0"), "fact " + i + " evidence ".repeat(40), "source-large"), tokenCount: 80 }));
		let release!: (value: Reflection[] | undefined) => void;
		let entered!: () => void;
		const started = new Promise<void>((resolve) => { entered = resolve; });
		reflectorImpl = async () => { entered(); return new Promise((resolve) => { release = resolve; }); };
		let drops = 0;
		dropperImpl = async () => { drops++; return [observations[0].id]; };
		try {
			const entries: Entry[] = [source("source-large", "evidence ".repeat(13_000)), record("observation-pool", observations, "source-large")];
			const { pi, ctx, changeLeaf } = harness(entries);
			const pending = launchConsolidation(pi, ctx, {}, workers);
			await started;
			changeLeaf("other-branch-leaf");
			release(undefined);
			await pending;
			expect(drops).toBe(0);
			expect(entries.some((entry) => entry.customType === "om.observations.dropped")).toBe(false);
		} finally { reflectorImpl = async () => undefined; dropperImpl = async () => undefined; }
	});
});
