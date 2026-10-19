/**
 * The voice half of the Skippy bundle: the voice server's lifetime follows
 * the personas dropdown. Skippy picked: make sure the trained voice is
 * listening on 127.0.0.1:8911, starting it from SKIPPY_HOME if not. Any
 * other persona, or the extension stopping: the server stops too, so its
 * ~3 GB RAM and ~1 GB VRAM are only held while Skippy is selected.
 */

import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const HEALTH_URL = "http://127.0.0.1:8911/health";

/** Config the voice reads as well; the single point of truth for where the private assets live. */
export function skippyHome(): string {
  return process.env.SKIPPY_HOME ?? join(process.env.HOME ?? "/home/jimmy", "src/skippy-voice.worktrees/pipeline-scaffold");
}

/** One probe of the voice server, for the status line as much as for ensure. */
export async function voiceHealthy(): Promise<boolean> {
  try {
    const response = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(3_000) });
    return response.ok;
  } catch {
    return false;
  }
}

/** One launch per extension lifetime: the GPU model takes ~40 s to load. */
export function ensureVoiceServe(): Promise<"started"> {
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
  if (await voiceHealthy()) return "alive";
  const venv = join(skippyHome(), ".venv-serve", "bin", "python");
  const checkpoints = join(skippyHome(), "checkpoints-zh", "skippy_zh-e15.ckpt");
  if (!existsSync(venv) || !existsSync(checkpoints)) return "missing-env";
  return ensureVoiceServe();
}

/** Skippy deselected (or the extension stopping): the server's reason to exist is gone. */
export async function stopSkippyVoice(): Promise<"stopped" | "not-running"> {
  try {
    await execFileAsync("pkill", ["-f", "skippy_voice\\.serve"]);
    return "stopped";
  } catch {
    return "not-running";
  }
}
