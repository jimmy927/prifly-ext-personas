# prifly-ext-personas

A voice for the Claude you talk to in prifly, so the day is less dull: Skippy the Magnificent, Spock, Duke Nukem, Bender, Captain Jack Sparrow, Deadpool, the Cat from Red Dwarf, Zapp Brannigan or Claptrap.

## Choosing one

In prifly's Extensions dialog, open Personas and pick under **Persona**: None or one of the personas. New sessions talk in it from their first message; **Apply to idle sessions** hands it to the ones already running, and a busy one gets it at its next start. None talks plainly again.

The dropdown needs a prifly with the `select` setting type; an older prifly leaves the setting out, and nothing is applied.

## How it works

Each persona is a Claude Code [output style](https://code.claude.com/docs/en/output-styles), kept in `personas/`. The folder is also a Claude Code plugin (`.claude-plugin/plugin.json`, named `personas`), which prifly passes to every local session with `--plugin-dir` while the extension is on.

`index.ts` copies the chosen persona to `output-styles/active.md` with `force-for-plugin: true` added, so Claude Code applies it to every session the plugin is loaded in, without anyone typing `/output-style`, and removes it for None. `output-styles/` is written by the extension and ignored by git.

`research/` holds the source notes each persona was written from: speech patterns, canon checks and short attributed quotes. It is not loaded into any session.

## What a persona changes

Only how Claude talks to you. Each style keeps Claude Code's coding instructions (`keep-coding-instructions: true`) and keeps the voice out of everything written for someone else or that outlives the conversation: commits, pull requests, code and comments, sub-agent briefs, and drafts in Gmail, Outlook, ODI support, LinkedIn, WhatsApp, Messenger and Instagram. Sub-agents run their own system prompt, so they never take on the persona.

## Adding a persona

1. Add `personas/<name>.md` with this front matter, and copy the "Where the voice stops" section from `skippy.md` word for word:

   ```markdown
   ---
   name: <Name>
   description: <one line>
   keep-coding-instructions: true
   ---
   ```

2. Add `<Name>` to `PERSONAS` in `persona.ts` and to the setting's `options` in `prifly-extension.json`, spelled the same as the file name with a capital first letter.

3. Put the notes it was written from in `research/<name>.md`.

`bun test` checks that a choice writes the style and None removes it, and that every persona has its file, its dropdown option and the "Where the voice stops" section word for word.
