# 0002 – Do not bind JAVA_PROJECT_PATH at boot; load the workspace per session

- Date: 2026-11-07
- Status: accepted
- Supersedes the workspace assumption of record
  [0001](0001-bundle-patch-mcp-javalens.md)

## Context

Record 0001 assumed that the Desktop app boots the harness with
`process.cwd()` equal to the opened workspace, and therefore set
`JAVA_PROJECT_PATH: !!js process.env.JAVA_PROJECT_PATH || process.cwd()`.

A live test in the running Desktop app (DSH 0.2.1-rc.3, plugin 0.1.0 installed
from GitHub and enabled) disproved that assumption:

- `mcp__javalens__health_check` returned `project.loaded: true` with
  `projectRoot = C:\Users\bernd\AppData\Roaming\dsh-desktop\harness\profiles\desktop`,
  i.e. the profile directory — not the opened workspace.
- `get_project_structure` confirmed the same root and found no source files.
- The workspace path is a per-session property. It is stored in the Desktop
  app's `storages/workspace.json` and is not exposed to the harness through an
  environment variable at boot. The MCP client row, however, is configured once
  when the harness process starts, so its `env` cannot depend on the session
  workspace.
- The tools themselves were fully functional: after `mcp__javalens__load_project`
  with an explicit path, `find_unused_code`, `get_diagnostics`,
  `analyze_type` and `find_references` returned correct JDT results for a
  two-file Java fixture.

## Decision

1. `cordis.patch.yml` no longer sets `JAVA_PROJECT_PATH`; the row has no `env`
   block. A project is loaded explicitly through
   `mcp__javalens__load_project` with the absolute workspace path, once per
   session/project. The model knows that path from its session context.
2. Setting `JAVA_PROJECT_PATH` in the environment remains supported as an
   opt-in: the MCP client inherits non-secret environment variables, so the
   server auto-loads that fixed project. The README documents this and the
   per-profile override variant.
3. The `!!js` dialect stays unused in the patch; there is no boot-time
   expression that depends on the working directory or the session.

## Consequences

- The plugin works with any number of workspaces and projects per DSH
  installation; switching the workspace does not require a DSH restart, only a
  new `load_project` call (or none, if the same project is already loaded and
  DSH disk sync is strict, which keeps answers current after edits).
- There is no silent auto-load of a wrong project. `health_check` shows
  `project.loaded: false` until the model loads a project — this is the
  documented normal state, not an error.
- One extra tool call per session is required before analysis. The tool
  descriptions already state "Requires load_project to be called first", so a
  natural Java request triggers it.
- Users who want the old, automatic behaviour for a single main project set
  `JAVA_PROJECT_PATH` in the environment (or in the profile patch layer) and get
  the project loaded at MCP server start.
- Record 0001 keeps the launch/install/runtime decisions (bundle format,
  `npx`, pinned version, timeouts, enablement); only its `process.cwd()`
  reasoning is obsolete.

## Verification (2026-11-07, DSH Desktop 0.2.1-rc.3, plugin 0.1.0)

- Installed through the Desktop Plugins page from
  `https://github.com/weymann/dsh-java-mcp`, enabled, and verified the remote
  `refs/heads/main` equals the local commit `1b1ccdb`.
- The 75 `mcp__javalens__*` tools were registered in a running Desktop session.
- `health_check`: `status: Ready`, JavaLens 1.5.3, Java 21.0.5, `toolCount: 75`.
- After `load_project` on a fixture (2 files, package `demo`):
  `find_unused_code` reported `unusedHelper`, `get_diagnostics` reported the
  matching "never used locally" warning, `analyze_type demo.Greeter` listed both
  methods and the field, and `find_references` on `Greeter.greet` found exactly
  the one call site in `Main`.
- The observed wrong auto-load root (profile directory) is what triggered this
  record and the removal of the `JAVA_PROJECT_PATH` expression.
