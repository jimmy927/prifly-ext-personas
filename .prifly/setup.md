---
setup: []
---

The repository holds Claude Code output styles in `personas/`, the plugin manifest
`.claude-plugin/plugin.json`, the prifly manifest `prifly-extension.json` and a small TypeScript
extension (`index.ts`, `persona.ts`) with its tests in `test/`. There is no package manager, no
lockfile and no build, so a fresh worktree is ready as checked out; `bun test` runs the tests.

Trying a style needs the `claude` CLI on PATH: run it with `--plugin-dir <this worktree>` in a
throwaway project folder (`/output-style personas:Skippy` writes that folder's
`.claude/settings.local.json`, which must not land in this repository).
