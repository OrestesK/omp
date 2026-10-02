import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import {
	OM_OBSERVATIONS_DROPPED, OM_OBSERVATIONS_RECORDED, OM_REFLECTIONS_RECORDED,
	buildObservationsDroppedData, buildObservationsRecordedData, buildReflectionsRecordedData,
	earlierCoverageMarkerId, entriesAfterLatestResetBoundary, entryIndexById, findLastCompactionIndex,
	foldLedger, isReflectionsRecordedEntry, isSourceEntry, latestCoverageIndex, latestCoverageMarkerId,
	observationToSummaryLine, rawTokensAfterIndex, rawTokensSinceLastCompaction,
	realContextTokensAfterCompaction, realContextTokensAtCoverage, realTokensSinceAnchor, reflectionToSummaryLine,
	type Entry,
} from "./ledger/index.js";
import { serializeSourceAddressedBranchEntries } from "./serialize.js";
import { runObserver } from "./workers/observer/agent.js";
import { runReflector } from "./workers/reflector/agent.js";
import { runDropper } from "./workers/dropper/agent.js";
import { observationPoolMetrics } from "./workers/dropper/pool.js";

const OBSERVE_AFTER_TOKENS = 10_000;
const REFLECT_AFTER_TOKENS = 20_000;
const POOL_TARGET_TOKENS = 10_000;
const MAX_TURNS = 16;
const MAX_OUTPUT_TOKENS = 32_000;

export type ConsolidationWorkers = {
	runObserver: typeof runObserver;
	runReflector: typeof runReflector;
	runDropper: typeof runDropper;
};

const defaultWorkers: ConsolidationWorkers = { runObserver, runReflector, runDropper };

export interface ConsolidationState {
	observerEmptyBackoff?: { sessionIdentity: string; coverageId?: string; anchorLeafId: string; tokensAtEmpty: number };
}

function currentTokens(ctx: ExtensionContext): number | undefined {
	const tokens = ctx.getContextUsage()?.tokens;
	return typeof tokens === "number" && Number.isFinite(tokens) ? tokens : undefined;
}

/** Reflection coverage names its source; cadence starts when the reflection ledger record was committed. */
function reflectionTokensSince(entries: Entry[], ctx: ExtensionContext): number {
	const idToIndex = entryIndexById(entries);
	let recordIndex = -1;
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (isReflectionsRecordedEntry(entry) && idToIndex.has(entry.data.coversUpToId)) { recordIndex = i; break; }
	}
	const compactionIndex = findLastCompactionIndex(entries);
	const afterCompaction = compactionIndex > recordIndex;
	const tokens = currentTokens(ctx);
	if (tokens !== undefined) {
		const baseline = afterCompaction ? realContextTokensAfterCompaction(entries, compactionIndex)
			: recordIndex >= 0 ? realContextTokensAtCoverage(entries, recordIndex) : 0;
		if (baseline !== undefined && tokens >= baseline) return tokens - baseline;
	}
	return afterCompaction ? rawTokensSinceLastCompaction(entries) : rawTokensAfterIndex(entries, recordIndex);
}

function observerChunkMaxTokens(contextWindow: number | undefined): number {
	return contextWindow && Number.isFinite(contextWindow) && contextWindow > 0
		? Math.max(256, Math.floor(contextWindow * 0.2))
		: 60_000;
}

/** The leaf is refreshed only after our own append. An interleaving turn, branch, or /clear invalidates the detached result. */
export async function launchConsolidation(pi: ExtensionAPI, ctx: ExtensionContext, state: ConsolidationState = {}, workers: ConsolidationWorkers = defaultWorkers, workerModel?: string): Promise<void> {
	const manager = ctx.sessionManager;
	if (manager.getEntries().some((entry) => entry.type === "session_init")) return;
	if (workerModel === undefined && !ctx.model) return;
	const initialBranch = manager.getBranch() as Entry[];
	const sessionId = manager.getSessionId();
	const sessionIdentity = sessionId + ":" + (initialBranch.findLast((entry) => entry.type === "reset_boundary")?.id ?? "");
	let expectedLeaf = manager.getLeafId();
	const sameBranch = () => manager.getSessionId() === sessionId && manager.getLeafId() === expectedLeaf;
	const branch = () => entriesAfterLatestResetBoundary(manager.getBranch() as Entry[]);
	const append = (kind: string, data: unknown): boolean => {
		if (!sameBranch()) return false;
		pi.appendEntry(kind, data);
		expectedLeaf = manager.getLeafId();
		return true;
	};
	let entries = entriesAfterLatestResetBoundary(initialBranch);
	const coverageIndex = latestCoverageIndex(entries, OM_OBSERVATIONS_RECORDED);
	const coverageId = coverageIndex < 0 ? undefined : entries[coverageIndex].id;
	const tokens = currentTokens(ctx);
	const observedTokens = (tokens === undefined ? undefined : realTokensSinceAnchor(entries, OM_OBSERVATIONS_RECORDED, tokens, coverageIndex))
		?? rawTokensAfterIndex(entries, coverageIndex);
	const backoff = state.observerEmptyBackoff;
	if (backoff && (backoff.sessionIdentity !== sessionIdentity || backoff.coverageId !== coverageId || !initialBranch.some((entry) => entry.id === backoff.anchorLeafId) || observedTokens >= backoff.tokensAtEmpty + OBSERVE_AFTER_TOKENS)) state.observerEmptyBackoff = undefined;
	const observeDue = observedTokens >= OBSERVE_AFTER_TOKENS && !state.observerEmptyBackoff;
	const reflectDue = reflectionTokensSince(entries, ctx) >= REFLECT_AFTER_TOKENS;
	if (!observeDue && !reflectDue) return;
	const model = workerModel === undefined ? ctx.model : workerModel && ctx.models.resolve(workerModel);
	if (!model) throw new Error("Observational memory worker model is unavailable: " + (workerModel ?? "current model"));
	const getApiKey = (requestModel: typeof model) => ctx.modelRegistry.resolver(requestModel, sessionId);
	const worker = { model, getApiKey, maxTurns: MAX_TURNS, maxOutputTokens: MAX_OUTPUT_TOKENS, thinkingLevel: "low" as const };

	if (observeDue) {
		const backlog = entries.slice(coverageIndex + 1).filter(isSourceEntry);
		const chunk = serializeSourceAddressedBranchEntries(backlog, { maxTokens: observerChunkMaxTokens(model.contextWindow) });
		const coversUpToId = chunk.sourceEntryIds.at(-1);
		if (coversUpToId && chunk.text.trim()) {
			const folded = foldLedger(entries);
			const observations = await workers.runObserver({
				...worker, chunk: chunk.text, allowedSourceEntryIds: chunk.sourceEntryIds,
				priorReflections: folded.reflections.map(reflectionToSummaryLine),
				priorObservations: folded.activeObservations.map(observationToSummaryLine),
			});
			if (!sameBranch()) return;
			const data = observations && buildObservationsRecordedData(observations, coversUpToId);
			if (!data) state.observerEmptyBackoff = { sessionIdentity, coverageId, anchorLeafId: expectedLeaf ?? coversUpToId, tokensAtEmpty: observedTokens };
			else { state.observerEmptyBackoff = undefined; if (!append(OM_OBSERVATIONS_RECORDED, data)) return; }
		}
	}

	if (!sameBranch()) return;
	entries = branch();
	if (reflectionTokensSince(entries, ctx) >= REFLECT_AFTER_TOKENS) {
		const coversUpToId = latestCoverageMarkerId(entries, OM_OBSERVATIONS_RECORDED);
		if (coversUpToId) {
			const folded = foldLedger(entries);
			let reflections: Awaited<ReturnType<ConsolidationWorkers["runReflector"]>>;
			try {
				reflections = await workers.runReflector({
					...worker, reflections: folded.reflections, observations: folded.activeObservations,
				});
			} catch (error) {
				try { await dropAfterReflection(coversUpToId); } catch { /* Preserve the reflector rejection. */ }
				throw error;
			}
			if (!sameBranch()) return;
			const data = reflections && buildReflectionsRecordedData(reflections, coversUpToId);
			if (data && !append(OM_REFLECTIONS_RECORDED, data)) return;
			await dropAfterReflection(coversUpToId);
		}
	}

	async function dropAfterReflection(reflectionCoverageId: string): Promise<void> {
		if (!sameBranch()) return;
		const fresh = branch();
		const folded = foldLedger(fresh);
		const metrics = observationPoolMetrics(folded.activeObservations, POOL_TARGET_TOKENS);
		if (!metrics.ready) return;
		const droppedIds = await workers.runDropper({
			...worker, reflections: folded.reflections, observations: folded.activeObservations, targetTokens: POOL_TARGET_TOKENS,
		});
		if (!sameBranch()) return;
		const cover = earlierCoverageMarkerId(fresh, latestCoverageMarkerId(fresh, OM_OBSERVATIONS_RECORDED), reflectionCoverageId);
		const data = droppedIds && cover && buildObservationsDroppedData(droppedIds, cover);
		if (data) append(OM_OBSERVATIONS_DROPPED, data);
	}
}
