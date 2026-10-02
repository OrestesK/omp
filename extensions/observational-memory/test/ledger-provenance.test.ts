import type { DeveloperMessage } from "@oh-my-pi/pi-ai";
import { expect, test } from "bun:test";
import {
  OM_OBSERVATIONS_DROPPED, OM_OBSERVATIONS_RECORDED, OM_REFLECTIONS_RECORDED,
  entriesAfterLatestResetBoundary, foldLedger, isObservationsRecordedEntry,
  latestCoverageIndex, latestCoverageMarkerId, recallMemorySources, renderSummary,
  type Entry, type Observation, type Reflection,
} from "../ledger/index.js";
import { renderRecallSourceEntries, serializeSourceAddressedBranchEntries } from "../serialize.js";
import { estimateStringTokens } from "../tokens.js";

const observation = (id: string, sourceEntryIds: string[], content = "Recorded fact"): Observation => ({
  id, content, sourceEntryIds, timestamp: "2026-09-29 12:00", relevance: "high", tokenCount: 8,
});
const reflection = (id: string, supportingObservationIds: string[]): Reflection => ({
  id, content: "Resulting decision", supportingObservationIds, tokenCount: 7,
});
const raw = (id: string, content: string): Entry => ({type: "custom_message", id, timestamp: "2026-09-29T12:00:00Z", content});
const recorded = (id: string, observations: Observation[], coversUpToId: string): Entry => ({
  type: "custom", id, customType: OM_OBSERVATIONS_RECORDED, data: {observations, coversUpToId},
});

test("branch records fold first-valid facts and drops only on selected branch", () => {
  const shared = raw("root", "Shared context");
  const main = [shared, raw("main", "Main branch"), recorded("main-record", [observation("aaaaaaaaaaaa", ["main"])], "main")];
  const fork = [shared, raw("fork", "Fork branch"), recorded("fork-record", [observation("bbbbbbbbbbbb", ["fork"])], "fork"),
    recorded("duplicate", [observation("bbbbbbbbbbbb", ["fork"], "Overwritten")], "fork"),
    {type: "custom", id: "drop", customType: OM_OBSERVATIONS_DROPPED, data: {observationIds: ["bbbbbbbbbbbb"], coversUpToId: "fork"}}];
  expect(foldLedger(main).activeObservations.map(o => o.id)).toEqual(["aaaaaaaaaaaa"]);
  const folded = foldLedger(fork);
  expect(folded.activeObservations).toEqual([]);
  const recalled = recallMemorySources(fork, "bbbbbbbbbbbb");
  expect(recalled.observations[0]?.status).toBe("dropped");
  expect(recalled.observations[0]?.observation.content).toBe("Recorded fact");
  expect(recalled.sourceEntries.map(e => e.id)).toEqual(["fork"]);
  expect(recallMemorySources(main, "bbbbbbbbbbbb").status).toBe("not_found");
});

test("persisted developer source keeps its role in observer input and observation recall", () => {
  const message: DeveloperMessage = {
    role: "developer", content: [{type: "text", text: "Use the approved plan."}],
    timestamp: new Date(2026, 8, 29, 12, 0).getTime(),
  };
  const source: Entry = {type: "message", id: "developer-source", message};
  const entries = [source, recorded("ledger", [observation("aaaaaaaaaaaa", [source.id])], source.id)];
  const observer = serializeSourceAddressedBranchEntries(entries);
  expect(observer.sourceEntryIds).toEqual([source.id]);
  expect(observer.text).toContain("[Developer @ 2026-09-29 12:00]: Use the approved plan.");
  const recall = renderRecallSourceEntries(recallMemorySources(entries, "aaaaaaaaaaaa").sourceEntries);
  expect(recall).toContain("[Developer @ 2026-09-29 12:00]: Use the approved plan.");
  expect(observer.text).not.toContain("Tool result");
  expect(recall).not.toContain("Tool result");
});

test("source ids retain exact provenance and flag missing/non-source evidence", () => {
  const obs = observation("aaaaaaaaaaaa", ["source", "missing", "ledger", "source"]);
  const entries = [raw("source", "Original evidence"), recorded("ledger", [obs], "source"),
    {type: "custom", id: "reflection", customType: OM_REFLECTIONS_RECORDED,
      data: {reflections: [reflection("cccccccccccc", ["aaaaaaaaaaaa"])], coversUpToId: "source"}}];
  const result = recallMemorySources(entries, "cccccccccccc");
  expect(result.status).toBe("found");
  expect(result.sourceEntries.map(e => e.id)).toEqual(["source"]);
  expect(result.missingSourceEntryIds).toEqual(["missing"]);
  expect(result.nonSourceEntryIds).toEqual(["ledger"]);
  expect(renderRecallSourceEntries(result.sourceEntries)).toContain("Original evidence");
  expect(serializeSourceAddressedBranchEntries(entries).sourceEntryIds).toEqual(["source"]);
});

test("reflection recall preserves supporting source order, last-entry source data, and id collisions", () => {
  const entries: Entry[] = [raw("same", "Old source"), raw("other", "Other source"), raw("same", "Current source"),
    recorded("ledger", [observation("cccccccccccc", ["same"]), observation("aaaaaaaaaaaa", ["same", "other"]),
      observation("bbbbbbbbbbbb", ["other", "same"])], "same"),
    {type: "custom", id: "reflection", customType: OM_REFLECTIONS_RECORDED,
      data: {reflections: [reflection("cccccccccccc", ["aaaaaaaaaaaa", "bbbbbbbbbbbb"])], coversUpToId: "same"}}];
  const result = recallMemorySources(entries, "cccccccccccc");
  expect(result.collision).toBe(true);
  expect(result.observations.map(o => o.observation.id)).toEqual(["cccccccccccc", "aaaaaaaaaaaa", "bbbbbbbbbbbb"]);
  expect(result.sourceEntries.map(e => e.id)).toEqual(["same", "other"]);
  expect(result.sourceEntries[0]?.content).toBe("Current source");
});

test("coverage ignores invalid and orphaned records while preserving last-entry id lookup", () => {
  const entries: Entry[] = [raw("source", "Old"), recorded("first", [observation("aaaaaaaaaaaa", ["source"])], "source"),
    raw("source", "Current"), recorded("last", [observation("bbbbbbbbbbbb", ["source"])], "source"),
    recorded("orphan", [observation("cccccccccccc", ["source"])], "missing"),
    recorded("empty", [], "source")];
  expect(latestCoverageIndex(entries, OM_OBSERVATIONS_RECORDED)).toBe(2);
  expect(latestCoverageMarkerId(entries, OM_OBSERVATIONS_RECORDED)).toBe("source");
});

test("latest reset boundary hides old context without erasing raw recall", () => {
  const old = observation("aaaaaaaaaaaa", ["before"]);
  const current = observation("bbbbbbbbbbbb", ["after"]);
  const entries: Entry[] = [raw("before", "Old era"), recorded("old-ledger", [old], "before"),
    {type: "reset_boundary", id: "clear-1"}, raw("after", "Current era"), recorded("new-ledger", [current], "after")];
  const visible = entriesAfterLatestResetBoundary(entries);
  expect(foldLedger(visible).activeObservations.map(o => o.id)).toEqual(["bbbbbbbbbbbb"]);
  expect(renderSummary(foldLedger(visible).reflections, foldLedger(visible).activeObservations)).toContain("observation_recall");
  expect(recallMemorySources(entries, "aaaaaaaaaaaa").sourceEntries.map(e => e.id)).toEqual(["before"]);
  expect(latestCoverageMarkerId(visible, OM_OBSERVATIONS_RECORDED)).toBe("after");
  expect(entriesAfterLatestResetBoundary([raw("one", "No reset")]).map(e => e.id)).toEqual(["one"]);
});

test("malformed ledger payload is ignored by folding and coverage", () => {
  const source = raw("source", "record");
  const malformed: Entry = {type: "custom", id: "invalid", customType: OM_OBSERVATIONS_RECORDED,
    data: {observations: [{id: "not-a-memory-id", content: "bad"}], coversUpToId: "source"}};
  expect(isObservationsRecordedEntry(malformed)).toBe(false);
  expect(foldLedger([source, malformed]).activeObservations).toEqual([]);
  expect(latestCoverageIndex([source, malformed], OM_OBSERVATIONS_RECORDED)).toBe(-1);
  const next = raw("next", "subsequent source");
  const valid = recorded("valid", [observation("aaaaaaaaaaaa", ["next"])], "next");
  expect(latestCoverageIndex([source, malformed, next, valid], OM_OBSERVATIONS_RECORDED)).toBe(2);
});

test("multibyte oversized source keeps an explicitly marked excerpt inside observer budget", () => {
  const result = serializeSourceAddressedBranchEntries([raw("unicode", "🌍".repeat(2000))], {maxTokens: 80});
  expect(result.sourceEntryIds).toEqual(["unicode"]);
  expect(result.text).toContain("middle omitted");
  expect(estimateStringTokens(result.text)).toBeLessThanOrEqual(80);
});
