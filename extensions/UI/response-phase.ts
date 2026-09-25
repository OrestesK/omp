import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";

const WAITING_UPDATE_MS = 250;

type Phase = "idle" | "waiting" | "thinking" | "streaming" | "preparing-tool" | "native-tool";

export default function responsePhaseExtension(pi: ExtensionAPI) {
  let phase: Phase = "idle";
  let waitingTimer: NodeJS.Timeout | undefined;
  let waitingGeneration = 0;

  const canRender = (ctx: ExtensionContext) => ctx.mode === "tui" && ctx.hasUI;

  const stopWaiting = () => {
    waitingGeneration++;
    if (waitingTimer) {
      clearInterval(waitingTimer);
      waitingTimer = undefined;
    }
  };

  const showPhase = (ctx: ExtensionContext, next: Phase, message?: string) => {
    if (phase === next) return;
    stopWaiting();
    phase = next;
    if (canRender(ctx)) ctx.ui.setWorkingMessage(message);
  };

  pi.on("before_provider_request", (_event, ctx) => {
    stopWaiting();
    phase = "waiting";
    if (!canRender(ctx)) return;

    const generation = waitingGeneration;
    const startedAt = Date.now();
    const render = () => {
      if (generation !== waitingGeneration || phase !== "waiting") return;
      ctx.ui.setWorkingMessage(`Waiting · ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
    };

    render();
    waitingTimer = setInterval(render, WAITING_UPDATE_MS);
    waitingTimer.unref?.();
  });

  pi.on("message_update", (event, ctx) => {
    const update = event.assistantMessageEvent;

    if (update.type === "thinking_delta" && update.delta.length > 0) {
      showPhase(ctx, "thinking");
    } else if (update.type === "text_delta" && update.delta.length > 0) {
      showPhase(ctx, "streaming", "Streaming…");
    } else if (update.type === "toolcall_start") {
      showPhase(ctx, "preparing-tool", "Preparing tool…");
    }
  });

  pi.on("tool_execution_start", (event, ctx) => {
    stopWaiting();
    phase = "native-tool";
    if (!canRender(ctx)) return;

    const intent = typeof event.intent === "string" ? event.intent.trim().replace(/\s*\.+$/, "").trim() : "";
    ctx.ui.setWorkingMessage(intent || undefined);
  });

  const reset = (_event: unknown, ctx: ExtensionContext) => {
    stopWaiting();
    phase = "idle";
    if (canRender(ctx)) ctx.ui.setWorkingMessage();
  };

  pi.on("agent_end", reset);
  pi.on("session_shutdown", reset);
}
