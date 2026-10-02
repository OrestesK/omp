import { readFileSync } from "node:fs";
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { entriesAfterLatestResetBoundary, foldLedger, renderSummary, type Entry } from "./ledger/index.js";
import { launchConsolidation, type ConsolidationState, type ConsolidationWorkers } from "./consolidation.js";
import { registerRecallTool } from "./recall-tool.js";

/** Optional extension-local config.json: { "workerModel": "provider/model" }; reloaded with the extension. */
function readWorkerModel(): string | undefined {
	let text: string;
	try { text = readFileSync(new URL("./config.json", import.meta.url), "utf8"); }
	catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
		throw error;
	}
	const config: unknown = JSON.parse(text);
	if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("Observational memory config.json must be an object");
	const workerModel = (config as { workerModel?: unknown }).workerModel;
	if (workerModel !== undefined && typeof workerModel !== "string") throw new Error("Observational memory workerModel must be a string");
	return workerModel;
}

/** Ported from pi-observational-memory v3.1.4 (e7d77dc9a8305acb8054124e47662b3c766c2321). */
/** OMP's own remote/handoff compaction and Mnemopi remain the sole compaction/memory owners. */
export default function observationalMemory(pi: ExtensionAPI, workers?: ConsolidationWorkers): void {
	const workerModel = readWorkerModel();
	const inFlight = new Set<string>();
	const state: ConsolidationState = {};

	pi.on("agent_end", (event, ctx) => {
		if (event.willContinue || (!ctx.model && workerModel === undefined) || ctx.sessionManager.getEntries().some((entry) => entry.type === "session_init")) return;
		const branchKey = ctx.sessionManager.getSessionId() + ":" + ctx.sessionManager.getLeafId();
		if (inFlight.has(branchKey)) return;
		inFlight.add(branchKey);
		void launchConsolidation(pi, ctx, state, workers, workerModel).catch((error: unknown) => {
			pi.logger.error("Observational memory consolidation failed", error);
		}).finally(() => { inFlight.delete(branchKey); });
	});

	pi.registerCompactionSnapshot((branchEntries, ctx) => {
		if (ctx.sessionManager.getEntries().some((entry) => entry.type === "session_init")) return "";
		const active = foldLedger(entriesAfterLatestResetBoundary(branchEntries as Entry[]));
		const summary = renderSummary(active.reflections, active.activeObservations);
		return summary ? `Observational memory (branch-scoped context; source evidence: observation_recall):\n\n${summary}` : "";
	});

	registerRecallTool(pi);
}
