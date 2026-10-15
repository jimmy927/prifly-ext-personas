/**
 * Personas: keeps `output-styles/active.md` in step with the Persona
 * dropdown in the Extensions dialog (`persona.ts`). A session picks the
 * style up when it starts; the dialog's "Apply to idle sessions" hands it to
 * the ones already running.
 */

import { applyPersona, chosenPersona } from "./persona";
import { ensureSkippyVoice } from "./voice/skippy-voice";

/** The part of prifly's `ExtensionApi` this uses (`@prifly/extension-api`). */
type Api = {
  folder: string;
  settings?: Readonly<Record<string, unknown>>;
  onSettings?: (handler: (values: Readonly<Record<string, unknown>>) => void) => void;
  log(event: string, fields?: Record<string, string | number | boolean | null>): void;
  /** prifly master after extension-speech-hook (e1186aca): feature "speech-backend". */
  setSpeechBackend?(url: string | null): void;
};

async function apply(api: Api, value: unknown): Promise<void> {
  const persona = await applyPersona(api.folder, value);
  api.log("persona", { persona });
  if (chosenPersona(value) === "Skippy") {
    const voice = await ensureSkippyVoice();
    api.log("skippy-voice", { voice });
    // Owner-slot by the platform hook: this extension's deactivate releases it.
    api.setSpeechBackend?.(voice === "missing-env" ? null : "http://127.0.0.1:8911");
  } else {
    // Any other persona, or None: return speech to the default engine.
    api.setSpeechBackend?.(null);
  }
}

export async function activate(api: Api): Promise<undefined> {
  await apply(api, api.settings?.["persona"]);
  api.onSettings?.((values) => {
    void apply(api, values["persona"]);
  });
  return undefined;
}
