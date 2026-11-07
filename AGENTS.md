# AGENTS.md

Non-trivial changes require a decision record under `docs/decisions/` in the
same commit (format: see `docs/decisions/README.md`).

Version and release are the maintainer's call: do not bump the `version` in
`package.json`, create tags or publish unless explicitly asked.

`README.md` is the user documentation; keep it in sync when changing the patch,
tool names or installation paths.

Run before committing:

```powershell
npm test
```

The test only reads files; there are no build dependencies.
