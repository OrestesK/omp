import { spawnSync } from "node:child_process";
import { existsSync, watch, type FSWatcher } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PaneDirection, Session, type Pane } from "libtmux";
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";

const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
type ReviewResult = { status: "opened"; feedback: string };
type Review = {
  directory?: string;
  source: string;
  sessionFile: string | undefined;
  ctx: ExtensionContext;
  cancelled: boolean;
  opening: Promise<void>;
  generation: number;
  pane?: Pane;
  watcher?: FSWatcher;
  cancelWait?: () => void;
  cleanup?: Promise<void>;
};

export default function reviewDraftExtension(pi: ExtensionAPI): void {
  const reviews = new Set<Review>();
  let generation = 0;

  function close(review: Review): Promise<void> {
    if (review.cleanup) return review.cleanup;
    review.cancelled = true;
    review.cleanup = (async () => {
      review.watcher?.close();
      review.cancelWait?.();
      try {
        if (review.pane) await review.pane.kill();
      } finally {
        try {
          if (review.directory) await rm(review.directory, { recursive: true });
        } finally {
          reviews.delete(review);
        }
      }
    })();
    return review.cleanup;
  }

  function current(review: Review): boolean {
    return (
      !review.cancelled &&
      review.generation === generation &&
      review.ctx.sessionManager.getSessionFile() === review.sessionFile
    );
  }

  async function finish(
    review: Review,
    snapshot: Buffer,
    before: string,
    copy: string,
    exitPath: string,
  ): Promise<void> {
    try {
      const status = await readFile(exitPath, "utf8");
      if (!current(review)) return;
      if (status !== "0\n") return;
      const edited = await readFile(copy);
      if (!current(review)) return;
      let feedback: string;
      if (snapshot.equals(edited)) {
        feedback = `Reviewed without changes: ${review.source}`;
      } else {
        const diff = spawnSync(
          "/usr/bin/diff",
          [
            "-u",
            "--label",
            `before: ${review.source}`,
            "--label",
            `reviewed: ${review.source}`,
            before,
            copy,
          ],
          { encoding: "utf8" },
        );
        if (diff.error) throw diff.error;
        if (diff.status !== 1)
          throw new Error(
            `Could not compare reviewed draft (diff exit ${diff.status}): ${diff.stderr}`,
          );
        feedback = `Review feedback for ${review.source} (original unchanged). !! comments are user annotations to act on. Follow the feedback section of rules/communication.md.\n\n${diff.stdout}`;
      }
      if (current(review)) pi.sendUserMessage(feedback, { deliverAs: "aside" });
    } catch (error) {
      if (current(review))
        review.ctx.ui.notify(`Draft review failed: ${String(error)}`, "error");
    } finally {
      review.pane = undefined;
      try {
        await close(review);
      } catch (error) {
        if (
          review.generation === generation &&
          review.ctx.sessionManager.getSessionFile() === review.sessionFile
        )
          review.ctx.ui.notify(
            `Draft review cleanup failed: ${String(error)}`,
            "error",
          );
      }
    }
  }

  async function reviewDraft(
    draftPath: string,
    ctx: ExtensionContext,
    signal?: AbortSignal,
  ): Promise<ReviewResult> {
    if (ctx.mode !== "tui" || !ctx.hasUI)
      throw new Error("Draft review requires the interactive OMP terminal.");
    if (!draftPath) throw new Error("Provide a draft path to review.");
    const source = path.resolve(ctx.cwd, draftPath);
    const sessionFile = ctx.sessionManager.getSessionFile();
    const startedGeneration = generation;
    let finishOpening!: () => void;
    const opening = new Promise<void>((resolve) => {
      finishOpening = resolve;
    });
    const review: Review = {
      source,
      sessionFile,
      ctx,
      cancelled: false,
      opening,
      generation: startedGeneration,
    };
    reviews.add(review);
    try {
      const snapshot = await readFile(source);
      const directory = await mkdtemp(path.join(tmpdir(), "omp-review-draft-"));
      review.directory = directory;
      const before = path.join(directory, "snapshot", "draft");
      const copy = path.join(directory, "editable", path.basename(source));
      const exitPath = path.join(directory, "editor-exit");
      const completionName = "editor-complete";
      const completionPath = path.join(directory, completionName);
      await mkdir(path.dirname(before));
      await mkdir(path.dirname(copy));
      await writeFile(before, snapshot);
      await writeFile(copy, snapshot);
      if (!current(review) || signal?.aborted)
        throw new Error("Draft review canceled before opening.");
      const session = await Session.fromEnv();
      const origin = session.panes.one({ id: process.env.TMUX_PANE! });
      let complete!: () => void;
      let fail!: (error: Error) => void;
      let completionError: Error | undefined;
      const completed = new Promise<void>((resolve, reject) => {
        complete = resolve;
        fail = reject;
      });
      void completed.catch(() => {});
      review.watcher = watch(directory);
      review.watcher.on("change", (_event, filename) => {
        if (filename === completionName) complete();
      });
      review.watcher.once("error", (error) => {
        completionError = error;
        fail(error);
      });
      review.cancelWait = () => fail(new Error("Draft review canceled."));
      const onExit = `code=$?; printf '%s\\n' "$code" > ${quote(exitPath)}; : > ${quote(completionPath)}`;
      const script = `trap ${quote("exit 129")} HUP; trap ${quote(onExit)} EXIT; nvim ${quote(copy)}`;
      void completed.then(
        async () => {
          await review.opening;
          await finish(review, snapshot, before, copy, exitPath);
        },
        async (error) => {
          await review.opening;
          if (current(review))
            ctx.ui.notify(`Draft review failed: ${String(error)}`, "error");
          await close(review).catch((cleanupError) =>
            console.error("Draft review cleanup failed:", cleanupError),
          );
        },
      );
      const opened: ReviewResult = {
        status: "opened",
        feedback: `Draft review opened in the right-side Neovim pane for ${source}. Feedback is pending until you save and quit; :cq cancels even after saving. The original draft is unchanged. This review does not approve publication.`,
      };
      try {
        review.pane = await origin.split({
          direction: PaneDirection.Right,
          shellCommand: `sh -c ${quote(script)}`,
        });
        if (!current(review) || signal?.aborted)
          throw new Error("Draft review canceled before opening.");
        await review.pane.select();
        if (!current(review) || signal?.aborted)
          throw new Error("Draft review canceled before opening.");
      } catch (error) {
        if (
          !current(review) ||
          signal?.aborted ||
          completionError ||
          !existsSync(completionPath)
        )
          throw error;
        review.pane = undefined;
        complete();
      }
      return opened;
    } catch (error) {
      try {
        await close(review);
      } catch (cleanupError) {
        if (
          review.generation === generation &&
          ctx.sessionManager.getSessionFile() === sessionFile
        )
          ctx.ui.notify(
            `Draft review cleanup failed: ${String(cleanupError)}`,
            "error",
          );
      }
      throw error;
    } finally {
      finishOpening();
    }
  }

  async function cancelReviews(): Promise<void> {
    generation++;
    const closing = [...reviews].map(async (review) => {
      review.cancelled = true;
      await review.opening;
      await close(review);
    });
    const results = await Promise.allSettled(closing);
    for (const result of results) {
      if (result.status === "rejected")
        console.error("Draft review cleanup failed:", result.reason);
    }
  }
  pi.on("session_before_switch", cancelReviews);
  pi.on("session_shutdown", cancelReviews);

  pi.registerTool({
    name: "review_draft",
    label: "Review draft in Neovim",
    description:
      "Open a copy of a file for the user to review and optionally annotate.",
    parameters: pi.typebox.Type.Object({
      path: pi.typebox.Type.String({
        description: "Path to the draft to review",
      }),
    }),
    async execute(_toolCallId, { path: draftPath }, signal, _onUpdate, ctx) {
      const result = await reviewDraft(draftPath, ctx, signal);
      return {
        content: [{ type: "text" as const, text: result.feedback }],
        details: { status: result.status },
      };
    },
  });

  pi.registerCommand("review-draft", {
    description:
      "Open a right-side Neovim pane for draft review; feedback arrives asynchronously",
    async handler(args, ctx) {
      const result = await reviewDraft(args.trim(), ctx);
      ctx.ui.notify(result.feedback, "info");
    },
  });
}
