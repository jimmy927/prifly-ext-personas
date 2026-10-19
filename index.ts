/**
 * Personas: keeps `output-styles/active.md` in step with the Persona
 * dropdown in the Extensions dialog (`persona.ts`). A session picks the
 * style up when it starts; the dialog's "Apply to idle sessions" hands it to
 * the ones already running.
 */

import { applyPersona, chosenPersona } from "./persona";
import { ensureSkippyVoice, stopSkippyVoice, voiceHealthy } from "./voice/skippy-voice";

/** The part of prifly's `ExtensionApi` this uses (`@prifly/extension-api`). */
type Api = {
  folder: string;
  settings?: Readonly<Record<string, unknown>>;
  onSettings?: (handler: (values: Readonly<Record<string, unknown>>) => void) => void;
  log(event: string, fields?: Record<string, string | number | boolean | null>): void;
  /** prifly master after extension-speech-hook (e1186aca): feature "speech-backend". */
  setSpeechBackend?(url: string | null): void;
  /** One line in Settings → Extensions in place of the description: feature "status". */
  status?(text: string): void;
};

/** What the Extensions dialog says about the voice once `ensureSkippyVoice` answered. */
export function voiceStatusText(voice: "alive" | "started" | "missing-env"): string {
  switch (voice) {
    case "alive":
      return "Skippy voice: running";
    case "started":
      return "Skippy voice: starting — the first read-aloud takes ~40 s";
    case "missing-env":
      return "Skippy voice: not installed (no model under SKIPPY_HOME) — read-aloud stays default";
  }
}

/** Tracks the dropdown across apply() calls so a late status probe can't speak for a deselected Skippy. */
let skippySelected = false;

async function apply(api: Api, value: unknown): Promise<void> {
  const persona = await applyPersona(api.folder, value);
  api.log("persona", { persona });
  const skippy = chosenPersona(value) === "Skippy";
  skippySelected = skippy;
  if (skippy) {
    const voice = await ensureSkippyVoice();
    api.log("skippy-voice", { voice });
    // Owner-slot by the platform hook: this extension's deactivate releases it.
    api.setSpeechBackend?.(voice === "missing-env" ? null : "http://127.0.0.1:8911");
    api.status?.(voiceStatusText(voice));
    if (voice === "started") {
      // One follow-up probe once the model has had its ~40 s to load, so the
      // status line lands on running/failed — no recurring watcher. Dropped
      // if Skippy was deselected meanwhile: the else branch owns the line then.
      setTimeout(() => {
        if (!skippySelected) return;
        void voiceHealthy().then((up) => {
          if (skippySelected) {
            api.status?.(up ? voiceStatusText("alive") : "Skippy voice: failed to start — see the serve log");
          }
        });
      }, 60_000);
    }
  } else {
    // Any other persona, or None: return speech to the default engine, and
    // stop the voice server — its memory belongs to Skippy being selected.
    api.setSpeechBackend?.(null);
    api.status?.("");
    const stopped = await stopSkippyVoice();
    api.log("skippy-voice-stop", { stopped });
  }
}

export async function activate(api: Api): Promise<() => void> {
  await apply(api, api.settings?.["persona"]);
  api.onSettings?.((values) => {
    void apply(api, values["persona"]);
  });
  // Extension unticked or reloaded: the voice server goes down with it.
  return () => {
    void stopSkippyVoice();
  };
}
