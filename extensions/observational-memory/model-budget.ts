import type { Model } from "@oh-my-pi/pi-ai";

export const AGENT_LOOP_MAX_TOKENS = 32_000;

export function boundedMaxTokens(model: Model, requested: number = AGENT_LOOP_MAX_TOKENS): number {
	return typeof model.maxTokens === "number" && model.maxTokens > 0
		? Math.min(model.maxTokens, requested)
		: requested;
}
