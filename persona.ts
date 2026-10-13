/**
 * The persona chosen in the Extensions dialog, as the one output style this
 * plugin ships: `output-styles/active.md`, written from `personas/<name>.md`
 * with `force-for-plugin: true`, so Claude Code applies it to every session
 * the plugin is loaded in without anyone typing /output-style. "None" — or a
 * prifly too old to offer the dropdown, which leaves the setting out —
 * removes it, and sessions talk plainly again.
 */

import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

/** The dropdown's options, as the manifest lists them; "None" is no persona. */
export const PERSONAS = [
  "Skippy",
  "Spock",
  "Duke",
  "Bender",
  "Sparrow",
  "Deadpool",
  "Cat",
  "Zapp",
  "Claptrap",
] as const;

/** The persona a setting names, or null for "None" and anything not offered. */
export function chosenPersona(value: unknown): (typeof PERSONAS)[number] | null {
  return PERSONAS.find((persona) => persona === value) ?? null;
}

/** A persona's file as a style Claude Code applies by itself while the plugin is on. */
export function forcedStyle(source: string): string {
  if (!source.startsWith("---\n")) throw new Error("persona file has no front matter");
  return source.replace(/^---\n/, "---\nforce-for-plugin: true\n");
}

/** Write the chosen persona's forced style into `folder`, or remove it for none. */
export async function applyPersona(folder: string, value: unknown): Promise<string | null> {
  const active = join(folder, "output-styles", "active.md");
  const persona = chosenPersona(value);
  if (persona === null) {
    await rm(active, { force: true });
    return null;
  }
  const source = await Bun.file(join(folder, "personas", `${persona.toLowerCase()}.md`)).text();
  await mkdir(join(folder, "output-styles"), { recursive: true });
  await Bun.write(active, forcedStyle(source));
  return persona;
}
