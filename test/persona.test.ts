import { expect, test } from "bun:test";
import { cp, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyPersona, chosenPersona, forcedStyle } from "../persona";

const repo = join(import.meta.dir, "..");

test("only an offered persona is chosen; None and unknown values are none", () => {
  expect(chosenPersona("Skippy")).toBe("Skippy");
  expect(chosenPersona("Spock")).toBe("Spock");
  expect(chosenPersona("None")).toBeNull();
  expect(chosenPersona("skippy")).toBeNull();
  expect(chosenPersona(undefined)).toBeNull();
});

test("the forced style keeps the persona's front matter and adds force-for-plugin", () => {
  const style = forcedStyle("---\nname: Skippy\nkeep-coding-instructions: true\n---\nBody\n");
  expect(style).toBe(
    "---\nforce-for-plugin: true\nname: Skippy\nkeep-coding-instructions: true\n---\nBody\n",
  );
});

test("choosing a persona writes it as active.md, and None removes it", async () => {
  const folder = await mkdtemp(join(tmpdir(), "personas-"));
  await cp(join(repo, "personas"), join(folder, "personas"), { recursive: true });
  const active = Bun.file(join(folder, "output-styles", "active.md"));

  expect(await applyPersona(folder, "Spock")).toBe("Spock");
  const spock = await active.text();
  expect(spock).toContain("force-for-plugin: true");
  expect(spock).toContain("name: Spock");

  expect(await applyPersona(folder, "Skippy")).toBe("Skippy");
  expect(await active.text()).toContain("name: Skippy");

  expect(await applyPersona(folder, "None")).toBeNull();
  expect(await active.exists()).toBe(false);
});
