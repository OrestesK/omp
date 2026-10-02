import { describe, expect, test } from "bun:test";
import type { AgentContext, AgentLoopConfig } from "@oh-my-pi/pi-agent-core";
import type { Model } from "@oh-my-pi/pi-ai";
import { runObserver, ObserverStreamError } from "../workers/observer/agent.js";
import { runReflector } from "../workers/reflector/agent.js";
import { runDropper, selectDropCandidates } from "../workers/dropper/agent.js";
import { reflectionCoverageMap } from "../workers/dropper/coverage.js";
import { observationPoolMetrics } from "../workers/dropper/pool.js";
import type { Observation, Reflection } from "../ledger/index.js";

const model = { id: "test-model", api: "test-api", provider: "test-provider", maxTokens: 2048, reasoning: false } as unknown as Model;
const obs = (id: string, relevance: Observation["relevance"] = "medium", timestamp = "2026-01-01 10:00"): Observation => ({
	id, content: `Observation ${id}`, timestamp, relevance, sourceEntryIds: [`entry-${id}`], tokenCount: 40,
});
const reflection = (id: string, ids: string[]): Reflection => ({ id, content: `Reflection ${id}`, supportingObservationIds: ids, tokenCount: 10 });

type WorkerTool = NonNullable<AgentContext["tools"]>[number];
function fakeLoop(proposals: (tool: WorkerTool, config: AgentLoopConfig, prompt: string) => Promise<void> | void, events: unknown[] = [], resultError?: Error) {
	return ((messages: {content: {text: string}[]}[], context: AgentContext, config: AgentLoopConfig) => ({
		async *[Symbol.asyncIterator]() { await proposals(context.tools![0], config, messages[0].content[0].text); yield* events; },
		async result() { if (resultError) throw resultError; return []; },
	})) as unknown as typeof import("@oh-my-pi/pi-agent-core").agentLoop;
}

const observerArgs = {
	model,
	priorReflections: [],
	priorObservations: [],
	chunk: "[Source entry id: entry-1]\n[User @ 2026-01-01 10:00]: User chose Postgres.",
	allowedSourceEntryIds: ["entry-1", "entry-2"],
};

describe("source-backed worker records", () => {
	test("observer accepts exact cited ids in chunk order while rejecting invented and empty citations", async () => {
		const result = await runObserver({ ...observerArgs, agentLoop: fakeLoop(async (tool) => {
			const receipt = await tool.execute("call", { observations: [
				{ timestamp: "2026-01-01 10:00", content: "User chose Postgres.", relevance: "high", sourceEntryIds: ["entry-2", "entry-1", "entry-2"] },
				{ timestamp: "2026-01-01 10:00", content: "User chose MySQL.", relevance: "high", sourceEntryIds: ["invented"] },
				{ timestamp: "2026-01-01 10:00", content: "No source.", relevance: "low", sourceEntryIds: [] },
			] });
			expect(receipt.details).toMatchObject({ added: 1, rejected: 2 });
		}) });
		expect(result).toHaveLength(1);
		expect(result![0]).toMatchObject({ content: "User chose Postgres.", relevance: "high", sourceEntryIds: ["entry-1", "entry-2"] });
		expect(result![0].tokenCount).toBeGreaterThan(0);
	});

	test("observer distinguishes terminal provider failure from deliberate zero records", async () => {
		const failed = fakeLoop(() => {}, [{ type: "message_end", message: { role: "assistant", stopReason: "error", errorMessage: "auth denied" } }]);
		await expect(runObserver({ ...observerArgs, agentLoop: failed })).rejects.toThrow(ObserverStreamError);
		await expect(runObserver({ ...observerArgs, agentLoop: fakeLoop(() => {}) })).resolves.toBeUndefined();
	});

	for (const stopReason of ["error", "aborted"] as const) {
		test(`observer rejects partial records after terminal provider ${stopReason}`, async () => {
			const failed = fakeLoop(async (tool) => {
				const receipt = await tool.execute("call", { observations: [{
					timestamp: "2026-01-01 10:00", content: "User chose Postgres.", relevance: "high", sourceEntryIds: ["entry-1"],
				}] });
				expect(receipt.details).toMatchObject({ added: 1 });
			}, [{ type: "message_end", message: { role: "assistant", stopReason, errorMessage: "rate limited" } }]);
			await expect(runObserver({ ...observerArgs, agentLoop: failed })).rejects.toThrow(/rate limited/);
		});
		test(`reflector rejects partial support coverage after terminal provider ${stopReason}`, async () => {
			const observations = [obs("a", "high")];
			const failed = fakeLoop(async (tool) => {
				const receipt = await tool.execute("call", { reflections: [{ content: "User chose Postgres.", supportingObservationIds: ["a"] }] });
				expect(receipt.details).toMatchObject({ added: 1 });
			}, [{ type: "message_end", message: { role: "assistant", stopReason, errorMessage: "rate limited" } }]);
			await expect(runReflector({ model, observations, reflections: [], agentLoop: failed })).rejects.toThrow(/rate limited/);
		});
		test(`dropper rejects partial drop proposals after terminal provider ${stopReason}`, async () => {
			const observations = [obs("a", "low")];
			const failed = fakeLoop(async (tool) => {
				const receipt = await tool.execute("call", { ids: ["a"] });
				expect(receipt.details).toMatchObject({ added: 1 });
			}, [{ type: "message_end", message: { role: "assistant", stopReason, errorMessage: "rate limited" } }]);
			await expect(runDropper({ model, observations, reflections: [], targetTokens: 0, agentLoop: failed })).rejects.toThrow(/rate limited/);
		});
	}

	test("raw agent-loop error retains identity after partial tool output", async () => {
		const raw = new Error("provider transport failed");
		const failed = fakeLoop(async (tool) => {
			await tool.execute("call", { observations: [{
				timestamp: "2026-01-01 10:00", content: "User chose Postgres.", relevance: "high", sourceEntryIds: ["entry-1"],
			}] });
		}, [{ type: "message_end", message: { role: "assistant", stopReason: "error", errorMessage: "wrapped" } }], raw);
		await expect(runObserver({ ...observerArgs, agentLoop: failed })).rejects.toBe(raw);
	});

	test("worker config retains host credential resolver and bounds output tokens", async () => {
		const getApiKey = () => "session-credential";
		const injectedStream = (() => { throw new Error("fake loop must not invoke stream"); }) as import("@oh-my-pi/pi-agent-core").StreamFn;
		await runObserver({ ...observerArgs, getApiKey, streamFn: injectedStream, maxOutputTokens: 32000,
			agentLoop: fakeLoop((_tool, config) => {
				expect(config.getApiKey).toBe(getApiKey);
				expect(config.maxTokens).toBe(2048);
			}) });
	});

	test("reflector rejects unsupported ids and records only durable proposals with exact support", async () => {
		const observations = [obs("a"), obs("b", "high")];
		const result = await runReflector({ model, observations, reflections: [], agentLoop: fakeLoop(async (tool, _config, prompt) => {
			expect(prompt).toContain("[coverage: none]");
			const receipt = await tool.execute("call", { reflections: [
				{ content: "User chooses Postgres for persistence.", supportingObservationIds: ["b", "a", "b"] },
				{ content: "Unsupported", supportingObservationIds: ["fabricated"] },
			] });
			expect(receipt.details).toMatchObject({ added: 1, rejected: 1 });
		}) });
		expect(result).toHaveLength(1);
		expect(result![0].supportingObservationIds).toEqual(["a", "b"]);
		expect(result![0].content).toBe("User chooses Postgres for persistence.");
	});
});

describe("coverage-governed pool pruning", () => {
	test("coverage counts unique support per reflection", () => {
		const observations = [obs("a", "high"), obs("b", "critical")];
		const before = reflectionCoverageMap(observations, [reflection("r1", ["a", "a"])]);
		const after = reflectionCoverageMap(observations, [reflection("r1", ["a", "a"]), reflection("r2", ["a", "b"])]);
		expect(before.get("a")).toBe("partial");
		expect(after.get("a")).toBe("strong");
		expect(after.get("b")).toBe("partial");
	});

	test("drop selection favors reflection coverage before relevance, age, and proposal order", () => {
		const observations = [obs("critical", "critical", "2026-01-02 10:00"), obs("low", "low"), obs("partial", "low"), obs("strong", "high")];
		const reflections = [reflection("r1", ["partial", "strong"]), reflection("r2", ["strong"])];
		expect(selectDropCandidates(["critical", "low", "partial", "strong", "unknown", "strong"], observations, 3, reflections)).toEqual(["strong", "partial", "low"]);
	});

	test("dropper returns no proposals at target and filters unknown duplicate ids above target", async () => {
		const observations = [obs("a", "high"), obs("b", "low"), obs("c", "critical")];
		let calls = 0;
		const loop = fakeLoop(async (tool, _config, prompt) => {
			calls++;
			expect(prompt).toContain("Maximum drops allowed this run:");
			await tool.execute("call", { ids: ["unknown", "a", "a", "c", "b"] });
		});
		const total = observationPoolMetrics(observations, 0).observationTokens;
		expect(await runDropper({ model, observations, reflections: [], targetTokens: total, agentLoop: loop })).toBeUndefined();
		expect(calls).toBe(0);
		expect(await runDropper({ model, observations, reflections: [], targetTokens: 0, agentLoop: loop })).toEqual(["b", "a", "c"]);
		expect(calls).toBe(1);
	});
});
