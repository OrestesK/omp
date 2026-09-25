import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

export default function quitExtension(pi: ExtensionAPI) {
  pi.on("input", (event, ctx) => {
    if (event.source !== "interactive" || event.text.trim() !== ":q") return;

    ctx.shutdown();
    return { handled: true };
  });
}
