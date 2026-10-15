/**
 * The voice half of the Skippy bundle: when the personas dropdown picks
 * Skippy, make sure the trained voice is listening on 127.0.0.1:8911 — start
 * it from SKIPPY_HOME if not. Other personas do not touch it.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const HEALTH_URL = "http://127.0.0.1:8911/health";

/** Config the voice reads as well; the single point of truth for where the private assets live. */
export function skippyHome(): string {
  return process.env.SKIPPY_HOME ?? join(process.env.HOME ?? "/home/jimmy", "src/skippy-voice.worktrees/pipeline-scaffold");
}

async function healthy(): Promise<boolean> {
  try {
    const response = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(3_000) });
    return response.ok;
  } catch {
    return false;
  }
}

/** One launch per extension lifetime: the GPU model takes ~40 s to load. */
export function ensureVoiceServe(): Promise<"alive" | "started" | "missing-env" | "starting"> {
  const serve = spawn(
    "nohup",
    [
      join(skippyHome(), ".venv-serve/bin/python"),
      "-c",
      "from skippy_voice.serve import run; run()",
    ],
    {
      cwd: skippyHome(),
      env: { ...process.env, PYTHONPATH: "src" },
      detached: true,
      stdio: ["ignore", "ignore", "ignore"],
    },
  );
  serve.unref();
  return Promise.resolve("started");
}

export async function ensureSkippyVoice(): Promise<"alive" | "started" | "missing-env"> {
  if (await healthy()) return "alive";
  const venv = join(skippyHome(), ".venv-serve", "bin", "python");
  const checkpoints = join(skippyHome(), "checkpoints-zh", "skippy_zh-e15.ckpt");
  if (!existsSync(venv) || !existsSync(checkpoints)) return "missing-env";
  return ensureVoiceServe();
}
