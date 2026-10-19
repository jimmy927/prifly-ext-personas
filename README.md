# prifly-ext-personas

A voice for the Claude you talk to in prifly, so the day is less dull: Skippy the Magnificent, Spock, Duke Nukem, Bender, Captain Jack Sparrow, Deadpool, the Cat from Red Dwarf, Zapp Brannigan or Claptrap.

## Choosing one

In prifly's Extensions dialog, open Personas and pick under **Persona**: None or one of the personas. New sessions talk in it from their first message; **Apply to idle sessions** hands it to the ones already running, and a busy one gets it at its next start. None talks plainly again.

The dropdown needs a prifly with the `select` setting type; an older prifly leaves the setting out, and nothing is applied.

## How it works

Each persona is a Claude Code [output style](https://code.claude.com/docs/en/output-styles), kept in `personas/`. The folder is also a Claude Code plugin (`.claude-plugin/plugin.json`, named `personas`), which prifly passes to every local session with `--plugin-dir` while the extension is on.

`index.ts` copies the chosen persona to `output-styles/active.md` with `force-for-plugin: true` added, so Claude Code applies it to every session the plugin is loaded in, without anyone typing `/output-style`, and removes it for None. `output-styles/` is written by the extension and ignored by git.

`research/` holds the source notes each persona was written from: speech patterns, canon checks and short attributed quotes. It is not loaded into any session.

## The Skippy bundle: talk and voice

Skippy is not only a style sheet. When the dropdown picks **Skippy**, the plugin:

1. makes sure the trained voice — skippy_zh-e15, built from the reader's own book audio and approved by ear — is listening at `127.0.0.1:8911`, starting it from `SKIPPY_HOME` if it is not;
2. points prifly's read-aloud at it through the platform's `setSpeechBackend` hook (needs prifly on or after `e1186aca`; older priflys silently keep the default engine, since the plugin feature-guards the call).

The same hook returns the slot to the default edge-tts engine the moment the choice becomes another persona, **None**, or the extension is unloaded — because the slot belongs to this extension and the platform resets it on deactivate. No env var, no config file, no restart.

While Skippy is picked, the extension's row in Settings → Extensions shows the voice server instead of the description: `Skippy voice: running`, `starting` (the first read-aloud takes ~40 s, checked once more a minute later), or `not installed`. Reloading or re-applying the extension re-probes the server and starts it again when it died — there is no background watcher; the status line reflects the last probe.

The server's lifetime is the dropdown's: it starts when Skippy is picked and stops — its ~3 GB RAM and ~1 GB VRAM freed — the moment another persona or **None** is picked, or the extension is unticked or reloaded (a reload with Skippy picked therefore restarts the voice: ~40–70 s before the first read-aloud). No idle timers, no watcher processes; memory is held only while Skippy is selected.

The private assets stay private in the training checkout (`skippy-voice.worktrees/pipeline-scaffold`: model weights 2.6 GB, voice checkpoints, and the training clips); only the glue ships in this repository — `voice/serve.py` (the FastAPI wrapper) and `voice/skippy-voice.ts` (health check plus spawn-on-demand). Set `SKIPPY_HOME` to point the voice at another training checkout. A machine without that checkout and `.venv-serve` installed answers `missing-env`, read-aloud stays on the default engine, nothing else affected.

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

## License and contributing

Source-available under the Functional Source License 1.1 with an Apache 2.0 future license (`LICENSE.md`): use it, change it and fix it freely, but not to offer a competing product. Each version becomes Apache 2.0 two years after its release.

Pull requests are welcome. Before one can be merged, its author signs the contributor agreement (`CLA.md`), which assigns the copyright in the contribution to The Startup Factory AB; the CLA bot asks for it on the pull request.
