import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { MEMORY_ID_PATTERN, recallMemorySources, type Entry } from "./ledger/index.js";
import { renderRecallSourceEntries } from "./serialize.js";

/** Deliberately distinct from Mnemopi's recall tool. A dropped observation remains source-recallable. */
export function registerRecallTool(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "observation_recall",
		label: "Recall observation evidence",
		description: "Recover the exact branch-local source messages, tool output, and supporting observations behind a specific 12-character observation or reflection id. Includes observations dropped from active context; this is not semantic search.",
		approval: "read",
		parameters: pi.typebox.Type.Object({ id: pi.typebox.Type.String({ description: "Specific 12-character lowercase hex observation or reflection id" }) }),
		async execute(_toolCallId, { id }, _signal, _onUpdate, ctx) {
			if (!MEMORY_ID_PATTERN.test(id)) {
				return { content: [{ type: "text" as const, text: `Memory id must be 12 lowercase hex characters. Received: ${id}` }], details: { status: "invalid_id", memoryId: id } };
			}
			// Do not apply the /clear sidecar boundary here: old branch evidence remains recallable.
			const result = recallMemorySources(ctx.sessionManager.getBranch() as Entry[], id);
			if (result.status === "not_found") {
				return { content: [{ type: "text" as const, text: `No observation or reflection with id ${id} was found on the current branch.` }], details: result };
			}
			const sections: string[] = [];
			if (result.collision) sections.push(`Memory id ${id} matched multiple items; returning all matching evidence.`);
			if (result.reflections.length) {
				sections.push(`Reflections:\n${result.reflections.map(({ reflection }) => `[${reflection.id}] ${reflection.content}`).join("\n")}`);
			}
			if (result.observations.length) {
				sections.push(`Observations:\n${result.observations.map(({ observation, status }) => `[${observation.id}]${status === "dropped" ? " [dropped]" : ""} ${observation.timestamp} [${observation.relevance}] ${observation.content}`).join("\n")}`);
			}
			if (result.missingSupportingObservationIds.length) sections.push(`Unavailable supporting observations: ${result.missingSupportingObservationIds.join(", ")}`);
			if (result.missingSourceEntryIds.length) sections.push(`Missing source entries: ${result.missingSourceEntryIds.join(", ")}`);
			if (result.nonSourceEntryIds.length) sections.push(`Non-source entry ids: ${result.nonSourceEntryIds.join(", ")}`);
			const sources = renderRecallSourceEntries(result.sourceEntries);
			if (sources.trim()) sections.push(`Sources:\n${sources}`);
			else sections.push("No source entries are available for this memory id.");
			return { content: [{ type: "text" as const, text: sections.join("\n\n") }], details: result };
		},
	});
}
