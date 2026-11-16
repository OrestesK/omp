# Excalidraw operations and native format

This reference owns the local canvas lifecycle and native input formats. Use CLI `help [command]` or available MCP tool schemas for full command parameters. Design and rendered validation belong to [diagram design](../../diagram-design/SKILL.md). Native audit and operations belong to [the Excalidraw skill](../SKILL.md), with native styling in [its profile](orestes-clean-style.md)

## Live canvas and lifecycle

The CLI and MCP tools address the same canvas at `http://127.0.0.1:23187`, rather than the package's default port 3000. Prefix every CLI invocation with:

```bash
EXPRESS_SERVER_URL=http://127.0.0.1:23187 EXCALIDRAW_NO_AUTOSTART=1 pnpm dlx mcp-excalidraw-server@1.1.0 <command>
```

- Run `start` explicitly before canvas work. It overrides no-autostart and either starts a detached server or reports the existing server. Without it, canvas-touching commands cannot start a missing server
- Check `status` or `GET /health` for health and browser connections
- Record the PID when this task's `start` reports `spawned: true`
- Never stop a preexisting or shared server. `stop` checks server identity but not task ownership. Use it only when `status` still reports this task's recorded PID and no other task or user uses the server. Otherwise leave it running
- Ensure a frontend tab is connected for screenshots, image export, Mermaid conversion and viewport operations. An available managed local browser can open `http://127.0.0.1:23187`, or the user can open it. CLI exit code 4 means a browser tab is required
- Before editing or replacing a scene that must survive server shutdown, export it as native `.excalidraw`. Named snapshots exist only while the server runs and do not substitute for a durable export
- Do not clear or replace a preexisting scene without approval to discard it. `import scene.excalidraw` merges by default, while `--replace` replaces the scene
- Export the final scene durably with prefixed CLI `export --out scene.excalidraw`. Image export and share links are not native scene backups
- MCP `export_scene` with `filePath` is restricted to the configured `EXCALIDRAW_EXPORT_DIR` or, when unset, the MCP process's working directory. Use CLI export for destinations outside that directory

CLI output is JSON on stdout except `describe` (plain text), `export` without `--out` (raw scene JSON), and SVG screenshot without `--out` (raw SVG). Diagnostics go to stderr. CLI exit codes are 0 success, 1 error, 2 usage, 3 canvas unreachable and 4 browser tab required

## Choose the interface

- Prefer available Excalidraw MCP tools for scene work. Their results and screenshots return directly. Use the live tool schemas for parameters. MCP and CLI share the live canvas, but MCP does not expose the CLI server-start command
- Otherwise use the prefixed CLI. Common subcommands are `start`, `status`, `add elements.json`, `add --one '{...}'`, `apply patch.json`, `get <id>`, `query`, `describe`, `update <id> --set '{...}'`, `screenshot --out scene.png` and `export --out scene.excalidraw`. Input arrays and patches can come from a file or stdin (`-`). Use `help [command]` for other commands and flags
- Use raw HTTP when needed from application code. The server must already be running. Relevant endpoints include `GET /health`, `GET /api/elements`, `POST /api/elements/batch`, `PUT /api/elements/:id` and `POST /api/elements/sync` (overwrite import). Raw REST takes a different format from normalized CLI/MCP input. Image export and viewport endpoints need the frontend

## Native element and patch details

- CLI and MCP normalize an agent-friendly shape such as `{"id":"service","type":"rectangle","x":100,"y":80,"width":180,"height":60,"text":"Service"}` into an Excalidraw shape with a bound label
- For semantic arrows, create endpoint shapes first and pass their IDs as `startElementId` and `endElementId`
- A genuine free annotation pointer intentionally lacks semantic endpoint binding. After the final live export, set `"customData":{"auditRole":"annotation"}` on that arrow in the native `.excalidraw` file before audit and delivery. Do not mark semantic relationships as annotations
- Live create, update and import do not preserve that marker. A later live re-export requires reapplying it to the final native file. The marker is nonvisual, so keep the live rendering and final native visible content consistent
- Pass `fontFamily` as a string name such as `"helvetica"` or a string digit such as `"1"`, not a number. `points` accepts `[[x,y],...]` or `[{"x":x,"y":y},...]`
- A CLI `apply` patch uses `{"create":[...],"update":[{"id":"service","set":{"x":120}}],"delete":["old-id"]}`. An update can instead use direct fields such as `{"id":"service","x":120}`. Do not mix direct fields and `set` in one update entry
- Raw REST requires `"label":{"text":"Service"}` for a bound shape label and `"start":{"id":"a"},"end":{"id":"b"}` for arrow bindings. Do not send the CLI/MCP shorthand directly to REST
- A boundary rectangle with `text` or `label.text` receives a centered bound label that can overlap its contents. Use separate free-standing text at the upper-left of the scope instead:

  ```json
  [
    {"id":"vpc-zone","type":"rectangle","x":50,"y":50,"width":800,"height":400,"backgroundColor":"transparent","strokeColor":"#adb5bd","strokeStyle":"dashed"},
    {"id":"vpc-label","type":"text","x":70,"y":60,"width":300,"height":30,"text":"VPC (10.0.0.0/16)","fontSize":18}
  ]
  ```

- An arrow label appears at its midpoint and may overlap a short route. Inspect the rendering. `{"roundness":{"type":2}}` with three or more points creates a curve, and `{"elbowed":true}` provides right-angle routing when needed
- The frontend's scene sync can create bound text elements for labeled shapes. Inspect native and rendered output rather than inferring a duplicate solely from the element count

## Native audit

When structural checking is warranted or requested, run the audit on the native export. Resolve the script relative to this loaded skill directory:

```bash
python /absolute/path/to/excalidraw-skill/scripts/audit_scene.py scene.excalidraw --mode overview
python /absolute/path/to/excalidraw-skill/scripts/audit_scene.py scene.excalidraw --mode technical --json
```

- Status 0 is clean, 1 blocked, 2 invalid input and 3 review required. The native audit cannot prove rendered readability or semantic completeness
- For explicitly requested completeness or traceability work, see [semantic traceability](semantic-traceability.md) for the optional manifest tool. A manifest is not required for routine diagrams
