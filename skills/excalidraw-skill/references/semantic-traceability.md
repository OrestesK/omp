# Semantic traceability when needed

Use a source-to-scene inventory when the task calls for complete source coverage, stable-ID traceability, or a material semantic cut. A manifest is not required for every diagram. A readable overview need not put every source fact on one canvas

## Decide the scope

- Inventory source nodes and edges with stable IDs for explicit completeness work
- Decide with the user before materially omitting or abstracting requested facts
- Select the source inventory deliberately. Even `coverageScope: "selected"` requires a record for every ID in the supplied inventory
- Use `coverageScope: "full"` when the complete source inventory is explicitly selected. Every source node and edge needs exactly one record. Unknown IDs and `omittedWithRationale` are invalid, even with a rationale

## Record the mapping

- Classify each source node and edge exactly once as `included`, `abstracted`, `movedToDetail`, or `omittedWithRationale`
- Give `included` and `abstracted` records existing scene representation IDs. Give every other treatment a rationale and every `movedToDetail` record a `detailRef`
- Map included direct edges to source endpoint representations and bound scene arrows
- List extra semantic scene nodes or arrows as supplemental, with a rationale
- Check that representations and rationales remain understandable in the rendered artifact. Machine validity cannot establish this

## Run the optional validator

When a machine-checkable trace is useful, run the existing validator against the exported native scene, source inventory, and manifest:

```bash
python /absolute/path/to/excalidraw-skill/scripts/validate_semantic_cut.py scene.excalidraw inventory.json manifest.json --json
```

The JSON contracts are:

- Inventory: `nodes` and `edges` arrays with unique `id` values. Direct edges have `from` and `to` source node IDs
- Manifest: `version` set to `1`, `coverageScope` (`selected` or `full`), `viewMode` (`overview` or `technical`), and `nodes` / `edges` coverage arrays
- Coverage record: `sourceId`, `treatment`, and applicable `representationIds`, `rationale`, or `detailRef`. Included direct edges additionally use `fromRepresentationIds` and `toRepresentationIds`
- Optional `supplementalSceneElementIds` records: `sceneElementId` and `rationale`

The validator checks source IDs, treatments, scene representations, direct-edge bindings, and unmapped semantic scene elements. It does not assess abstraction quality or visual readability

- Exit `0` means pass, `1` means semantic validation failure, and `2` means invalid or unreadable input
- Keep the validator alongside `scripts/audit_scene.py`, from which it imports shared helpers

