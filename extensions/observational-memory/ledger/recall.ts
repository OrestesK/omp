import {
	isObservationsDroppedEntry,
	isObservationsRecordedEntry,
	isReflectionsRecordedEntry,
	type Entry,
	type Observation,
	type Reflection,
} from "./types.js";

const SOURCE_TYPES = new Set(["message", "custom_message", "branch_summary"]);

type ObservationLedgerLocation = { entryId: string; recordIndex: number; epoch: number };

type RecalledObservation = {
	observation: Observation;
	status: "active" | "dropped";
	sourceEntryIds: string[];
	sourceEntries: Entry[];
	missingSourceEntryIds: string[];
	nonSourceEntryIds: string[];
};

type RecalledReflection = {
	reflection: Reflection;
};

type RecallResult =
	| {
			status: "not_found";
			memoryId: string;
			reflections: [];
			observations: [];
			sourceEntries: [];
			missingSourceEntryIds: [];
			nonSourceEntryIds: [];
			missingSupportingObservationIds: [];
			collision: false;
	  }
	| {
			status: "found";
			memoryId: string;
			reflections: RecalledReflection[];
			observations: RecalledObservation[];
			sourceEntries: Entry[];
			missingSourceEntryIds: string[];
			nonSourceEntryIds: string[];
			missingSupportingObservationIds: string[];
			collision: boolean;
	  };

type IndexedObservation = ObservationLedgerLocation & { observation: Observation };
type IndexedReflection = { reflection: Reflection; epoch: number };

function isSourceEntry(entry: Entry): boolean {
	return SOURCE_TYPES.has(entry.type);
}

function uniqueById(entries: Entry[]): Entry[] {
	const seen = new Set<string>();
	const result: Entry[] = [];
	for (const entry of entries) {
		if (seen.has(entry.id)) continue;
		seen.add(entry.id);
		result.push(entry);
	}
	return result;
}

function uniqueStrings(values: string[]): string[] {
	return Array.from(new Set(values));
}

function indexLedger(entries: Entry[]): {
	observations: IndexedObservation[];
	reflections: IndexedReflection[];
	droppedIdsByEpoch: Map<number, Set<string>>;
} {
	const observations: IndexedObservation[] = [];
	const reflections: IndexedReflection[] = [];
	const droppedIdsByEpoch = new Map<number, Set<string>>();
	let epoch = 0;

	for (const entry of entries) {
		if (entry.type === "reset_boundary") {
			epoch++;
			continue;
		}
		if (isObservationsRecordedEntry(entry)) {
			entry.data.observations.forEach((observation, recordIndex) => {
				observations.push({ observation, entryId: entry.id, recordIndex, epoch });
			});
			continue;
		}
		if (isReflectionsRecordedEntry(entry)) {
			for (const reflection of entry.data.reflections) reflections.push({ reflection, epoch });
			continue;
		}
		if (isObservationsDroppedEntry(entry)) {
			let droppedIds = droppedIdsByEpoch.get(epoch);
			if (!droppedIds) {
				droppedIds = new Set<string>();
				droppedIdsByEpoch.set(epoch, droppedIds);
			}
			for (const id of entry.data.observationIds) droppedIds.add(id);
		}
	}

	return { observations, reflections, droppedIdsByEpoch };
}

function resolveObservationSources(byId: Map<string, Entry>, observation: Observation): RecalledObservation {
	const sourceEntryIds = uniqueStrings(observation.sourceEntryIds);
	const sourceEntries: Entry[] = [];
	const missingSourceEntryIds: string[] = [];
	const nonSourceEntryIds: string[] = [];

	for (const sourceEntryId of sourceEntryIds) {
		const sourceEntry = byId.get(sourceEntryId);
		if (!sourceEntry) {
			missingSourceEntryIds.push(sourceEntryId);
			continue;
		}
		if (!isSourceEntry(sourceEntry)) {
			nonSourceEntryIds.push(sourceEntryId);
			continue;
		}
		sourceEntries.push(sourceEntry);
	}

	return {
		observation,
		status: "active",
		sourceEntryIds,
		sourceEntries,
		missingSourceEntryIds,
		nonSourceEntryIds,
	};
}

function notFound(memoryId: string): RecallResult {
	return {
		status: "not_found",
		memoryId,
		reflections: [],
		observations: [],
		sourceEntries: [],
		missingSourceEntryIds: [],
		nonSourceEntryIds: [],
		missingSupportingObservationIds: [],
		collision: false,
	};
}

export function recallMemorySources(entries: Entry[], memoryId: string): RecallResult {
	const { observations: indexedObservations, reflections: indexedReflections, droppedIdsByEpoch } = indexLedger(entries);
	const directObservationMatches = indexedObservations.filter(({ observation }) => observation.id === memoryId);
	const reflectionMatches = indexedReflections.filter(({ reflection }) => reflection.id === memoryId);

	if (directObservationMatches.length === 0 && reflectionMatches.length === 0) return notFound(memoryId);
	const entriesById = new Map<string, Entry>();
	for (const entry of entries) entriesById.set(entry.id, entry);

	const observationsByEpoch = new Map<number, Map<string, IndexedObservation>>();
	for (const indexed of indexedObservations) {
		let byId = observationsByEpoch.get(indexed.epoch);
		if (!byId) {
			byId = new Map<string, IndexedObservation>();
			observationsByEpoch.set(indexed.epoch, byId);
		}
		if (!byId.has(indexed.observation.id)) byId.set(indexed.observation.id, indexed);
	}

	const recalledByKey = new Map<string, RecalledObservation>();
	const missingSupportingObservationIds: string[] = [];

	function addObservation(indexed: IndexedObservation): void {
		const key = `${indexed.entryId}:${indexed.recordIndex}`;
		if (recalledByKey.has(key)) return;
		const recalled = resolveObservationSources(entriesById, indexed.observation);
		recalled.status = droppedIdsByEpoch.get(indexed.epoch)?.has(indexed.observation.id) ? "dropped" : "active";
		recalledByKey.set(key, recalled);
	}

	for (const match of directObservationMatches) addObservation(match);

	for (const { reflection, epoch } of reflectionMatches) {
		for (const observationId of uniqueStrings(reflection.supportingObservationIds)) {
			const indexed = observationsByEpoch.get(epoch)?.get(observationId);
			if (!indexed) {
				missingSupportingObservationIds.push(observationId);
				continue;
			}
			addObservation(indexed);
		}
	}

	const recalledObservations = Array.from(recalledByKey.values());
	const recalledReflections: RecalledReflection[] = reflectionMatches.map(({ reflection }) => ({ reflection }));
	const sourceEntries = uniqueById(recalledObservations.flatMap((match) => match.sourceEntries));
	const missingSourceEntryIds = uniqueStrings(recalledObservations.flatMap((match) => match.missingSourceEntryIds));
	const nonSourceEntryIds = uniqueStrings(recalledObservations.flatMap((match) => match.nonSourceEntryIds));
	const uniqueMissingSupportingObservationIds = uniqueStrings(missingSupportingObservationIds);
	const matchCount = directObservationMatches.length + reflectionMatches.length;

	return {
		status: "found",
		memoryId,
		reflections: recalledReflections,
		observations: recalledObservations,
		sourceEntries,
		missingSourceEntryIds,
		nonSourceEntryIds,
		missingSupportingObservationIds: uniqueMissingSupportingObservationIds,
		collision: matchCount > 1,
	};
}
