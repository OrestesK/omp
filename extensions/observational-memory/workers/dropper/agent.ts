import { agentLoop, type AgentContext, type AgentLoopConfig, type AgentTool, type StreamFn } from "@oh-my-pi/pi-agent-core";
import { Effort } from "@oh-my-pi/pi-catalog";
import { streamSimple, type Message, type Model } from "@oh-my-pi/pi-ai";
import { type } from "@oh-my-pi/omptype";
import { AGENT_LOOP_MAX_TOKENS, boundedMaxTokens } from "../../model-budget.js";
import { logAgentStreamError, WorkerStreamError } from "../stream-errors.js";
import { reflectionToSummaryLine, type Observation, type Reflection } from "../../ledger/index.js";
import { DROPPER_SYSTEM } from "./prompts.js";
import {
	REFLECTION_COVERAGE_DROP_RANK,
	coverageTierForObservation,
	reflectionCoverageMap,
	observationToDropperLine,
} from "./coverage.js";
import { observationPoolMetrics } from "./pool.js";

interface RunDropperArgs {
	model: Model;
	getApiKey?: AgentLoopConfig["getApiKey"];
	headers?: Record<string, string>;
	reflections: Reflection[];
	observations: Observation[];
	targetTokens: number;
	signal?: AbortSignal;
	agentLoop?: typeof agentLoop;
	maxTurns?: number;
	/** Maximum output tokens for the loop (defaults to {@link AGENT_LOOP_MAX_TOKENS}). */
	maxOutputTokens?: number;
	thinkingLevel?: AgentLoopConfig["reasoning"] | "off";
	streamFn?: StreamFn;
}

const RELEVANCE_DROP_RANK: Record<Observation["relevance"], number> = { low: 0, medium: 1, high: 2, critical: 3 };

const DropObservationsSchema = type({
	ids: type.string.atLeastLength(1).array().atLeastLength(1),
	reason: type.string.optional(),
});

type DropObservationsArgs = typeof DropObservationsSchema.infer;

function joinOrEmpty(items: string[]): string {
	return items.length ? items.join("\n") : "(none yet)";
}

export function normalizeDropObservationIds(
	ids: readonly string[] | undefined,
	observations: readonly Observation[],
): string[] | undefined {
	if (!ids || ids.length === 0) return undefined;
	const allowed = new Map(observations.map((observation) => [observation.id, observation]));
	const result: string[] = [];
	const seen = new Set<string>();
	for (const id of ids) {
		const observation = allowed.get(id);
		if (!observation) continue;
		if (seen.has(id)) continue;
		seen.add(id);
		result.push(id);
	}
	return result.length > 0 ? result : undefined;
}

function timestampRank(timestamp: string): number {
	const parsed = Date.parse(timestamp);
	return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export function selectDropCandidates(
	ids: readonly string[],
	observations: readonly Observation[],
	maxDrops: number,
	reflections: readonly Reflection[] = [],
): string[] {
	if (maxDrops <= 0 || ids.length === 0) return [];

	const byId = new Map(observations.map((observation) => [observation.id, observation]));
	const coverageById = reflectionCoverageMap(observations, reflections);
	const firstProposalIndex = new Map<string, number>();
	for (let i = 0; i < ids.length; i++) {
		const id = ids[i];
		if (!firstProposalIndex.has(id)) firstProposalIndex.set(id, i);
	}

	return Array.from(firstProposalIndex.entries())
		.map(([id, index]) => ({ id, index, observation: byId.get(id) }))
		.filter((candidate): candidate is { id: string; index: number; observation: Observation } =>
			candidate.observation !== undefined
		)
		.sort((a, b) => {
			const coverageDelta = REFLECTION_COVERAGE_DROP_RANK[coverageTierForObservation(a.observation, coverageById)]
				- REFLECTION_COVERAGE_DROP_RANK[coverageTierForObservation(b.observation, coverageById)];
			const relevanceDelta = RELEVANCE_DROP_RANK[a.observation.relevance] - RELEVANCE_DROP_RANK[b.observation.relevance];
			const ageDelta = timestampRank(a.observation.timestamp) - timestampRank(b.observation.timestamp);
			return coverageDelta || relevanceDelta || ageDelta || a.index - b.index;
		})
		.slice(0, maxDrops)
		.map((candidate) => candidate.id);
}

export async function runDropper(args: RunDropperArgs): Promise<string[] | undefined> {
	const { model, getApiKey, headers, reflections, observations, targetTokens, signal } = args;
	if (observations.length === 0) return undefined;

	const metrics = observationPoolMetrics(observations, targetTokens);
	const { observationTokens, fullness, tokensOverTarget, maxDropsAllowed } = metrics;
	const coverageById = reflectionCoverageMap(observations, reflections);
	if (maxDropsAllowed <= 0) return undefined;

	const proposedDropIds: string[] = [];
	const proposed = new Set<string>();
	const allowed = new Set(observations.map((observation) => observation.id));

	const dropObservations: AgentTool<typeof DropObservationsSchema> = {
		name: "drop_observations",
		label: "Drop observations",
		intent: "omit",
		concurrency: "exclusive",
		description: "Propose active observation ids that are safe to remove from compacted memory.",
		parameters: DropObservationsSchema,
		execute: async (_id, params: DropObservationsArgs) => {
			const seenInRequest = new Set<string>();
			let added = 0;
			for (const id of params.ids) {
				if (!allowed.has(id) || seenInRequest.has(id)) continue;
				seenInRequest.add(id);
				if (proposed.has(id)) continue;
				proposed.add(id);
				proposedDropIds.push(id);
				added++;
			}
			return {
				content: [{ type: "text", text: `Queued ${added} drop candidate${added === 1 ? "" : "s"}. Candidates this run: ${proposedDropIds.length}. Maximum drops allowed: ${maxDropsAllowed}.` }],
				details: { added, totalCandidates: proposedDropIds.length, maxDropsAllowed },
			};
		},
	};

	const fullnessPercent = Math.round(fullness * 100);
	const userText = `CURRENT REFLECTIONS:\n${joinOrEmpty(reflections.map(reflectionToSummaryLine))}\n\nCURRENT OBSERVATIONS:\n${joinOrEmpty(observations.map((observation) => observationToDropperLine(observation, coverageTierForObservation(observation, coverageById))))}\n\nActive observation pool: ~${observationTokens.toLocaleString()} tokens; target: ~${targetTokens.toLocaleString()} tokens; fullness against target: ~${fullnessPercent.toLocaleString()}%; over target by ~${tokensOverTarget.toLocaleString()} tokens.\nMaximum drops allowed this run: ${maxDropsAllowed.toLocaleString()} observation${maxDropsAllowed === 1 ? "" : "s"}. This maximum is sized to move the active pool toward the target if every proposed drop is clearly safe.\nThis maximum is a hard upper bound, not a target. Drop fewer or none if fewer observations are clearly safe.`;
	const prompts: Message[] = [{ role: "user", content: [{ type: "text", text: userText }], timestamp: Date.now() }];
	const context: AgentContext = { systemPrompt: [DROPPER_SYSTEM], messages: [], tools: [dropObservations] };
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
		// Tool execution collects candidate ids.
		streamError = logAgentStreamError(event) ?? streamError;
	}
	await stream.result();
	if (streamError) throw new WorkerStreamError("dropper", streamError);
	if (hitCap) throw new Error(`dropper exceeded model-call limit (${effectiveMaxTurns})`);
	const droppedIds = selectDropCandidates(proposedDropIds, observations, maxDropsAllowed, reflections);
	return droppedIds.length > 0 ? droppedIds : undefined;
}
