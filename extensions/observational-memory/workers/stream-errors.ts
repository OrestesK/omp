import type { AgentEvent } from "@oh-my-pi/pi-agent-core";

export interface AgentStreamFailure {
	stopReason: "error" | "aborted";
	errorMessage?: string;
}

export class WorkerStreamError extends Error {
	readonly stopReason: AgentStreamFailure["stopReason"];
	constructor(stage: "reflector" | "dropper", failure: AgentStreamFailure) {
		super(`${stage} stream ended with stopReason "${failure.stopReason}"${failure.errorMessage ? `: ${failure.errorMessage}` : ""}`);
		this.name = "WorkerStreamError";
		this.stopReason = failure.stopReason;
	}
}

/** Failed provider streams end normally; return the terminal failure for fail-closed workers. */
export function logAgentStreamError(event: AgentEvent): AgentStreamFailure | undefined {
	if (event.type !== "message_end") return;
	const message = event.message;
	if (message.role !== "assistant") return;
	if (message.stopReason !== "error" && message.stopReason !== "aborted") return;
	const failure = { stopReason: message.stopReason, errorMessage: message.errorMessage };
	return failure;
}
