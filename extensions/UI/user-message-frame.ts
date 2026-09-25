import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

const CAPTION = " USER ";
const BACKGROUND_RESET = "[49m";
const ORIGINAL_ADD_CHILD = Symbol.for("omp.user-message-frame.original-add-child");
const ORIGINAL_RENDER = Symbol.for("omp.user-message-frame.original-render");

interface ThemeLike {
  fg(color: "mdLink", text: string): string;
  bold(text: string): string;
  getBgAnsi(color: "userMessageBg"): string;
}

interface UserMessageLike {
  render: UserMessageRender;
  setReaction(emoji: string): void;
}

type UserMessageRender = (this: UserMessageLike, width: number) => readonly string[];
type AddChild = (this: object, component: unknown) => void;

interface CachedFrame {
  source: readonly string[];
  divider: string;
  background: string;
  result: readonly string[];
}

function divider(theme: ThemeLike, width: number): string {
  width = Math.max(1, width);
  if (width < CAPTION.length) return theme.fg("mdLink", "─".repeat(width));
  const fill = width - CAPTION.length;
  const left = Math.floor(fill / 2);
  return (
    theme.fg("mdLink", "─".repeat(left)) +
    theme.bold(theme.fg("mdLink", CAPTION)) +
    theme.fg("mdLink", "─".repeat(fill - left))
  );
}

function removeUserBackground(row: string, background: string): string {
  if (background === BACKGROUND_RESET) return row;

  const transparent = row.replaceAll(background, "");
  const outerReset = transparent.lastIndexOf(BACKGROUND_RESET);
  if (outerReset === -1) return transparent;

  return transparent.slice(0, outerReset) + transparent.slice(outerReset + BACKGROUND_RESET.length);
}

function frameUserMessage(
  component: unknown,
  theme: ThemeLike,
  cache: WeakMap<UserMessageLike, CachedFrame>,
): void {
  if (typeof component !== "object" || component === null) return;

  const message = component as UserMessageLike;
  if (typeof message.render !== "function" || typeof message.setReaction !== "function") return;

  const stored = message as unknown as Record<symbol, UserMessageRender | undefined>;
  const originalRender = stored[ORIGINAL_RENDER] ?? message.render;
  if (!stored[ORIGINAL_RENDER]) {
    Object.defineProperty(message, ORIGINAL_RENDER, { value: originalRender });
  }

  message.render = function renderUserMessageFrame(width: number): readonly string[] {
    const source = originalRender.call(this, width);
    if (source.length === 0) return source;

    const rule = divider(theme, width);
    const background = theme.getBgAnsi("userMessageBg");
    const cached = cache.get(this);
    if (cached?.source === source && cached.divider === rule && cached.background === background) return cached.result;

    const result = [rule, ...source.map(row => removeUserBackground(row, background)), rule];
    cache.set(this, { source, divider: rule, background, result });
    return result;
  };
}

export default function userMessageFrameExtension(pi: ExtensionAPI) {
  // Use the runtime-provided Container constructor. Importing pi-tui directly
  // creates a second module instance beside OMP's bundled UI classes.
  const Container = pi.pi.Container as unknown as { prototype: { addChild: AddChild } };
  const prototype = Container.prototype;
  const stored = prototype as unknown as Record<symbol, AddChild | undefined>;
  const originalAddChild = stored[ORIGINAL_ADD_CHILD] ?? prototype.addChild;
  if (!stored[ORIGINAL_ADD_CHILD]) {
    Object.defineProperty(prototype, ORIGINAL_ADD_CHILD, { value: originalAddChild });
  }

  const theme = pi.pi.theme as ThemeLike;
  const cache = new WeakMap<UserMessageLike, CachedFrame>();

  // Ordinary user messages have no renderer hook. Intercept components as the
  // chat adds them, then wrap the one component implementing ReactionTarget.
  prototype.addChild = function addFramedUserMessage(component: unknown): void {
    frameUserMessage(component, theme, cache);
    originalAddChild.call(this, component);
  };
}
