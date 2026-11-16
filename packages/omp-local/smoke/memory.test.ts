import { afterAll, expect, test, vi } from "bun:test";
import * as path from "node:path";
import observationalMemory from "../../../extensions/observational-memory/index.ts";

const sourceRoot = process.env.OMP_LOCAL_SOURCE;
if (!sourceRoot) throw new Error("OMP_LOCAL_SOURCE must name the staged OMP monorepo root");
const sourceEntry = path.join(sourceRoot, "packages/coding-agent/src/cli.ts");
const staged = (specifier: string) => import(Bun.resolveSync(specifier, sourceEntry));
const { Agent } = await staged("@oh-my-pi/pi-agent-core");
const compactionModule = await staged("@oh-my-pi/pi-agent-core/compaction");
const { getBundledModels } = await staged("@oh-my-pi/pi-catalog/models");
const { ModelRegistry } = await staged("@oh-my-pi/pi-coding-agent/config/model-registry");
const { Settings } = await staged("@oh-my-pi/pi-coding-agent/config/settings");
const { ExtensionRunner, loadExtensionFromFactory, loadExtensions } = await staged("@oh-my-pi/pi-coding-agent/extensibility/extensions");
const { AgentSession } = await staged("@oh-my-pi/pi-coding-agent/session/agent-session");
const { AuthStorage } = await staged("@oh-my-pi/pi-coding-agent/session/auth-storage");
const { handoffHistoryWithoutFrozenExtensionSnapshots } = await staged("@oh-my-pi/pi-coding-agent/session/session-context");
const { SessionManager } = await staged("@oh-my-pi/pi-coding-agent/session/session-manager");
const { SessionMaintenance } = await staged("@oh-my-pi/pi-coding-agent/session/session-maintenance");
const { EventBus } = await staged("@oh-my-pi/pi-coding-agent/utils/event-bus");
const { TempDir } = await staged("@oh-my-pi/pi-utils");

const temp = TempDir.createSync("@om-staged-host-smoke-");
const auth = await AuthStorage.create(`${temp.path()}/auth.db`);
auth.keys.setRuntime("anthropic", "smoke-key-never-sent");
const modelRegistry = new ModelRegistry(auth);
const model = getBundledModels("anthropic")[0];
if (!model) throw new Error("No bundled Anthropic model");
let session: InstanceType<typeof AgentSession> | undefined;
afterAll(async () => {
	vi.restoreAllMocks();
	await session?.dispose();
	auth.close();
	await temp.remove();
});

test("real extension snapshot registration, handoff commit, replay, resume, suspension, branch isolation and recall", async () => {
	const manager = SessionManager.create(temp.path(), temp.path());
	const sourceId = manager.appendMessage({ role: "user", content: [{ type: "text", text: "source witness ALPHA" }], timestamp: Date.now() - 2 });
	manager.appendMessage({
		role: "assistant", content: [{ type: "text", text: "ack" }], api: model.api, provider: model.provider,
		model: model.id, stopReason: "stop", usage: {
			input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		}, timestamp: Date.now() - 1,
	});
	const observationId = "abcdef123456";
	manager.appendCustomEntry("om.observations.recorded", {
		observations: [{ id: observationId, content: "Observation ALPHA", timestamp: "2026-10-14 12:00", relevance: "high", sourceEntryIds: [sourceId], tokenCount: 20 }],
		coversUpToId: sourceId,
	});
	const loaded = await loadExtensions([], temp.path());
	const extension = await loadExtensionFromFactory(observationalMemory, temp.path(), new EventBus(), loaded.runtime, "observational-memory-smoke");
	const runner = new ExtensionRunner([extension], loaded.runtime, temp.path(), manager, modelRegistry);
	const path = extension.path;
	const snapshot = runner.captureCompactionSnapshots(manager.getBranch());
	expect(snapshot?.[path]).toContain("Observation ALPHA");
	expect(runner.getActiveExtensionPaths().has(path)).toBe(true);
	const tool = extension.tools.get("observation_recall");
	if (!tool) throw new Error("Real extension did not register observation_recall");
	const recall = await tool.definition.execute("smoke-recall", { id: observationId }, undefined, undefined, runner.createContext());
	expect(JSON.stringify(recall)).toContain("source witness ALPHA");

	const agent = new Agent({ initialState: { model, systemPrompt: ["Smoke"], tools: [], messages: [] } });
	session = new AgentSession({ agent, sessionManager: manager, extensionRunner: runner, modelRegistry,
		settings: Settings.isolated({ "compaction.enabled": true, "compaction.autoContinue": false, "compaction.asyncEnabled": false, "compaction.keepRecentTokens": 1 }) });
	vi.spyOn(compactionModule, "generateHandoffFromContext").mockResolvedValue("## Goal\nContinue after snapshot");
	const result = await session.handoff();
	expect(result?.document).toContain("Continue after snapshot");
	const committed = manager.getBranch().at(-1);
	if (committed?.type !== "compaction") throw new Error("Handoff did not commit a compaction entry");
	expect(committed.method).toBe("handoff");
	expect(committed.extensionSnapshots?.[path]).toBe(snapshot?.[path]);
	const projected = manager.buildSessionContext({ activeExtensionPaths: runner.getActiveExtensionPaths() });
	expect(JSON.stringify(projected.messages)).toContain("Observation ALPHA");
	expect(JSON.stringify(manager.buildSessionContext({ transcript: true, activeExtensionPaths: runner.getActiveExtensionPaths() }).messages)).not.toContain("Observation ALPHA");
	expect(JSON.stringify(handoffHistoryWithoutFrozenExtensionSnapshots(projected.messages))).not.toContain("Observation ALPHA");

	const reopened = await SessionManager.open(manager.getSessionFile()!, temp.path());
	expect(reopened.getBranch().at(-1)).toMatchObject({ type: "compaction", extensionSnapshots: { [path]: snapshot?.[path] } });
	expect(JSON.stringify(reopened.buildSessionContext({ activeExtensionPaths: runner.getActiveExtensionPaths() }).messages)).toContain("Observation ALPHA");
	await reopened.close();

	runner.setSuspendedExtensions(() => true);
	expect(JSON.stringify(manager.buildSessionContext({ activeExtensionPaths: runner.getActiveExtensionPaths() }).messages)).not.toContain("Observation ALPHA");
	runner.setSuspendedExtensions(() => false);
	expect(JSON.stringify(manager.buildSessionContext({ activeExtensionPaths: runner.getActiveExtensionPaths() }).messages)).toContain("Observation ALPHA");
	manager.branch(sourceId);
	manager.appendMessage({ role: "user", content: [{ type: "text", text: "sibling BETA" }], timestamp: Date.now() });
	expect(JSON.stringify(manager.buildSessionContext({ activeExtensionPaths: runner.getActiveExtensionPaths() }).messages)).not.toContain("Observation ALPHA");
	const siblingRecall = await tool.definition.execute("smoke-recall-sibling", { id: observationId }, undefined, undefined, runner.createContext());
	expect(siblingRecall.details.status).toBe("not_found");
});

test("Codex native remote history projects frozen observations request-only without changing persisted ciphertext", async () => {
	const manager = SessionManager.inMemory(temp.path());
	const sourceId = manager.appendMessage({ role: "user", content: [{ type: "text", text: "remote source" }], timestamp: Date.now() });
	manager.appendCustomEntry("om.observations.recorded", {
		observations: [{ id: "123456abcdef", content: "Codex observation", timestamp: "2026-10-14 12:00", relevance: "high", sourceEntryIds: [sourceId], tokenCount: 20 }], coversUpToId: sourceId,
	});
	const loaded = await loadExtensions([], temp.path());
	const extension = await loadExtensionFromFactory(observationalMemory, temp.path(), new EventBus(), loaded.runtime, "observational-memory-codex-smoke");
	const runner = new ExtensionRunner([extension], loaded.runtime, temp.path(), manager, modelRegistry);
	const snapshots = runner.captureCompactionSnapshots(manager.getBranch());
	const persistedHistory = [
		{ type: "message", role: "user", content: [{ type: "input_text", text: "retained native" }] },
		{ type: "compaction", encrypted_content: "opaque-ciphertext" },
	];
	manager.appendCompaction("remote summary", undefined, "", 100, {
		method: "remote", extensionSnapshots: snapshots,
		preserveData: { openaiRemoteCompaction: { provider: "openai-codex", replacementHistory: persistedHistory } },
	});
	const entry = manager.getBranch().at(-1);
	if (entry?.type !== "compaction") throw new Error("Remote compaction not persisted");
	expect(entry.extensionSnapshots).toEqual(snapshots);
	expect((entry.preserveData?.openaiRemoteCompaction as { replacementHistory: unknown[] }).replacementHistory).toEqual(persistedHistory);
	const head = manager.buildSessionContext({ activeExtensionPaths: runner.getActiveExtensionPaths() }).messages[0];
	if (head?.role !== "compactionSummary" || head.providerPayload?.type !== "openaiResponsesHistory") throw new Error("No Codex replay payload");
	expect(head.providerPayload.items.map(item => item.type)).toEqual(["compaction", "message", "message"]);
	expect(JSON.stringify(head.providerPayload.items[1])).toContain("Codex observation");
	expect(JSON.stringify(handoffHistoryWithoutFrozenExtensionSnapshots([head]))).not.toContain("Codex observation");
	expect((entry.preserveData?.openaiRemoteCompaction as { replacementHistory: unknown[] }).replacementHistory).toEqual(persistedHistory);
});

test("manual remote method captures real extension snapshot at successful commit without provider calls", async () => {
	const manager = SessionManager.inMemory(temp.path());
	const sourceId = manager.appendMessage({ role: "user", content: [{ type: "text", text: "remote commit source" }], timestamp: Date.now() - 2 });
	manager.appendMessage({ role: "assistant", content: [{ type: "text", text: "ack" }], api: model.api, provider: model.provider, model: model.id, stopReason: "stop",
		usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, timestamp: Date.now() - 1 });
	manager.appendCustomEntry("om.observations.recorded", {
		observations: [{ id: "bbbbaaaa1234", content: "Remote committed memory", timestamp: "2026-10-14 12:00", relevance: "high", sourceEntryIds: [sourceId], tokenCount: 20 }], coversUpToId: sourceId,
	});
	const loaded = await loadExtensions([], temp.path());
	const extension = await loadExtensionFromFactory(observationalMemory, temp.path(), new EventBus(), loaded.runtime, "observational-memory-remote-commit");
	const runner = new ExtensionRunner([extension], loaded.runtime, temp.path(), manager, modelRegistry);
	const agent = new Agent({ initialState: { model, systemPrompt: ["Smoke"], tools: [], messages: [] } });
	const localSession = new AgentSession({ agent, sessionManager: manager, extensionRunner: runner, modelRegistry, settings: Settings.isolated({
		"compaction.enabled": true, "compaction.methodOrder": ["remote"], "compaction.remoteEndpoint": "https://example.invalid/never-called", "compaction.keepRecentTokens": 1,
	}) });
	const compactSpy = vi.spyOn(compactionModule, "compact").mockResolvedValue({ summary: "remote summary", shortSummary: undefined, firstKeptEntryId: "", tokensBefore: 100, details: {} });
	try {
		await localSession.compact();
		const entry = manager.getBranch().at(-1);
		if (entry?.type !== "compaction") throw new Error("Remote method did not commit");
		expect(entry.method).toBe("remote");
		expect(entry.extensionSnapshots?.[extension.path]).toContain("Remote committed memory");
		expect(JSON.stringify(manager.buildSessionContext({ activeExtensionPaths: runner.getActiveExtensionPaths() }).messages)).toContain("Remote committed memory");
	} finally {
		compactSpy.mockRestore();
		await localSession.dispose();
	}
});

test("signed Anthropic retained tail stays adjacent while frozen observation follows its tool results", async () => {
	const signedModel = getBundledModels("anthropic").find(candidate => candidate.id === "claude-sonnet-4-6");
	if (!signedModel) throw new Error("No native-compaction Anthropic model");
	const manager = SessionManager.inMemory(temp.path());
	const sourceId = manager.appendMessage({ role: "user", content: [{ type: "text", text: "signed source" }], timestamp: Date.now() - 2_000 });
	manager.appendCustomEntry("om.observations.recorded", {
		observations: [{ id: "aaaabbbb1234", content: "Signed observation", timestamp: "2026-10-14 12:00", relevance: "high", sourceEntryIds: [sourceId], tokenCount: 4 }],
		coversUpToId: sourceId,
	});
	const loaded = await loadExtensions([], temp.path());
	const extension = await loadExtensionFromFactory(observationalMemory, temp.path(), new EventBus(), loaded.runtime, "observational-memory-signed-tail");
	const runner = new ExtensionRunner([extension], loaded.runtime, temp.path(), manager, modelRegistry);
	const assistantTimestamp = Date.now() - 1_000;
	const retainedId = manager.appendMessage({
		role: "assistant",
		content: [
			{ type: "thinking", thinking: "signed reasoning", thinkingSignature: "signed-tail-signature" },
			{ type: "toolCall", id: "signed-tool", name: "read", arguments: { path: "source.txt" } },
		],
		api: signedModel.api, provider: signedModel.provider, model: signedModel.id, stopReason: "toolUse",
		usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
		timestamp: assistantTimestamp,
	});
	manager.appendMessage({ role: "toolResult", toolCallId: "signed-tool", toolName: "read", content: [{ type: "text", text: "signed tool result" }], isError: false, timestamp: Date.now() - 500 });
	const snapshots = runner.captureCompactionSnapshots(manager.getBranch());
	manager.appendCompaction("native signed summary", undefined, retainedId, 100, {
		method: "remote",
		extensionSnapshots: snapshots,
		preserveData: { anthropicCompaction: { provider: "anthropic", content: "native signed summary", signature: "compaction-signature", exactTail: true } },
	});
	manager.appendMessage({ role: "user", content: [{ type: "text", text: "later request" }], timestamp: Date.now() });
	const context = manager.buildSessionContext({ activeExtensionPaths: runner.getActiveExtensionPaths(), model: signedModel });
	expect(context.messages.map(message => message.role)).toEqual(["compactionSummary", "assistant", "toolResult", "user", "user"]);
	expect(context.messages[0]).toMatchObject({ providerPayload: { type: "anthropicCompaction", signature: "compaction-signature" } });
	expect(context.messages[0]?.historyRewriteAt).toBeLessThan(assistantTimestamp);
	expect(context.messages[1]?.content[0]).toMatchObject({ thinkingSignature: "signed-tail-signature" });
	expect(context.messages[2]).toMatchObject({ content: [{ text: "signed tool result" }] });
	expect(context.messages[3]).toMatchObject({ content: [{ text: expect.stringContaining("Signed observation") }] });
	expect(JSON.stringify(handoffHistoryWithoutFrozenExtensionSnapshots(context.messages))).toContain("signed-tail-signature");
	expect(context.messages[4]).toMatchObject({ content: [{ text: "later request" }] });
	expect(JSON.stringify(handoffHistoryWithoutFrozenExtensionSnapshots(context.messages))).not.toContain("Signed observation");
});

test("rejected speculative handoff discards its captured observation instead of committing stale memory", async () => {
	const speculationModel = { ...model, contextWindow: 20_000 };
	const manager = SessionManager.inMemory(temp.path());
	const sourceId = manager.appendMessage({ role: "user", content: [{ type: "text", text: "conversation ".repeat(3_000) }], timestamp: Date.now() - 2 });
	manager.appendMessage({
		role: "assistant", content: [{ type: "text", text: "ack" }], api: speculationModel.api, provider: speculationModel.provider,
		model: speculationModel.id, stopReason: "stop", usage: {
			input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		}, timestamp: Date.now() - 1,
	});
	manager.appendMessage({ role: "user", content: [{ type: "text", text: "follow-up" }], timestamp: Date.now() });
	manager.appendMessage({
		role: "assistant", content: [{ type: "text", text: "final reply" }], api: speculationModel.api, provider: speculationModel.provider,
		model: speculationModel.id, stopReason: "stop", usage: {
			input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		}, timestamp: Date.now(),
	});
	manager.appendCustomEntry("om.observations.recorded", {
		observations: [{ id: "ccccdddd1234", content: "memory ".repeat(18_000), timestamp: "2026-10-14 12:00", relevance: "high", sourceEntryIds: [sourceId], tokenCount: 18_000 }],
		coversUpToId: sourceId,
	});
	const loaded = await loadExtensions([], temp.path());
	const extension = await loadExtensionFromFactory(observationalMemory, temp.path(), new EventBus(), loaded.runtime, "observational-memory-speculation");
	const runner = new ExtensionRunner([extension], loaded.runtime, temp.path(), manager, modelRegistry);
	const capture = vi.spyOn(runner, "captureCompactionSnapshots");
	const agent = new Agent({ initialState: { model: speculationModel, systemPrompt: ["Smoke"], tools: [], messages: [] } });
	const settings = Settings.isolated({
		"compaction.enabled": true, "compaction.asyncEnabled": true, "compaction.methodOrder": ["handoff"],
		"compaction.thresholdPercent": 50, "compaction.keepRecentTokens": 1, "compaction.autoContinue": false,
		"compaction.experimentalContextManagement": false,
	});
	const generateHandoffDocument = vi.fn().mockResolvedValueOnce({ document: "## Goal\nArmed handoff" }).mockResolvedValue(undefined);
	const host = {
		agent, sessionManager: manager, settings, modelRegistry, extensionRunner: runner,
		sideStreamFn: async () => { throw new Error("Unexpected provider request"); },
		providerSessionState: new Map(), preferWebsockets: () => undefined,
		model: () => speculationModel, thinkingLevel: () => undefined,
		isDisposed: () => false, isStreaming: () => false, isGeneratingHandoff: () => false,
		promptGeneration: () => 0, hasExperimentalContextRolloverTools: () => true,
		queueExperimentalContextNotesReminder: () => {},
		sessionId: () => manager.getSessionId(), messages: () => agent.state.messages,
		baseSystemPrompt: () => ["Smoke"], goalModeState: () => undefined,
		planReferencePath: () => "", nonMessageTokenSource: () => ({}),
		memoryBackendSession: () => undefined, emitSessionEvent: async () => {},
		emitNotice: () => {}, scheduleAgentContinue: () => {},
		scheduleCompactionContinuation: () => false,
		persistTurnMessagesForMidRunCompaction: async () => false,
		findLastAssistantMessage: () => undefined,
		disconnectFromAgent: () => {}, reconnectToAgent: () => {},
		drainStrandedQueuedMessages: () => {},
		buildDisplaySessionContext: () => manager.buildSessionContext({ activeExtensionPaths: runner.getActiveExtensionPaths(), model: speculationModel }),
		replaceMessagesFromSessionContext: (messages: unknown[]) => agent.replaceMessages(messages),
		persistEvalStateContext: () => {},
		convertToLlmForSideRequest: (messages: unknown[]) => messages,
		buildLiveProviderContext: async () => ({ messages: [] }),
		obfuscateTextForProvider: (text: string | undefined) => text,
		obfuscatePreparationForProvider: <T>(preparation: T) => preparation,
		getPromptCacheKeyForModel: () => undefined,
		closeCodexProviderSessionsForHistoryRewrite: () => {},
		resetCodexProviderAfterCompaction: () => {},
		resetPlanReference: () => {}, syncTodoPhasesFromBranch: () => {},
		resetAdvisorRuntimes: () => {}, rebaseAfterCompaction: () => {},
		recordAnchoredHistoryRewrite: () => {},
		getContextBreakdown: () => undefined, getContextUsage: () => undefined,
		shake: async () => ({ modified: false, tokensRemoved: 0 }),
		dropImages: async () => ({ removed: 0 }),
		generateHandoffDocument,
		removeAssistantMessageFromActiveContext: () => {},
		dropPersistedAssistantTurn: async () => undefined,
		runRecoveryCompactionWithRollback: async () => ({ continuationScheduled: false }),
		parseRetryAfterMsFromError: () => undefined,
		setModelTemporary: async () => {}, abort: async () => {}, abortHandoff: () => {},
	};
	const maintenance = new SessionMaintenance(host);
	maintenance.maybeStartSpeculativeCompaction(9_000, 20_000);
	for (let i = 0; i < 100 && maintenance.speculationState !== "armed"; i++) await Promise.resolve();
	expect(maintenance.speculationState).toBe("armed");
	expect(generateHandoffDocument).toHaveBeenCalledTimes(1);
	await maintenance.runAutoCompaction("threshold", false, { triggerContextTokens: 10_000 });
	expect(capture).toHaveBeenCalledTimes(1);
	expect(capture.mock.results[0]?.value?.[extension.path]).toContain("memory memory");
	expect(generateHandoffDocument).toHaveBeenCalledTimes(2);
	expect(manager.getBranch().filter(entry => entry.type === "compaction")).toHaveLength(0);
});
