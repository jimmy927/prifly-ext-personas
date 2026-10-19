/**
 * Personas: keeps `output-styles/active.md` in step with the Persona
 * dropdown in the Extensions dialog (`persona.ts`). A session picks the
 * style up when it starts; the dialog's "Apply to idle sessions" hands it to
 * the ones already running.
 */

import { applyPersona, chosenPersona } from "./persona";
import { VoiceServer, voiceHealthy } from "./voice/skippy-voice";

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

/** The 60 s follow-up probe and the newest `apply`, per activation. */
type State = { probe: ReturnType<typeof setTimeout> | undefined; latest: number };

async function apply(api: Api, server: VoiceServer, state: State, value: unknown): Promise<void> {
  const mine = ++state.latest;
  clearTimeout(state.probe);
  const persona = await applyPersona(api.folder, value);
  api.log("persona", { persona });
  if (chosenPersona(value) === "Skippy") {
    const voice = await server.ensure();
    // A later pick, or the stop, took over while the server was being probed.
    if (mine !== state.latest) return;
    api.log("skippy-voice", { voice });
    // Owner-slot by the platform hook: this extension's deactivate releases it.
    api.setSpeechBackend?.(voice === "missing-env" ? null : "http://127.0.0.1:8911");
    api.status?.(voiceStatusText(voice));
    if (voice === "started") {
      // One follow-up probe once the model has had its ~40 s to load, so the
      // status line lands on running/failed — no recurring watcher.
      state.probe = setTimeout(() => {
        void voiceHealthy().then((up) => {
          api.status?.(up ? voiceStatusText("alive") : "Skippy voice: failed to start — see the serve log");
        });
      }, 60_000);
    }
  } else {
    // Any other persona, or None: return speech to the default engine and
    // stop the voice server this extension started.
    if (mine !== state.latest) return;
    api.setSpeechBackend?.(null);
    api.status?.("");
    await server.stop();
  }
}

export async function activate(api: Api, server: VoiceServer = new VoiceServer()): Promise<() => Promise<void>> {
  const state: State = { probe: undefined, latest: 0 };
  await apply(api, server, state, api.settings?.["persona"]);
  api.onSettings?.((values) => {
    void apply(api, server, state, values["persona"]);
  });
  // Disable, unload and reload: the host calls this. It does not await the
  // result (`runStop`), so the next activation waits for the stop itself
  // (`voice/skippy-voice.ts`); callers that do await get the finished stop.
  return () => {
    state.latest++;
    clearTimeout(state.probe);
    return server.stop();
  };
}
