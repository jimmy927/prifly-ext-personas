/**
 * Personas: keeps `output-styles/active.md` in step with the Persona
 * dropdown in the Extensions dialog (`persona.ts`). A session picks the
 * style up when it starts; the dialog's "Apply to idle sessions" hands it to
 * the ones already running.
 */

import { applyPersona } from "./persona";

/** The part of prifly's `ExtensionApi` this uses (`@prifly/extension-api`). */
type Api = {
  folder: string;
  settings?: Readonly<Record<string, unknown>>;
  onSettings?: (handler: (values: Readonly<Record<string, unknown>>) => void) => void;
  log(event: string, fields?: Record<string, string | number | boolean | null>): void;
};

async function apply(api: Api, value: unknown): Promise<void> {
  const persona = await applyPersona(api.folder, value);
  api.log("persona", { persona });
}

export async function activate(api: Api): Promise<undefined> {
  await apply(api, api.settings?.["persona"]);
  api.onSettings?.((values) => {
    void apply(api, values["persona"]);
  });
  return undefined;
}
