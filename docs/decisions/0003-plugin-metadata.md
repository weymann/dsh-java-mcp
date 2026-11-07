# 0003 – Plugin recognition and display metadata

- Date: 2026-11-07
- Status: accepted
- Context: maintainer question whether other `dsh-*` plugins use git tags or
  other markers so DSH recognises them as harness plugins

## Context

The repository was checked against working third-party DSH plugins installed in
the Desktop profile (`dsh-token-usage`, `dsh-ui-appearance`, `dsh-peak-hours`,
`dsh-peaktime-clock`, `dsh-deepseek-peak-clock`, `dsh-sandbox-allowlist`,
`dsh-remote`, `dsh-remote-web`) and against their GitHub repositories.

Findings:

- **Recognition is a `package.json` field, not a git tag.** Every working plugin
  declares `"dsh"` with `bundle.patch` (and optionally `client` for a Web UI
  half). The plugin manager's `inspect` reports `not-a-bundle` for a package
  without it, regardless of tags.
- **Git tags are not a convention.** `run666888/dsh-peak-hours` has no tags at
  all and works; `Tastelessor/dsh-usage-stats` uses `v2.2.0`-style tags and
  `developerdh/dsh-sandbox-allowlist` uses `v0.2.1-beta.3`-style tags. Tags are
  release hygiene, useful for pinned installs
  (`github:owner/repo#v1.2.3`), not for discovery by DSH.
- **Display metadata is file-based.** The Plugins page shows a plugin icon from
  `icon.svg` at the package root (or the manifest `icon` field) and a localized
  title/description from `locale/<lang>.json` with
  `{"meta": {"title", "description"}}`.
- **Discovery metadata is optional.** npm `keywords` include `dsh`,
  `dsh-plugin` and `deepseek-harness` in some plugins and are empty in others; a
  GitHub topic `dsh-plugin` is used by at least one plugin. Neither affects
  recognition.

## Decision

1. Keep the recognition marker unchanged: `package.json`
   `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`, plus the
   `@deepseek-ai/dsh-mcp-client` peer.
2. Add display metadata: `icon.svg` (coffee-cup-and-lens mark), an explicit
   `"icon": "./icon.svg"`, and `locale/en.json` with the title `JavaLens MCP`
   and a one-line description. Include both in `files` so npm/GitHub installs
   ship them.
3. Add the discovery keyword `dsh-plugin` to the existing keyword list.
4. Do not create a git tag in this change. The maintainer decides on releases;
   the README documents the optional tag/topic commands.
5. Keep the package version at `0.1.0`; no release is published by this change.

## Consequences

- The Plugins page shows a custom JavaLens icon, the title "JavaLens MCP" and a
  concise description instead of the generic bundle icon and truncated
  `package.json` description.
- The installed behaviour (bundle patch, MCP row, per-session `load_project`)
  is unchanged.
- Recognition stays independent of GitHub: installing from a local path,
  GitHub tarball or npm all rely on the same `package.json` field.
- Git tags remain optional. If the maintainer later tags `v0.1.0`, users can pin
  the install with `github:weymann/dsh-java-mcp#v0.1.0`.

## Verification

- `npm test` covers the manifest marker (`dsh.bundle.patch`), icon file and
  `locale/en.json` structure, the `dsh-plugin` keyword, and the README
  documentation of the recognition rules.
- Manual check after reinstalling from GitHub: the Plugins page shows the new
  icon, title and description, and the bundle remains enabled with the
  `mcp-javalens` row active.
