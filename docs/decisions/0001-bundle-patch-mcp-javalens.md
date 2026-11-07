# 0001 – Bundle patch instead of a runtime plugin for the JavaLens MCP integration

- Date: 2026-11-07
- Status: superseded by [0002](0002-load-project-per-session.md) for the
  workspace/`JAVA_PROJECT_PATH` decision; the bundle, install and runtime
  decisions below remain valid.
- Context: original discussion "Can I improve Java code analysis by giving the
  LLM a Java MCP server?"

## Context

The goal is to give the model compiler-accurate Java analysis through the
`javalens-mcp` MCP server (Eclipse JDT, npm 1.5.3). DSH already ships
`@deepseek-ai/dsh-mcp-client`, an MCP client that starts stdio servers and
registers their tools as `mcp__<serverName>__<tool>`. No custom tool
implementation is needed — only configuration.

The discussion template contained several assumptions that were checked against
the actually installed DSH version (Desktop 0.2.1-rc.3, harness code extracted
from `app.asar`):

- `"dsh": { "bundle": true }` is **not** a valid manifest. The valid form is
  `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`; the patch field
  accepts one file or an ordered list of files.
- A bundle is not a Cordis plugin row. Its `cordis.patch.yml` is appended to
  the profile's patch stack; `index.js` only needs to be an empty ESM module
  (the official `@deepseek-ai/dsh-*` bundles ship `export {}`).
- `!!js` expressions are allowed in the patch dialect and are evaluated at
  boot; the scope is the loader context plus Node globals, so `process` is
  available.
- The MCP SDK spawns servers with `cross-spawn` and `shell: false`; `npx` works
  on Windows through PATHEXT resolution, so `npx.cmd` is not required.
- The Desktop app boots the harness with `process.cwd()` equal to the opened
  workspace: the active sandbox policy derives its workspace root from
  `process.cwd()` (`workspaceRoot: !!js process.cwd()`), and the enforced
  workspace root is the opened workspace directory.

## Decision

1. The package is a pure configuration bundle (`dsh.bundle.patch`).
2. `cordis.patch.yml` inserts exactly one row:
   `name: '@deepseek-ai/dsh-mcp-client'`, `serverName: javalens`,
   `transport: stdio`, `command: npx`,
   `args: ['-y', 'javalens-mcp@1.5.3']`.
3. `JAVA_PROJECT_PATH` is set to
   `!!js process.env.JAVA_PROJECT_PATH || process.cwd()`. The workspace root is
   therefore the default, and an explicit override remains possible.
4. `toolCallTimeoutMs: 120000` (JDT project load of large multi-module builds),
   `failOnStartupError: false` (DSH stays usable without Java/npx).
5. JavaLens is pinned to `1.5.3`; upgrades happen deliberately through a new
   decision record or a README update.
6. The bundle joins `dsh.profile.bundles` when it is **enabled**: a CLI
   `plugin add` enables it, while the Desktop Plugins page installs it disabled
   until the user clicks **Enable now** (or switches it on).
7. The launcher uses `npx`, which requires a Node.js installation with npm/npx
   on PATH. The Desktop app bundles Node 24.21 and pnpm but no npm/npx; the
   README documents this and offers a `pnpm dlx` override as an alternative.

## Consequences

- **Desktop profile:** installation goes through the Desktop app's Plugins page
  (spec `github:…` or an absolute path). `dsh plugin --profile desktop …` is not
  possible; the 0.2.x CLI rejects the app-owned profile. The Desktop app uses
  its own DSH home at `%APPDATA%\dsh-desktop\harness`.
- **CLI profiles:** installation remains a `dsh plugin … add` call against an
  own profile (web/headless); there the configuration can be inspected with
  `--dump-config`. `file:` dependencies are copied, not linked.
- No `preinstall`/`prepare` script and no `allowBuilds` approval is required.
- The `npx` launcher needs npm/npx on PATH; without it the plugin cannot start
  and, because `failOnStartupError` is false, DSH starts without the Java tools.
  A `pnpm dlx` override is documented for Desktop-only machines.
- The first `npx` run downloads ~38 MB inside the MCP SDK's fixed ~60 s
  connection budget, so a slow cold download can fail activation until the
  cache is warm; the README documents a pre-warm step.
- No custom tool-code risk; failure modes of the MCP client (timeout, reconnect,
  missing tools) apply unchanged and are documented.
- All JavaLens tool schemas are included in every request; that costs context.
  A deliberate trade-off in favour of compiler accuracy.
- `process.cwd()` ties the default to the workspace root. If the Java project is
  deeper or the workspace is a multi-repo folder, `JAVA_PROJECT_PATH` must be
  set or `load_project` used.
- The pinned JavaLens version must stay compatible with the Java runtime (21+)
  and the project; the README documents the upgrade path.
- No automatic tool filter: to save context, enable the bundle only in Java
  profiles.

## Verification (2026-11-07, DSH Desktop 0.2.1-rc.3)

Checked against the harness CLI extracted from `app.asar` with `DSH_HOME` inside
the workspace:

- `plugin --profile probe add file:<checkout>` initialises the profile, installs
  the bundle, enables it and adds both `dependencies` and
  `dsh.profile.bundles`; the user patch layer stays unchanged. The Desktop
  Plugins page shares the same install operation but keeps a user-entered spec
  disabled until **Enable now** (read from the 0.2.1-rc.3 client code; the GUI
  flow itself was not exercised).
- `--dump-config` shows the `# == dsh-java-mcp` layer with the `mcp-javalens`
  row; the YAML parses with the harness's `!!js` dialect and the expression
  evaluates to the workspace path.
- `@deepseek-ai/dsh-mcp-client` resolves as an installation-provided package
  (`scope: installation`); the `"*"` peer declaration is sufficient and a
  profile dependency is not needed.
- On boot the `mcp-client` fiber is active (`state: 2`, no error), so the row
  including its evaluated `!!js` config loads. The actual tool synchronisation
  (`mcp__javalens__*`) could not be observed in the test environment because
  its sandbox blocks piped child-process stdio (`spawn EPERM`); the Desktop
  app's harness instance runs outside that sandbox.
- The server itself was verified through an isolated MCP handshake: 75 tools,
  `initialize` reports JavaLens 1.5.3 with protocol 2024-11-05, 352 bytes of
  instructions (well below the client's 32 KiB limit, so no
  `maxInstructionBytes` override is needed) and `capabilities.tools`. On a
  simple Java fixture, `health_check`, `load_project`, `get_project_structure`,
  `get_diagnostics`, `find_references`, `find_unused_code` and
  `get_type_hierarchy` returned plausible results; the handshake took about 4 s
  (warm npx cache) and `load_project` about 10 s. This proves the `npx`
  invocation, the env schema and the JDK requirement; only the registration of
  the tools inside the running Desktop process remains unverified (a limit of
  the test sandbox, not of the plugin).
- JavaLens locates Java through `java -version` (PATH) or `JAVA_HOME`; the
  README documents this as a failure mode.
- The GitHub installation variant requires a pushed repository; a `github:`
  spec against an empty repository fails in pnpm with
  `ERR_PNPM_PACKAGE_MANAGER_ADD_RESOLVE_GIT`. Build approvals (`allowBuilds`)
  are not needed because the package has no `prepare` script.
