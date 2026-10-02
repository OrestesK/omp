import { expect, test } from "bun:test";
import type { StreamFn } from "@oh-my-pi/pi-agent-core";
import { AssistantMessageEventStream } from "@oh-my-pi/pi-ai";
import type { AssistantMessage } from "@oh-my-pi/pi-ai";
import { getBundledModel } from "@oh-my-pi/pi-catalog";
import { runObserver } from "../workers/observer/agent.js";
import { runReflector } from "../workers/reflector/agent.js";
import { runDropper } from "../workers/dropper/agent.js";

const model = getBundledModel("openai", "codex-mini-latest");
const usage: AssistantMessage["usage"] = {
	input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

/** This stream supplies provider-shaped turns without a network or credential lookup. */
function streamMessage(message: AssistantMessage): AssistantMessageEventStream {
	const stream = new AssistantMessageEventStream();
	stream.push({ type: "start", partial: message });
	for (let index = 0; index < message.content.length; index++) {
		const block = message.content[index];
		if (block.type === "toolCall") {
			stream.push({ type: "toolcall_start", contentIndex: index, partial: message });
			stream.push({ type: "toolcall_end", contentIndex: index, toolCall: block, partial: message });
		}
	}
	stream.push({ type: "done", reason: message.stopReason as "stop" | "toolUse", message });
	stream.end(message);
	return stream;
}

test("explicit thinking off disables reasoning on the provider request", async () => {
	let requests = 0;
	const result = await runObserver({
		model, priorReflections: [], priorObservations: [],
		chunk: "[Source entry id: entry-1]\n[User @ 2026-01-01 10:00]: A routine greeting.",
		allowedSourceEntryIds: ["entry-1"], thinkingLevel: "off",
		getApiKey: () => undefined,
		streamFn: (_model, _context, options) => {
			requests++;
			expect(options?.disableReasoning).toBe(true);
			return streamMessage({ role: "assistant", api: model.api, provider: model.provider, model: model.id,
				content: [{ type: "text", text: "Nothing new." }], usage, stopReason: "stop", timestamp: Date.now() });
		},
	});
	expect(result).toBeUndefined();
	expect(requests).toBe(1);
});

test("native agentLoop executes source-backed observer tool through injected stream and host auth", async () => {
	let requests = 0;
	let authCalls = 0;
	const seenKeys: unknown[] = [];
	const seenEfforts: unknown[] = [];
	const result = await runObserver({
		model,
		priorReflections: [], priorObservations: [],
		chunk: "[Source entry id: entry-1]\n[User @ 2026-01-01 10:00]: User chose Postgres.",
		allowedSourceEntryIds: ["entry-1"],
		getApiKey: () => { authCalls++; return "fixture-key"; },
		streamFn: (_model, _context, options) => {
			requests++;
			seenKeys.push(options?.apiKey);
			seenEfforts.push(options?.reasoning);
			const content: AssistantMessage["content"] = requests === 1
				? [{ type: "toolCall", id: "call-1", name: "record_observations", arguments: {
					observations: [{ timestamp: "2026-01-01 10:00", relevance: "high", content: "User chose Postgres.", sourceEntryIds: ["entry-1"] }],
				} }]
				: [{ type: "text", text: "Done." }];
			const message: AssistantMessage = {
				role: "assistant", api: model.api, provider: model.provider, model: model.id,
				content, usage, stopReason: requests === 1 ? "toolUse" : "stop", timestamp: Date.now(),
			};
			return streamMessage(message);
		},
	});
	expect(result).toHaveLength(1);
	expect(result![0]).toMatchObject({ content: "User chose Postgres.", sourceEntryIds: ["entry-1"] });
	expect(requests).toBe(2);
	expect(authCalls).toBe(2);
	expect(seenKeys).toEqual(["fixture-key", "fixture-key"]);
	expect(seenEfforts).toEqual(["low", "low"]);
});

const observation = { id: "a", content: "User chose Postgres.", timestamp: "2026-01-01 10:00", relevance: "high" as const, sourceEntryIds: ["entry-1"], tokenCount: 40 };

const workers = [
	{
		name: "observer",
		toolName: "record_observations",
		toolArgs: (turn: number) => ({ observations: [{ timestamp: "2026-01-01 10:00", relevance: "high", content: `Observation ${turn}`, sourceEntryIds: ["entry-1"] }] }),
		run: (streamFn: StreamFn) => runObserver({ model, priorReflections: [], priorObservations: [], chunk: "[Source entry id: entry-1]\n[User @ 2026-01-01 10:00]: User chose Postgres.", allowedSourceEntryIds: ["entry-1"], maxTurns: 16, streamFn }),
		check: (result: unknown) => { expect(result).toHaveLength(15); expect(result).toEqual(expect.arrayContaining([expect.objectContaining({ content: "Observation 1", sourceEntryIds: ["entry-1"] })])); },
	},
	{
		name: "reflector",
		toolName: "record_reflections",
		toolArgs: (turn: number) => ({ reflections: [{ content: `Reflection ${turn}`, supportingObservationIds: ["a"] }] }),
		run: (streamFn: StreamFn) => runReflector({ model, observations: [observation], reflections: [], maxTurns: 16, streamFn }),
		check: (result: unknown) => { expect(result).toHaveLength(15); expect(result).toEqual(expect.arrayContaining([expect.objectContaining({ content: "Reflection 1", supportingObservationIds: ["a"] })])); },
	},
	{
		name: "dropper",
		toolName: "drop_observations",
		toolArgs: (_turn: number) => ({ ids: ["a"] }),
		run: (streamFn: StreamFn) => runDropper({ model, observations: [observation], reflections: [], targetTokens: 0, maxTurns: 16, streamFn }),
		check: (result: unknown) => { expect(result).toEqual(["a"]); },
	},
];

for (const worker of workers) {
	for (const terminalAt of [16, undefined] as const) {
		test(`${worker.name} ${terminalAt === 16 ? "accepts a clean terminal on model call 16" : "rejects partial records when call 17 is refused"}`, async () => {
			let requests = 0;
			const streamFn: StreamFn = () => {
				requests++;
				const terminal = requests === terminalAt;
				const content: AssistantMessage["content"] = terminal
					? [{ type: "text", text: "Done." }]
					: [{ type: "toolCall", id: `call-${requests}`, name: worker.toolName, arguments: worker.toolArgs(requests) }];
				return streamMessage({ role: "assistant", api: model.api, provider: model.provider, model: model.id,
					content, usage, stopReason: terminal ? "stop" : "toolUse", timestamp: Date.now() });
			};
			if (terminalAt === undefined) await expect(worker.run(streamFn)).rejects.toThrow(/model-call limit \(16\)/);
			else worker.check(await worker.run(streamFn));
			expect(requests).toBe(16);
		});
	}
}
