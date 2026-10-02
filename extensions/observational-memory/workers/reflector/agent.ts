import { agentLoop, type AgentContext, type AgentLoopConfig, type AgentTool, type StreamFn } from "@oh-my-pi/pi-agent-core";
import { Effort } from "@oh-my-pi/pi-catalog";
import { streamSimple, type Message, type Model } from "@oh-my-pi/pi-ai";
import { type } from "@oh-my-pi/omptype";
import { hashId } from "../../ids.js";
import { logAgentStreamError, WorkerStreamError } from "../stream-errors.js";
import { AGENT_LOOP_MAX_TOKENS, boundedMaxTokens } from "../../model-budget.js";
import { truncateRecordContent } from "../../serialize.js";
import { REFLECTOR_SYSTEM } from "./prompts.js";
import { estimateStringTokens } from "../../tokens.js";
import { reflectionToSummaryLine, type Observation, type Reflection } from "../../ledger/index.js";
import {
	coverageTierForObservation,
	reflectionCoverageMap,
	type ReflectionCoverageTier,
} from "../dropper/coverage.js";

interface RunReflectorArgs {
	model: Model;
	getApiKey?: AgentLoopConfig["getApiKey"];
	headers?: Record<string, string>;
	reflections: Reflection[];
	observations: Observation[];
	signal?: AbortSignal;
	agentLoop?: typeof agentLoop;
	maxTurns?: number;
	/** Maximum output tokens for the loop (defaults to {@link AGENT_LOOP_MAX_TOKENS}). */
	maxOutputTokens?: number;
	thinkingLevel?: AgentLoopConfig["reasoning"] | "off";
	streamFn?: StreamFn;
}

const RecordReflectionsSchema = type({
	reflections: type({
		content: type.string.atLeastLength(1),
		supportingObservationIds: type.string.atLeastLength(1).array().atLeastLength(1),
	}).array().atLeastLength(1),
});

type RecordReflectionsArgs = typeof RecordReflectionsSchema.infer;

function joinOrEmpty(items: string[]): string {
	return items.length ? items.join("\n") : "(none yet)";
}

export function observationToReflectorLine(
	observation: Observation,
	coverage: ReflectionCoverageTier,
): string {
	return `[${observation.id}] ${observation.timestamp} [${observation.relevance}] [coverage: ${coverage}] ${observation.content}`;
}

export function normalizeSupportingObservationIds(
	supportingObservationIds: readonly string[] | undefined,
	allowedObservationIds: readonly string[],
): string[] | undefined {
	if (!supportingObservationIds || supportingObservationIds.length === 0) return undefined;
	const allowedOrder = new Map<string, number>();
	for (let i = 0; i < allowedObservationIds.length; i++) {
		if (!allowedOrder.has(allowedObservationIds[i])) allowedOrder.set(allowedObservationIds[i], i);
	}

	const seen = new Set<string>();
	for (const id of supportingObservationIds) {
		if (!allowedOrder.has(id)) return undefined;
		seen.add(id);
	}
	if (seen.size === 0) return undefined;
	return Array.from(seen).sort((a, b) => (allowedOrder.get(a) ?? 0) - (allowedOrder.get(b) ?? 0));
}

function normalizeReflectionContent(content: string): string | undefined {
	const normalized = truncateRecordContent(content.trim());
	if (!normalized || /\r|\n/.test(normalized)) return undefined;
	return normalized;
}

export async function runReflector(args: RunReflectorArgs): Promise<Reflection[] | undefined> {
	const { model, getApiKey, headers, reflections, observations, signal } = args;
	if (observations.length === 0) return undefined;

	const coverageById = reflectionCoverageMap(observations, reflections);

	const allowedObservationIds = observations.map((observation) => observation.id);
	const existingReflectionIds = new Set(reflections.map((reflection) => reflection.id));
	const accumulated = new Map<string, Reflection>();

	const recordReflections: AgentTool<typeof RecordReflectionsSchema> = {
		name: "record_reflections",
		label: "Record reflections",
		intent: "omit",
		concurrency: "exclusive",
		description: "Record new durable reflections with supporting observation ids.",
		parameters: RecordReflectionsSchema,
		execute: async (_id, params: RecordReflectionsArgs) => {
			let added = 0;
			let duplicates = 0;
			let rejected = 0;
			for (const proposal of params.reflections) {
				const content = normalizeReflectionContent(proposal.content);
				const supportingObservationIds = normalizeSupportingObservationIds(proposal.supportingObservationIds, allowedObservationIds);
				if (!content || !supportingObservationIds) {
					rejected++;
					continue;
				}
				const id = hashId(content);
				if (existingReflectionIds.has(id) || accumulated.has(id)) {
					duplicates++;
					continue;
				}
				accumulated.set(id, {
					id,
					content,
					supportingObservationIds,
					tokenCount: estimateStringTokens(content),
				});
				added++;
			}
			return {
				content: [{ type: "text", text: `Recorded ${added} reflection${added === 1 ? "" : "s"}; ${duplicates} duplicate${duplicates === 1 ? "" : "s"}; ${rejected} rejected. Total this run: ${accumulated.size}.` }],
				details: { added, duplicates, rejected, total: accumulated.size },
			};
		},
	};

	const userText = `CURRENT REFLECTIONS:\n${joinOrEmpty(reflections.map(reflectionToSummaryLine))}\n\nCURRENT OBSERVATIONS:\n${joinOrEmpty(observations.map((observation) => observationToReflectorLine(observation, coverageTierForObservation(observation, coverageById))))}\n\nCrystallize any missing durable facts or patterns into new reflections. If nothing is stable enough, do not call the tool.`;
	const prompts: Message[] = [{ role: "user", content: [{ type: "text", text: userText }], timestamp: Date.now() }];
	const context: AgentContext = { systemPrompt: [REFLECTOR_SYSTEM], messages: [], tools: [recordReflections] };
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
		// Tool execution collects records.
		streamError = logAgentStreamError(event) ?? streamError;
	}
	await stream.result();
	if (streamError) throw new WorkerStreamError("reflector", streamError);
	if (hitCap) throw new Error(`reflector exceeded model-call limit (${effectiveMaxTurns})`);
	const acceptedReflections = Array.from(accumulated.values());
	return acceptedReflections.length > 0 ? acceptedReflections : undefined;
}
