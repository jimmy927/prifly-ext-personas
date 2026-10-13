# prifly-ext-personas

A voice for the Claude you talk to in prifly, so the day is less dull: Skippy the Magnificent or Spock.

Each persona is a Claude Code [output style](https://code.claude.com/docs/en/output-styles) in `output-styles/`. The folder is also a Claude Code plugin (`.claude-plugin/plugin.json`, named `personas`), and prifly passes an enabled extension's plugin to every local session with `--plugin-dir`, so the styles are there in every session.

## Switching

In a session, type:

- `/output-style personas:Skippy`
- `/output-style personas:Spock`
- `/output-style default` to turn it off

`/output-style` with no argument lists them. The new voice starts with the next message. Claude Code saves the choice in the project's `.claude/settings.local.json`, so it holds for every later session in that project until you switch again.

## What a persona changes

Only how Claude talks to you. Each style keeps Claude Code's coding instructions (`keep-coding-instructions: true`) and keeps the voice out of everything written for someone else or that outlives the conversation: commits, pull requests, code and comments, sub-agent briefs, and drafts in Gmail, Outlook, ODI support, LinkedIn, WhatsApp, Messenger and Instagram. Sub-agents run their own system prompt, so they never take on the persona.

## Adding a persona

Add `output-styles/<name>.md` with this front matter, and copy the "Where the voice stops" section from `skippy.md` word for word:

```markdown
---
name: <Name>
description: <one line>
keep-coding-instructions: true
---
```

Every `.md` in `output-styles/` becomes a style, so keep nothing else there.
