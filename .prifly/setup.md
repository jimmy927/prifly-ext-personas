---
setup: []
---

The repository holds only Markdown and JSON: Claude Code output styles in `output-styles/`,
the plugin manifest `.claude-plugin/plugin.json` and the prifly manifest
`prifly-extension.json`. There is no package manager, no lockfile, no build and no test suite,
so a fresh worktree is ready as checked out.

Trying a style needs the `claude` CLI on PATH: run it with `--plugin-dir <this worktree>` in a
throwaway project folder (`/output-style personas:Skippy` writes that folder's
`.claude/settings.local.json`, which must not land in this repository).
