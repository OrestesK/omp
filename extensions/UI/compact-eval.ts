import { Text } from "@oh-my-pi/pi-tui";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import {
  toolRenderers,
  type RenderResultOptions,
  type ToolRenderResult,
  type ToolRenderer,
} from "@oh-my-pi/pi-tui/tools";
import type { EvalStatusEvent, EvalToolDetails } from "@oh-my-pi/pi-tui/tools/eval";
import type { Theme } from "@oh-my-pi/pi-tui/theme";

// Tweak these to adjust the compact presentation without touching renderer logic.
const VIEW = {
  maxCollapsedRows: 3,
  maxCollapsedChildren: 5,
  maxSummaryLength: 120,
  indent: "  ",
  branch: { middle: "├ ", last: "└ " },
  spinner: ["◐", "◓", "◑", "◒"],
  done: "●",
  error: "×",
  actionColor: "accent",
  detailColor: "toolOutput",
  metaColor: "dim",
} as const;

interface EvalArgs {
  language?: string;
  code?: string;
  title?: string;
  cells?: Array<{ language?: string; code?: string; title?: string }>;
}

interface ActivitySummary {
  key?: string;
  action: string;
  operation?: string;
  target?: string;
  outcome?: string;
  detail?: string;
  meta?: string;
  error: boolean;
  children?: ActivitySummary[];
}

type EvalResult = ToolRenderResult<EvalToolDetails>;

interface NestedActivity {
  op: string;
  chars: number;
  range?: string;
  label: string;
  operation?: string;
  target?: string;
  outcome?: string;
  hasError?: boolean;
  error?: string;
  key?: string;
  children?: ActivitySummary[];
}

interface EvalCapture {
  toolCallId: string;
  activities: NestedActivity[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function textContent(content: ReadonlyArray<{ type: string; text?: string }>): string {
  return content
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

function cleanLine(value: unknown): string {
  return typeof value === "string"
    ? value
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/gu, "")
        .replace(/\s+/gu, " ")
        .trim()
    : "";
}

function shorten(value: string, limit: number = VIEW.maxSummaryLength): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function shortenPath(value: unknown): string {
  const path = cleanLine(value);
  const home = process.env.HOME;
  return home && (path === home || path.startsWith(`${home}/`))
    ? `~${path.slice(home.length)}`
    : path;
}


function count(value: unknown, noun: string): string {
  return typeof value === "number"
    ? `${value.toLocaleString()} ${noun}${value === 1 ? "" : "s"}`
    : "";
}
function lineRange(offset: unknown, limit: unknown): string {
  const start =
    typeof offset === "number" && Number.isInteger(offset) && offset > 0 ? offset : undefined;
  const length =
    typeof limit === "number" && Number.isInteger(limit) && limit > 0 ? limit : undefined;
  if (start === undefined && length === undefined) return "";

  const first = start ?? 1;
  return length === undefined ? String(first) + "+" : first + "-" + (first + length - 1);
}

function durationText(value: unknown): string {
  if (typeof value !== "number" || value <= 0) return "";
  if (value < 1000) return "";
  if (value < 10_000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value / 1000)}s`;
}

function sentence(value: string): string {
  const words = value
    .replace(/^mcp__/u, "")
    .replace(/[_-]+/gu, " ")
    .trim();
  return words ? `${words[0].toUpperCase()}${words.slice(1)}` : "Operation";
}

function detailText(value: unknown): string {
  if (typeof value === "string") return cleanLine(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (!value || typeof value !== "object") return "";
  return Object.values(value)
    .map((item) => detailText(item))
    .filter(Boolean)
    .join(" · ");
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

const SAFE_EXCERPT_KEYS = new Set([
  "action",
  "operation",
  "op",
  "query",
  "path",
  "name",
  "repo",
  "symbol",
  "pattern",
  "url",
  "file",
  "branch",
  "ref",
  "model",
  "tier",
  "from",
  "to",
  "target",
]);

function primitiveExcerpt(value: unknown): string {
  if (!isRecord(value)) return "";
  return Object.entries(value)
    .filter(
      ([key, item]) =>
        SAFE_EXCERPT_KEYS.has(key) &&
        (typeof item === "string" || typeof item === "number" || typeof item === "boolean"),
    )
    .slice(0, 3)
    .map(([key, item]) => sentence(key) + " " + cleanLine(item))
    .join(" · ");
}

function summary(action: string, detail = "", meta = "", error = false): ActivitySummary {
  return {
    action: shorten(action),
    detail: detail ? shorten(detail) : undefined,
    meta: meta ? shorten(meta) : undefined,
    error,
  };
}

function semanticSummary(
  action: string,
  operation: string,
  target: string,
  outcome: string,
): ActivitySummary {
  return {
    action: shorten(action),
    operation: operation ? shorten(operation) : undefined,
    target: target ? shorten(target) : undefined,
    outcome: outcome ? shorten(outcome) : undefined,
    error: false,
  };
}

function summaryKey(value: ActivitySummary): string {
  if (value.key) return value.key;
  return [
    value.action,
    value.operation,
    value.target,
    value.detail,
    value.outcome,
    value.meta,
    value.error,
  ].join("\0");
}

function firstResultLine(text: string): string {
  const line = text
    .split("\n")
    .map((value) => value.trim())
    .find(
      (value) =>
        value &&
        !value.startsWith(String.fromCharCode(96).repeat(3)) &&
        !value.startsWith("<task-result") &&
        !/\b(?:automatically delivered|auto-deliver|do not poll|will be injected)\b/iu.test(value),
    );
  return shorten(cleanLine(line?.replace(/^#{1,6}\s+/u, "")), 160);
}

function childSummary(
  key: string,
  action: string,
  detail: string,
  meta = "",
  error = false,
): ActivitySummary {
  return { ...summary(action, detail, meta, error), key };
}

function taskChildren(details: unknown): ActivitySummary[] {
  if (!isRecord(details)) return [];
  const progress = records(details.progress);
  const results = records(details.results);
  const byId = new Map<string, ActivitySummary>();
  for (const [index, item] of [...progress, ...results].entries()) {
    const id = cleanLine(item.id ?? item.agentId ?? item.label) || "agent-" + (index + 1);
    const agent = cleanLine(item.agent ?? item.agentName ?? item.type);
    const terminalFailure =
      item.aborted === true ||
      (typeof item.exitCode === "number" && item.exitCode !== 0) ||
      Boolean(item.error);
    const status =
      cleanLine(item.status) ||
      (results.includes(item) ? (terminalFailure ? "failed" : "completed") : "running");
    const failed = /^(?:failed|error|aborted|cancelled)$/iu.test(status) || terminalFailure;
    const tool = cleanLine(item.currentTool);
    const intent = cleanLine(
      item.lastIntent ?? item.currentToolArgs ?? item.assignment ?? item.description,
    );
    const current = [tool && sentence(tool), intent].filter(Boolean).join(" · ");
    const tools = typeof item.toolCount === "number" ? count(item.toolCount, "tool") : "";
    const elapsed = durationText(item.durationMs);
    const failure = failed
      ? shorten(detailText(item.error ?? item.abortReason ?? item.stderr ?? item.output), 100)
      : "";
    const identity = [id, agent && "‹" + agent + "›"].filter(Boolean).join(" ");
    const activity = [status, current && "— " + current].filter(Boolean).join(" ");
    const detail = [identity, activity, failure && "— " + failure]
      .filter(Boolean)
      .join(" · ");
    byId.set(
      id,
      childSummary(
        "agent:" + id,
        "Agent",
        detail,
        [tools, elapsed].filter(Boolean).join(" · "),
        failed,
      ),
    );
  }
  return [...byId.values()];
}

function waitChildren(details: unknown): ActivitySummary[] {
  if (!isRecord(details)) return [];
  const jobs = records(details.jobs);
  const agents = records(details.agents);
  const children = jobs.map((item, index) => {
    const id = cleanLine(item.id) || "job-" + (index + 1);
    const status = cleanLine(item.status) || "unknown";
    const errorText = detailText(item.errorText);
    const resultText = detailText(item.resultText);
    const failed = /^(?:failed|error|aborted|cancelled)$/iu.test(status) || Boolean(errorText);
    const current = cleanLine(item.label);
    const excerpt = shorten(errorText || resultText, 100);
    const activity = [status, current && "— " + current].filter(Boolean).join(" ");
    const detail = [id, activity, excerpt && (failed ? "— " : "→ ") + excerpt]
      .filter(Boolean)
      .join(" · ");
    return childSummary(
      "job:" + id,
      "Job",
      detail,
      [cleanLine(item.type), durationText(item.durationMs)].filter(Boolean).join(" · "),
      failed,
    );
  });
  for (const [index, item] of agents.entries()) {
    const id = cleanLine(item.id) || "agent-" + (index + 1);
    const status = item.live === true
      ? "running"
      : typeof item.acceptedAt === "number"
        ? "accepted"
        : "pending";
    const activity = cleanLine(item.activity);
    children.push(
      childSummary(
        "agent:" + id,
        "Agent",
        [id, status, activity && "— " + activity].filter(Boolean).join(" · "),
        durationText(item.ageMs),
      ),
    );
  }
  return children;
}

function structuredOutcome(toolName: string, details: unknown): string {
  if (!isRecord(details)) return "";
  if (toolName === "bash") {
    if (details.timedOut === true) return "timed out";
    if (typeof details.exitCode === "number") return "exit " + details.exitCode;
  }
  if (toolName === "web_search") {
    const sources = records(details.sources).length;
    if (sources > 0) return count(sources, "source");
  }
  if (toolName === "wait") {
    const waited = details.waited;
    if (isRecord(waited)) {
      const from = cleanLine(waited.from);
      const body = shorten(cleanLine(waited.body), 100);
      return [from && "from " + from, body].filter(Boolean).join(" · ");
    }
    if (details.interrupted === true) return "interrupted";
  }
  const value = details.summary ?? details.message ?? details.status ?? details.state ?? details.result;
  return typeof value === "string" || typeof value === "number"
    ? shorten(cleanLine(value), 120)
    : "";
}

function toolActivity(
  toolName: string,
  input: Record<string, unknown>,
  details: unknown,
  text: string,
  isError: boolean,
): NestedActivity {
  const normalizedOp = toolName === "bash" ? "run" : toolName;
  let label: string;
  let operation = "";
  let target = "";
  let children: ActivitySummary[] | undefined;

  if (toolName === "task") {
    label = "Task";
    children = taskChildren(details);
    operation = cleanLine(input.agent ?? input.label);
    target = children.length > 0
      ? count(children.length, "agent")
      : count(records(input.tasks).length, "task");
  } else if (toolName === "wait") {
    label = "Wait";
    children = waitChildren(details);
    if (isRecord(details)) {
      const jobs = records(details.jobs).length;
      const agents = records(details.agents).length;
      target = [jobs > 0 && count(jobs, "job"), agents > 0 && count(agents, "agent")]
        .filter(Boolean)
        .join(" · ");
    }
    if (!target) target = "background result";
  } else if (toolName.startsWith("mcp__")) {
    const [server = "MCP", ...operationParts] = toolName.slice(5).split("_");
    label = sentence(server);
    operation = cleanLine(operationParts.join(" "));
  } else if (toolName === "edit") {
    const summary = toolRenderers.edit.activitySummary?.(input, {
      expanded: false,
      isPartial: false,
      renderContext: typeof input.input === "string" ? { editMode: "hashline" } : undefined,
    });
    label = summary?.label ?? "Edit";
    target = cleanLine(summary?.detail);
  } else {
    label = toolName === "lsp" ? "LSP" : toolName === "github" ? "GitHub" : sentence(toolName);
    operation = cleanLine(input.action ?? input.operation ?? input.op).replace(/[_-]+/gu, " ");
    target = cleanLine(
      input.symbol ??
        input.query ??
        input.path ??
        input.name ??
        input.repo ??
        input.pattern ??
        input.command ??
        input.url ??
        input.file ??
        input.branch ??
        input.ref,
    );
  }

  const error = isError ? shorten(cleanLine(text), 500) : undefined;
  const typedOutcome = structuredOutcome(toolName, details);
  const genericInput = primitiveExcerpt(input);
  const allowTextFallback = toolName.startsWith("mcp__") || !isRecord(details);
  const identity = cleanLine(input.id ?? input.name);
  return {
    op: normalizedOp,
    chars: text.length,
    label,
    operation: operation || undefined,
    target: target || (genericInput ? shorten(genericInput, 120) : undefined),
    outcome: isError
      ? undefined
      : typedOutcome || (allowTextFallback ? firstResultLine(text) : "") || undefined,
    range: toolName === "read" ? lineRange(input.offset, input.limit) || undefined : undefined,
    key: identity ? normalizedOp + ":" + identity : undefined,
    children,
    ...(isError ? { hasError: true, error: error || "Failed" } : {}),
  };
}

interface ActivityCursor {
  byOp: Map<string, number>;
}

function enrichEventList(
  events: EvalStatusEvent[] | undefined,
  activities: NestedActivity[],
  cursor: ActivityCursor,
): EvalStatusEvent[] | undefined {
  if (!events) return undefined;
  return events.map((event) => {
    const op = cleanLine(event.op);
    const matches = activities.filter((activity) => activity.op === op);
    const offset = cursor.byOp.get(op) ?? 0;
    const activity = matches[offset];
    if (!activity) return event;
    cursor.byOp.set(op, offset + 1);
    return { ...activity, ...event, children: event.children ?? activity.children };
  });
}

function enrichDetails(details: EvalToolDetails, activities: NestedActivity[]): EvalToolDetails {
  const topCursor: ActivityCursor = { byOp: new Map() };
  const cellCursor: ActivityCursor = { byOp: new Map() };
  return {
    ...details,
    statusEvents: enrichEventList(details.statusEvents, activities, topCursor),
    cells: details.cells?.map((cell) => ({
      ...cell,
      statusEvents: enrichEventList(cell.statusEvents, activities, cellCursor),
    })),
  };
}

function baseEventSummary(event: EvalStatusEvent): ActivitySummary {
  const op = cleanLine(event.op);
  const error = cleanLine(event.error);
  const path = shortenPath(event.path) || shortenPath(event.target);
  const hasError = event.hasError === true || Boolean(error);
  if (hasError) {
    const detail = [path, error || "Failed"].filter(Boolean).join(" · ");
    return summary(sentence(cleanLine(event.label) || op), detail, "", true);
  }
  const chars = count(event.chars, "char");
  const matches = count(event.count, op === "glob" ? "file" : "match");

  switch (op) {
    case "read": {
      const range = cleanLine(event.range);
      const target = path || "File";
      return summary("Read", range ? target + ":" + range : target, chars);
    }
    case "write":
      return summary("Write", path || "File", chars);
    case "edit": {
      const detail = path || detailText(event.detail) || "File";
      const outcome = cleanLine(event.outcome);
      return summary(
        "Edit",
        [detail, outcome && outcome !== detail ? "→ " + outcome : ""].filter(Boolean).join(" "),
      );
    }
    case "grep": {
      const pattern = cleanLine(event.pattern);
      return summary(
        "Search",
        [pattern && `“${pattern}”`, path && `in ${path}`].filter(Boolean).join(" "),
        matches,
      );
    }
    case "glob": {
      const pattern = cleanLine(event.pattern);
      return summary("Find", pattern ? `“${pattern}”` : "Files", matches);
    }
    case "run": {
      const command = cleanLine(event.cmd ?? event.target);
      const exit =
        typeof event.code === "number" ? "exit " + event.code : cleanLine(event.outcome);
      return summary("Run", command || "Command", exit);
    }
    case "agent": {
      const id = cleanLine(event.id) || "agent";
      const status = cleanLine(event.status) || "running";
      const currentTool = cleanLine(event.currentTool);
      const currentIntent = cleanLine(
        event.lastIntent ?? event.currentToolArgs ?? event.taskPreview,
      );
      const current = [currentTool && sentence(currentTool), currentIntent]
        .filter(Boolean)
        .join(" · ");
      const tools =
        typeof event.toolCount === "number" && event.toolCount > 0
          ? count(event.toolCount, "tool")
          : "";
      const elapsed = durationText(event.durationMs);
      return summary(
        "Agent",
        `${id} · ${status}${current ? ` — ${current}` : ""}`,
        [tools, elapsed].filter(Boolean).join(" · "),
      );
    }
    case "judge_batch": {
      const id = cleanLine(event.id) || "batch";
      const progress = typeof event.total === "number" ? `${event.done ?? 0}/${event.total}` : "";
      const failed =
        typeof event.failed === "number" && event.failed > 0 ? `${event.failed} failed` : "";
      return summary(
        "Judge",
        [id, progress].filter(Boolean).join(" · "),
        [failed, cleanLine(event.model)].filter(Boolean).join(" · "),
      );
    }
    case "workpool": {
      const action = cleanLine(event.action);
      const pool = cleanLine(event.pool);
      return summary(
        "Pool",
        [action, pool].filter(Boolean).join(" "),
        count(event.count, action === "create" ? "agent" : "item"),
      );
    }
    case "completion":
      return summary(
        "Model",
        [cleanLine(event.model), cleanLine(event.tier)].filter(Boolean).join(" · "),
        chars,
      );
    case "env": {
      const action = cleanLine(event.action);
      const key = cleanLine(event.key);
      return summary(
        "Env",
        [action, key].filter(Boolean).join(" "),
        count(event.count, "variable"),
      );
    }
    case "log":
      return summary("Log", cleanLine(event.message));
    case "phase":
      return summary("Phase", cleanLine(event.title));
    case "git_status":
      return summary(
        "Git",
        event.clean === true ? "Working tree clean" : cleanLine(event.branch) || "Status",
      );
    case "git_log":
      return summary("Git", "Log", count(event.commits, "commit"));
    case "git_diff":
      return summary("Git", event.staged ? "Staged diff" : "Diff", count(event.lines, "line"));
    default: {
      const action = cleanLine(event.label) || sentence(op);
      const operation = cleanLine(event.operation);
      const target = cleanLine(event.target);
      const outcome = cleanLine(event.outcome);
      const detail = detailText(event.detail);
      const semanticTarget = target || detail;
      if (operation || target || outcome) {
        return semanticSummary(
          action,
          operation,
          semanticTarget,
          outcome !== semanticTarget ? outcome : "",
        );
      }
      return summary(action, detail, !detail ? chars : "");
    }
  }
}
function eventSummary(event: EvalStatusEvent): ActivitySummary {
  const base = baseEventSummary(event);
  const children = records(event.children).map((item, index) => ({
    key: cleanLine(item.key) || "child:" + index,
    action: shorten(cleanLine(item.action) || "Item"),
    operation: shorten(cleanLine(item.operation)) || undefined,
    target: shorten(cleanLine(item.target)) || undefined,
    outcome: shorten(cleanLine(item.outcome)) || undefined,
    detail: shorten(cleanLine(item.detail)) || undefined,
    meta: shorten(cleanLine(item.meta)) || undefined,
    error: item.error === true,
  }));
  const op = cleanLine(event.op);
  const identity = cleanLine(event.key ?? event.id ?? event.pool);
  const key = identity ? (identity.includes(":") ? identity : op + ":" + identity) : undefined;
  return {
    ...base,
    key,
    error: base.error || children.some((child) => child.error),
    children: children.length > 0 ? children : undefined,
  };
}

function eventsOf(details: EvalToolDetails | undefined): EvalStatusEvent[] {
  const cellEvents = details?.cells?.flatMap((cell) => cell.statusEvents ?? []) ?? [];
  return cellEvents.length > 0 ? cellEvents : (details?.statusEvents ?? []);
}

function resultText(result: EvalResult): string {
  return result.content
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("\n")
    .trimEnd();
}

function totalDuration(details: EvalToolDetails | undefined): string {
  return durationText(details?.cells?.reduce((total, cell) => total + (cell.durationMs ?? 0), 0));
}

function titleOf(args: EvalArgs | undefined): string {
  const title = cleanLine(args?.title ?? args?.cells?.[0]?.title);
  if (title) return title;
  return (args?.language ?? args?.cells?.[0]?.language) === "js" ? "JavaScript" : "Python";
}

function header(
  args: EvalArgs | undefined,
  details: EvalToolDetails | undefined,
  options: RenderResultOptions,
  theme: Theme,
  isError: boolean,
  phase?: "Preparing" | "Running",
): string {
  const spinnerIndex = (options.spinnerFrame ?? 0) % VIEW.spinner.length;
  const icon = isError ? VIEW.error : options.isPartial ? VIEW.spinner[spinnerIndex] : VIEW.done;
  const color = isError ? "error" : "accent";
  const elapsed = totalDuration(details);
  const title = titleOf(args);
  return [
    theme.fg(color, icon),
    theme.fg("accent", theme.bold(phase ? phase + " · " + title : title)),
    elapsed && theme.fg(VIEW.metaColor, `· ${elapsed}`),
  ]
    .filter(Boolean)
    .join(" ");
}

function fallbackSummary(
  result: EvalResult,
  isError: boolean,
  isPartial: boolean,
): ActivitySummary {
  const firstLine = resultText(result)
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  if (isError) return summary("Error", firstLine || "Eval failed", "", true);
  if (firstLine === "[object Object]") return summary("Structured output");
  if (isPartial) return firstLine ? summary("Output", firstLine) : summary("Waiting for output");
  return firstLine ? summary("Output", firstLine) : summary("No output");
}

function renderSummary(value: ActivitySummary, theme: Theme): string {
  const actionColor = value.error ? "error" : VIEW.actionColor;
  const detailColor = VIEW.detailColor;
  return [
    theme.fg(actionColor, value.action),
    value.operation && theme.fg(detailColor, theme.bold(value.operation)),
    value.target && theme.fg(detailColor, value.target),
    value.detail && theme.fg(detailColor, value.detail),
    value.outcome && `${theme.fg(VIEW.metaColor, "→")} ${theme.fg(detailColor, value.outcome)}`,
    value.meta && theme.fg(VIEW.metaColor, `· ${value.meta}`),
  ]
    .filter(Boolean)
    .join(" ");
}
function renderChildren(
  value: ActivitySummary,
  theme: Theme,
  expanded: boolean,
  indent: string,
): string[] {
  const children = value.children ?? [];
  const shown = expanded ? children : children.slice(0, VIEW.maxCollapsedChildren);
  const lines = shown.map((child, index) => {
    const hasOverflow = !expanded && children.length > shown.length;
    const branch = index === shown.length - 1 && !hasOverflow ? VIEW.branch.last : VIEW.branch.middle;
    return indent + theme.fg(VIEW.metaColor, branch) + renderSummary(child, theme);
  });
  if (!expanded && children.length > shown.length) {
    lines.push(
      indent +
        theme.fg(VIEW.metaColor, VIEW.branch.last + "+" + (children.length - shown.length) + " more"),
    );
  }
  return lines;
}

function renderCollapsed(
  result: EvalResult,
  options: RenderResultOptions,
  theme: Theme,
  args?: EvalArgs,
): Text {
  const details = result.details;
  const isError = result.isError === true || details?.isError === true;
  const summaries = eventsOf(details).map(eventSummary);
  const unique = summaries.filter((value, index, all) => {
    const key = summaryKey(value);
    return all.findLastIndex((candidate) => summaryKey(candidate) === key) === index;
  });
  if (unique.length === 0) unique.push(fallbackSummary(result, isError, options.isPartial));

  const shown = unique.slice(-VIEW.maxCollapsedRows);
  const hiddenError = unique.slice(0, -VIEW.maxCollapsedRows).findLast((value) => value.error);
  if (hiddenError && !shown.some((value) => value.error)) shown[0] = hiddenError;

  const lines = [
    header(args, details, options, theme, isError, options.isPartial ? "Running" : undefined),
  ];
  for (const [index, value] of shown.entries()) {
    const branch = index === shown.length - 1 ? VIEW.branch.last : VIEW.branch.middle;
    lines.push(VIEW.indent + theme.fg(VIEW.metaColor, branch) + renderSummary(value, theme));
    lines.push(...renderChildren(value, theme, false, VIEW.indent + VIEW.indent));
  }
  if (unique.length > shown.length) {
    lines.push(
      `${VIEW.indent}${theme.fg(VIEW.metaColor, `… ${unique.length - shown.length} earlier (ctrl+o to expand)`)}`,
    );
  }
  return new Text(lines.join("\n"), 0, 0);
}

function renderExpanded(
  result: EvalResult,
  options: RenderResultOptions,
  theme: Theme,
  args?: EvalArgs,
): Text {
  const details = result.details;
  const isError = result.isError === true || details?.isError === true;
  const lines = [
    header(args, details, options, theme, isError, options.isPartial ? "Running" : undefined),
  ];
  const sources = args?.cells?.length
    ? args.cells
    : args?.code !== undefined
      ? [{ code: args.code, language: args.language, title: args.title }]
      : (details?.cells ?? []);
  const output = resultText(result);
  const events = eventsOf(details).map(eventSummary);

  if (sources.length === 0) {
    lines.push(theme.fg(VIEW.metaColor, `${VIEW.indent}Source`));
    lines.push(`${VIEW.indent}${theme.fg(VIEW.metaColor, "No source")}`);
  } else {
    for (const [index, source] of sources.entries()) {
      const label = sources.length === 1 ? "Source" : `Source ${index + 1}/${sources.length}`;
      const language = source.language ?? args?.language ?? details?.language ?? "py";
      const sourceTitle = cleanLine(source.title);
      lines.push(
        theme.fg(
          VIEW.metaColor,
          `${VIEW.indent}${label} · ${language}${sourceTitle ? ` · ${sourceTitle}` : ""}`,
        ),
      );
      lines.push(
        ...(source.code
          ? source.code
              .split("\n")
              .map((line) => `${VIEW.indent}${theme.fg(VIEW.detailColor, line)}`)
          : [`${VIEW.indent}${theme.fg(VIEW.metaColor, "No source")}`]),
      );
    }
  }
  lines.push(theme.fg(VIEW.metaColor, `${VIEW.indent}Output`));
  lines.push(
    ...(output
      ? output
          .split("\n")
          .map((line) => `${VIEW.indent}${theme.fg(isError ? "error" : VIEW.detailColor, line)}`)
      : [`${VIEW.indent}${theme.fg(VIEW.metaColor, "No output")}`]),
  );
  if (events.length > 0) {
    lines.push(theme.fg(VIEW.metaColor, `${VIEW.indent}Activity`));
    for (const event of events) {
      lines.push(VIEW.indent + renderSummary(event, theme));
      lines.push(...renderChildren(event, theme, true, VIEW.indent + VIEW.indent));
    }
  }
  return new Text(lines.join("\n"), 0, 0);
}

const compactEvalRenderer = {
  inline: true,
  mergeCallAndResult: true,
  animatedPendingPreview: true,
  animatedPartialResult: true,
  activitySummary(args: EvalArgs) {
    return { label: titleOf(args) };
  },
  renderCall(args: EvalArgs, options: RenderResultOptions, theme: Theme) {
    return new Text(
      header(args, undefined, { ...options, isPartial: true }, theme, false, "Preparing"),
      0,
      0,
    );
  },
  renderResult(result: EvalResult, options: RenderResultOptions, theme: Theme, args?: EvalArgs) {
    return options.expanded
      ? renderExpanded(result, options, theme, args)
      : renderCollapsed(result, options, theme, args);
  },
} satisfies ToolRenderer<EvalArgs, EvalToolDetails>;

export default function compactEvalExtension(pi: ExtensionAPI) {
  // Eval is exclusive within a session, so nested tool results have one unambiguous owner.
  let capture: EvalCapture | undefined;

  pi.on("tool_call", (event) => {
    if (event.toolName === "eval") capture = { toolCallId: event.toolCallId, activities: [] };
  });

  pi.on("tool_result", (event) => {
    if (event.toolName === "eval" && capture?.toolCallId === event.toolCallId) {
      const completed = capture;
      capture = undefined;
      return isRecord(event.details) && completed.activities.length > 0
        ? {
            details: enrichDetails(event.details as EvalToolDetails, completed.activities),
            isError: event.isError,
          }
        : undefined;
    }

    if (!capture) return;
    const text = textContent(event.content);
    capture.activities.push(
      toolActivity(event.toolName, event.input, event.details, text, event.isError),
    );
  });

  toolRenderers.eval = compactEvalRenderer;
}
