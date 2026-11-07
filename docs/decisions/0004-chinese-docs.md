# 0004 – Chinese README and Chinese display metadata

- Date: 2026-11-07
- Status: accepted
- Context: follow-up after the plugin release; Chinese market reach

## Context

Java is the primary language of about 60 % of Chinese developers compared with
28 % globally (JetBrains Developer Ecosystem Survey 2025, China insights), and
DeepSeek is the most widely used local LLM family in that market. The plugin's
user-facing documentation and Plugins-page text were English-only.

Other working DSH plugins ship a localized README (`README.zh.md`) and
`locale/zh.json` with `meta.title`/`meta.description`; the Plugins page selects
the display language from the client locale.

## Decision

1. Add `README.zh.md` as a Simplified Chinese version of the user
   documentation. It is structured like the English README (requirements,
   installation, usage, configuration, tools, troubleshooting, development,
   license) but intentionally more compact; `README.md` remains the source of
   truth.
2. Link the two versions from each other (`English | 中文`).
3. Add `locale/zh.json` with the Chinese title and description so a Chinese
   Desktop UI shows localized plugin metadata.
4. Ship `README.zh.md` and `locale/*.json` in the npm `files` list.
5. Do not translate identifier-like tokens: tool names, config fields, paths,
   commands and the `mcp__javalens__*` prefix stay unchanged.

## Consequences

- Chinese-speaking users get native documentation and localized Plugins-page
  text; the English README stays authoritative for maintainers and tests.
- Translations can drift. The smoke tests check that both READMEs exist, link
  to each other, and still contain the essential install spec, `load_project`
  workflow and tool count; a future text change must update both.
- The Chinese README intentionally omits nothing needed to install and operate
  the plugin, but it is shorter than the English one; deep troubleshooting
  remains in English.
- No runtime behaviour changes.

## Verification

- `npm test` checks the Chinese README, its links, the shipped `files` entries
  and the `locale/zh.json` structure.
- The Plugins page shows the Chinese title and description when the client
  language is Chinese; the icon and bundle recognition are unchanged.
