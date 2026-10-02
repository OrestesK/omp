import { agentLoop, type AgentContext, type AgentLoopConfig, type AgentTool, type StreamFn } from "@oh-my-pi/pi-agent-core";
import { Effort } from "@oh-my-pi/pi-catalog";
import { streamSimple, type Message, type Model } from "@oh-my-pi/pi-ai";
import { type } from "@oh-my-pi/omptype";
import { hashId } from "../../ids.js";
import { logAgentStreamError } from "../stream-errors.js";
import { AGENT_LOOP_MAX_TOKENS, boundedMaxTokens } from "../../model-budget.js";
import { OBSERVER_SYSTEM } from "./prompts.js";
import { nowTimestamp, truncateRecordContent } from "../../serialize.js";
import type { Observation, Relevance } from "../../ledger/index.js";
import { observationLineTokenCount } from "../../tokens.js";

interface RunObserverArgs {
	model: Model;
	getApiKey?: AgentLoopConfig["getApiKey"];
	headers?: Record<string, string>;
	priorReflections: string[];
	priorObservations: string[];
	chunk: string;
	allowedSourceEntryIds: string[];
	signal?: AbortSignal;
	agentLoop?: typeof agentLoop;
	maxTurns?: number;
	/** Maximum output tokens for the loop (defaults to {@link AGENT_LOOP_MAX_TOKENS}). */
	maxOutputTokens?: number;
	thinkingLevel?: AgentLoopConfig["reasoning"] | "off";
	streamFn?: StreamFn;
}

const RelevanceSchema = type.enumerated("low", "medium", "high", "critical");

export const OBSERVATION_TIMESTAMP_PATTERN = "^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}$";

const RecordObservationsSchema = type({
	observations: type({
		timestamp: type.string.matching(new RegExp(OBSERVATION_TIMESTAMP_PATTERN)).describe("Observation time in local 'YYYY-MM-DD HH:MM' format."),
		content: type.string.atLeastLength(1).describe("Single-line plain prose. No markdown, no tags, no embedded timestamp."),
		relevance: RelevanceSchema,
		sourceEntryIds: type.string.atLeastLength(1).array().atLeastLength(1).describe("Exact source entry ids from the chunk that directly support this observation. Use only ids shown in '[Source entry id: ...]' labels; never invent ids."),
	}).array().describe("Batch of new observations. May be empty only if the tool is not called at all."),
});

type RecordObservationsArgs = typeof RecordObservationsSchema.infer;

/**
 * Thrown when the agent loop ends with an API/stream failure (`stopReason`
 * `"error"`/`"aborted"`), even after a tool has collected records. agent-core
 * returns such runs normally; the caller must discard incomplete observations
 * rather than mistake them for a successful or deliberately empty result.
 */
export class ObserverStreamError extends Error {
	readonly stopReason: string;
	constructor(stopReason: string, errorMessage?: string) {
		super(`observer stream ended with stopReason "${stopReason}"${errorMessage ? `: ${errorMessage}` : ""}`);
		this.name = "ObserverStreamError";
		this.stopReason = stopReason;
	}
}

function joinOrEmpty(items: string[]): string {
	return items.length ? items.join("\n") : "(none yet)";
}

export function normalizeSourceEntryIds(
	sourceEntryIds: readonly string[] | undefined,
	allowedSourceEntryIds: readonly string[],
): string[] | undefined {
	if (!sourceEntryIds || sourceEntryIds.length === 0) return undefined;
	const allowedOrder = new Map<string, number>();
	for (let i = 0; i < allowedSourceEntryIds.length; i++) allowedOrder.set(allowedSourceEntryIds[i], i);

	const seen = new Set<string>();
	for (const id of sourceEntryIds) {
		if (!allowedOrder.has(id)) return undefined;
		seen.add(id);
	}
	if (seen.size === 0) return undefined;
	return Array.from(seen).sort((a, b) => (allowedOrder.get(a) ?? 0) - (allowedOrder.get(b) ?? 0));
}

export async function runObserver(args: RunObserverArgs): Promise<Observation[] | undefined> {
	const { model, getApiKey, headers, priorReflections, priorObservations, chunk, allowedSourceEntryIds, signal } = args;
	const conversation = chunk.trim();
	if (!conversation) return undefined;

	const accumulated = new Map<string, Observation>();

	const recordObservations: AgentTool<typeof RecordObservationsSchema> = {
		name: "record_observations",
		label: "Record observations",
		intent: "omit",
		concurrency: "exclusive",
		description:
			"Record a batch of new observations distilled from the conversation chunk. " +
			"Call this multiple times as you work through the chunk. Stop calling when coverage is complete, " +
			"then emit a short plain-text confirmation to end the run.",
		parameters: RecordObservationsSchema,
		execute: async (_id, params: RecordObservationsArgs) => {
			let added = 0;
			let duplicates = 0;
			let rejected = 0;
			for (const obs of params.observations) {
				const sourceEntryIds = normalizeSourceEntryIds(obs.sourceEntryIds, allowedSourceEntryIds);
				if (!sourceEntryIds) {
					rejected++;
					continue;
				}
				const content = truncateRecordContent(obs.content);
				const id = hashId(content);
				if (accumulated.has(id)) {
					duplicates++;
					continue;
				}
				accumulated.set(id, {
					id,
					content,
					timestamp: obs.timestamp,
					relevance: obs.relevance as Relevance,
					sourceEntryIds,
					tokenCount: observationLineTokenCount({
						id,
						timestamp: obs.timestamp,
						relevance: obs.relevance,
						content,
					}),
				});
				added++;
			}
			const rejectedPart = rejected > 0
				? ` ${rejected} observation${rejected === 1 ? "" : "s"} rejected for missing or invalid sourceEntryIds.`
				: "";
			const ack =
				`Recorded ${added} new observation${added === 1 ? "" : "s"} ` +
				(duplicates > 0 ? `(${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped).` : ".") +
				rejectedPart +
				` Total so far this run: ${accumulated.size}. ` +
				`Continue if the chunk still has uncovered content; otherwise stop calling the tool and emit a short plain-text confirmation.`;
			return { content: [{ type: "text", text: ack }], details: { added, duplicates, rejected, total: accumulated.size } };
		},
	};

	const now = nowTimestamp();
	const userText = `Current local time: ${now}

CURRENT REFLECTIONS:
${joinOrEmpty(priorReflections)}

CURRENT OBSERVATIONS:
${joinOrEmpty(priorObservations)}

Compress the following new conversation chunk into observations by calling record_observations one or more times. Do not restate facts already present in current reflections or current observations. Prefer inline conversation timestamps when assigning times; fall back to the current local time above only if no message timestamp applies. Stop calling the tool and reply with a short plain-text confirmation once the chunk is fully covered.

NEW CONVERSATION CHUNK:
${conversation}`;

	const prompts: Message[] = [
		{
			role: "user",
			content: [{ type: "text", text: userText }],
			timestamp: Date.now(),
		},
	];

	const context: AgentContext = {
		systemPrompt: [OBSERVER_SYSTEM],
		messages: [],
		tools: [recordObservations],
	};

	const reasoning = model.thinking?.efforts?.length;
	const thinkingLevel = args.thinkingLevel ?? Effort.Low;
	const effectiveMaxTurns = args.maxTurns && args.maxTurns > 0 ? args.maxTurns : 16;
	let turnCount = 0;
	let hitCap = false;
	const config: AgentLoopConfig = {
		model,
		getApiKey,
		headers,
		maxTokens: boundedMaxTokens(model, args.maxOutputTokens ?? AGENT_LOOP_MAX_TOKENS),
		convertToLlm: (msgs) => msgs as Message[],
		...(reasoning && thinkingLevel !== "off" ? { reasoning: thinkingLevel } : {}),
		...(thinkingLevel === "off" ? { disableReasoning: true } : {}),
		beforeModelCall: () => {
			if (++turnCount <= effectiveMaxTurns) return;
			hitCap = true;
			return { stop: true };
		},

	};
	const loop = args.agentLoop ?? agentLoop;
	const stream = loop(
		prompts,
		context,
		config,
		signal,
		args.streamFn ?? streamSimple,
	);
	let streamError: ReturnType<typeof logAgentStreamError> = undefined;
	for await (const event of stream) {
		// Drain events; the tool's execute already collects records.
		streamError = logAgentStreamError(event) ?? streamError;
	}
	await stream.result();

	if (streamError) throw new ObserverStreamError(streamError.stopReason, streamError.errorMessage);
	if (hitCap) throw new Error(`observer exceeded model-call limit (${effectiveMaxTurns})`);
	if (accumulated.size === 0) return undefined;
	return Array.from(accumulated.values());
}
