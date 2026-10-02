# Observational memory

This extension adds branch-scoped, source-linked context to OMP's existing compaction. It does **not** replace the remote→handoff compactor or Mnemopi. It requires the patched OMP host's `registerCompactionSnapshot` and context-projection support; installing the extension alone on an unpatched host does not provide this behavior.

## How it works

1. Completed agent turns can add records to the selected branch's session ledger.
    - At its token cadence, background workers observe source messages and tool output, reflect stable facts, and drop observations from active context when the pool needs trimming.
    - Records retain source IDs. A detached worker result is discarded if the branch or leaf changes before append.
2. A **successful** native remote or handoff compaction commit freezes the selected branch's snapshot.
    - The patched host calls the extension callback, which folds the current `/clear` epoch and renders active observations and reflections.
    - The host stores the nonempty result on the compaction entry, keyed by extension path. An attempted compaction does not persist a new snapshot.
3. The host projects the frozen note when rebuilding model context.
    - It keeps the native summary, opaque provider payloads, and real conversation entries. Ordinarily, a separate user message follows the native summary and precedes the retained tail.
    - With Anthropic signed retained thinking, the note follows the **entire pre-commit retained tail** to preserve signed continuity.
    - With Codex remote compaction, the note follows the opaque item in request-only replay, ahead of original retained items. It is not a journal turn or system-prompt change.
4. The note stays frozen until the next successful compaction.
    - Later observations do not refresh it per request. A fork uses its own selected branch ledger, not a sibling's snapshot.
    - The next handoff excludes the prior projected note from its summarizer input while retaining the real conversation.

## Evidence and ownership

`observation_recall` accepts an exact 12-character lowercase hex observation or reflection ID and retrieves branch-local supporting observations and source messages/tool output. Dropped observations remain recallable. Repeated IDs across `/clear` epochs preserve all historical occurrences, while drop status and reflection support are resolved within each epoch. This is source lookup, **not** semantic search; use it when the condensed note needs exact evidence.

Mnemopi remains the separate long-term memory backend. OMP owns compaction and the patched host owns snapshot persistence and projection; this extension owns only its ledger, rendered note, and source-aware recall.
