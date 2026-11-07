# dsh-java-mcp

A DeepSeek Harness **bundle** that wires the [JavaLens](https://github.com/pzalutski-pixel/javalens-mcp)
MCP server into DSH automatically. JavaLens is built on Eclipse JDT; after
installation its tools are available to the model as native DSH tools under the
`mcp__javalens__*` namespace — including symbol search, find references, type
hierarchy, diagnostics, call hierarchy, change impact analysis, data/control
flow and refactorings (returned as text edits).

## Why?

`grep "save("` returns 47 hits, including `saveButton`, comments and same-named
methods of unrelated classes. JDT-based analysis returns exactly the 12 real
calls of `UserService.save()` because it resolves types, inheritance and
overloads. This plugin implements the idea from the original discussion: give
the LLM a Java MCP server so code analysis becomes compiler-accurate instead of
textual.

## Requirements

| Requirement | Details |
|---|---|
| DSH | Desktop or CLI **0.2.x**; documented and tested with 0.2.1-rc.3. |
| Node.js | a Node.js installation providing **`npx` on PATH**. The Desktop app bundles Node 24.21 and pnpm, but **no npm/npx**; on a Desktop-only machine either install Node.js LTS or switch the launcher to `pnpm dlx` (see [Launcher alternatives](#launcher-alternatives-no-npx)). |
| Java | **21 or newer** (`java -version`), JavaLens runtime; it must be reachable for the DSH process via `PATH` or `JAVA_HOME` |
| Network | only the first start downloads `javalens-mcp` (~38 MB) through `npx`; afterwards it comes from the npx cache |
| OS | Windows, macOS, Linux |

## Installation

The Desktop profile is **owned by the app**: `dsh plugin --profile desktop …`
is rejected with `profile "desktop" is managed exclusively by the Electron
application`. The Desktop app also uses its own DSH home
(`%APPDATA%\dsh-desktop\harness`), which a separate CLI installation cannot
reach.

### Desktop app (recommended)

1. Open the **Plugins** page in the sidebar.
2. In the install field, enter a **GitHub address or a local path**:
   ```
   github:weymann/dsh-java-mcp
   ```
   (or the URL `https://github.com/weymann/dsh-java-mcp`). For a local
   checkout, enter the absolute path `C:\Projects\dsh-java-mcp`.
3. Install. DSH recognises the bundle through `dsh.bundle` in `package.json`
   and adds it to the profile as a dependency; the Plugins page shows it as
   installed but **not yet enabled** — installing alone does not add it to
   `dsh.profile.bundles`.
4. Click **Enable now** in the install dialog (or switch the bundle on its
   card). Only then is it appended to `dsh.profile.bundles`, and its
   `cordis.patch.yml` is applied as a patch layer — no manual YAML editing.
5. If the `mcp__javalens__*` tools do not appear in the chat immediately,
   restart the app.

Then ask in the chat, for example: "list all methods in `demo.Foo`" — the model
will call the JavaLens tools.

> The GitHub variant requires the repository to be pushed and reachable from
> your machine via `git`. A local path always works and is the fastest way to
> try the plugin.

### CLI (own profiles: web, headless)

The `dsh` CLI only manages its own profiles, not the Desktop profile. Choose a
CLI version that matches your DSH version (`@deepseek-ai/dsh@0.2.1-rc.3` is
published on npm):

```powershell
cd C:\path\to\my-java-project
npx --yes @deepseek-ai/dsh@0.2.1-rc.3 plugin --profile web add github:weymann/dsh-java-mcp
npx --yes @deepseek-ai/dsh@0.2.1-rc.3 web
```

Important: start from the Java project directory — `JAVA_PROJECT_PATH` is
derived from `process.cwd()`.

### Local development / installing from the checkout

- **Desktop:** Plugins page, install the absolute path to the checkout.
- **CLI profile:** `dsh plugin --profile web add file:C:/Projects/dsh-java-mcp`.

`file:` dependencies are **copied** into the profile, not linked: after changing
`cordis.patch.yml`/`package.json`, run the installation again. For live
development, pnpm also accepts `link:C:/Projects/dsh-java-mcp`.

## Configuration

Bundle defaults:

| Field | Value | Meaning |
|---|---|---|
| `serverName` | `javalens` | Tool prefix: `mcp__javalens__*` |
| `command` / `args` | `npx -y javalens-mcp@1.5.3` | Server launch, version pinned for reproducible results |
| `env.JAVA_PROJECT_PATH` | `process.env.JAVA_PROJECT_PATH \|\| process.cwd()` | Project to analyse; in the Desktop app `cwd` is the opened workspace |
| `toolCallTimeoutMs` | `120000` | Timeout per tool call (JDT project load can take a while) |
| `failOnStartupError` | `false` | DSH still starts without Java/npx; the tools are then missing and an error is logged |

### Setting the project path explicitly

If the workspace root is not a Java project (e.g. a folder containing several
repositories), override the path in the profile's own patch layer. For the
Desktop app that is
`%APPDATA%\dsh-desktop\harness\profiles\desktop\cordis.patch.yml`; for CLI
profiles it is `$DSH_HOME/profiles/<profile>/cordis.patch.yml`. An `id`-based
override replaces the whole config, so repeat every field:

```yaml
- id: mcp-javalens
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: javalens
    transport: stdio
    command: npx
    args: ['-y', 'javalens-mcp@1.5.3']
    env:
      JAVA_PROJECT_PATH: C:\path\to\my-java-project
      JAVALENS_LOG_LEVEL: WARN
    toolCallTimeoutMs: 180000
    failOnStartupError: false
```

Alternatively, the model can call `mcp__javalens__load_project` with an
absolute path when the automatically loaded path is not the right one.

### Other knobs

- **Different JavaLens version**: change `args` to a newer published release
  (the latest is 1.5.3; see
  [JavaLens releases](https://github.com/pzalutski-pixel/javalens-mcp/releases)).
  An unpublished version makes `npx` fail and all tools disappear.
- **Lombok projects**: JavaLens ships a Lombok agent;
  `JAVALENS_LOMBOK_JAR` overrides it.
- **Build tool arguments**: `JAVALENS_MAVEN_ARGS`, `JAVALENS_GRADLE_ARGS`,
  `JAVALENS_BAZEL_ARGS` (e.g. profiles/properties for the project load).
- **Logging**: `JAVALENS_LOG_LEVEL` (TRACE…ERROR); output goes to stderr and
  ends up in the DSH logs.

### Launcher alternatives (no npx)

If `npx` is not available — for example a Desktop-only installation whose
bundled Node ships without npm/npx — use pnpm's `dlx`, which is already
available to the Desktop app and to any profile that installs plugins. Override
the row in the profile's patch layer, keeping every field:

```yaml
- id: mcp-javalens
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: javalens
    transport: stdio
    command: pnpm
    args: ['dlx', 'javalens-mcp@1.5.3']
    env:
      JAVA_PROJECT_PATH: C:\path\to\my-java-project
    toolCallTimeoutMs: 120000
    failOnStartupError: false
```

This variant is not covered by the repository's smoke tests; verify it once by
asking the chat to call `mcp__javalens__health_check`.

## Available tools

After a successful start all **75** JavaLens tools appear in the model's tool
set, for example:

- Navigation: `search_symbols`, `go_to_definition`, `find_references`,
  `get_type_hierarchy`, `get_document_symbols`, `get_symbol_info`,
  `get_hover_info`, `get_javadoc`
- Analysis: `get_diagnostics`, `get_call_hierarchy_incoming`,
  `get_call_hierarchy_outgoing`, `analyze_change_impact`,
  `find_unused_code`, `find_unreachable_code`, `find_possible_bugs`,
  `analyze_data_flow`, `analyze_control_flow`, `analyze_file`,
  `analyze_type`, `analyze_method`, `get_complexity_metrics`
- Refactoring (returns text edits, does not write files):
  `rename_symbol`, `extract_method`, `extract_variable`, `extract_constant`,
  `inline_variable`, `inline_method`, `change_method_signature`,
  `organize_imports`, `encapsulate_field`, `pull_up`, `push_down`
- Project: `health_check`, `load_project`, `get_project_structure`,
  `get_classpath_info`

The full, version-dependent list lives in the
[JavaLens repository](https://github.com/pzalutski-pixel/javalens-mcp); this
repository pins the 1.5.3 surface in
[`docs/javalens-tools-1.5.3.txt`](docs/javalens-tools-1.5.3.txt) and the test
suite checks the README against it.

> Note: all tool definitions are included in every model request. That is the
> price of compiler-accurate analysis; if context is tight, enable the plugin
> only in Java profiles/sessions.

### Startup behaviour

- The first start downloads `javalens-mcp` through `npx` (cold start takes
  seconds to minutes depending on the network); afterwards the server comes
  from the npx cache.
- **Cold-start caveat:** the MCP client's initial connection and tool sync use
  the MCP SDK's fixed ~60 s timeout (`toolCallTimeoutMs` only bounds tool
  calls). A slow 38 MB first download can therefore fail activation, leaving
  the tools absent until the cache is warm. Pre-warm it before the first DSH
  start with `npx -y javalens-mcp@1.5.3` (stop it with Ctrl+C once it starts).
- The MCP handshake itself takes a few seconds; loading a small project took
  about 10 s in testing. Large multi-module builds take longer — that is why
  `toolCallTimeoutMs` is set to 120 s.
- `JAVA_PROJECT_PATH` is loaded automatically at startup (default: workspace
  root). If the workspace is not a Java project, the auto-load fails; the model
  can then call `load_project` with an absolute path.

## How it works

```
DSH profile (package.json)
  ├─ dsh.profile.bundles:        ← dsh-java-mcp is appended when the bundle is enabled
  │    …
  │    └─ dsh-java-mcp ── dsh.bundle.patch → cordis.patch.yml
  │                              └─ insert: @deepseek-ai/dsh-mcp-client (serverName javalens)
  └─ boot: !!js expressions are evaluated, the MCP row starts
       └─ stdio: npx -y javalens-mcp@1.5.3  (JAVA_PROJECT_PATH = process.cwd())
            └─ 75 JDT tools as mcp__javalens__*
```

This plugin is a pure configuration bundle: `index.js` is an empty ESM module
(the same convention as the official `@deepseek-ai/dsh-*` bundles), and DSH's
official MCP client does the work. There is no network access beyond the
initial `npx` download; project code and analysis results stay local.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No `mcp__javalens__*` tools | Java < 21, `npx` not on PATH, or the first download failed | Check `java -version`; run `npx -y javalens-mcp@1.5.3` manually; check the DSH log for MCP errors; restart DSH |
| `npx` is not found (Desktop-only machine) | The Desktop app bundles Node and pnpm but no npm/npx | Install Node.js LTS or use the `pnpm dlx` launcher variant (see [Launcher alternatives](#launcher-alternatives-no-npx)) |
| Log says "Java not found" even though Java is installed | The DSH process (especially the GUI app) cannot see `java` in PATH and has no `JAVA_HOME` | Add the Java directory to the system PATH or set `JAVA_HOME`; restart the app. The JavaLens launcher checks `java -version` first, then `%JAVA_HOME%\bin\java.exe` |
| Wrong project analysed | The workspace root is not the Java project | Set `JAVA_PROJECT_PATH` (see above) or call `load_project` with an absolute path |
| Tool call times out | large multi-module build, cold JDT index | Increase `toolCallTimeoutMs`; load the project once to warm it up |
| `dsh plugin --profile desktop …` fails | The Desktop profile is owned by the app | Use the Desktop app's Plugins page (see Installation) |
| GitHub installation fails | Repository not pushed, `git` missing, or network/proxy blocked | Push the repository; check `git --version`; alternatively install from a local path |
| pnpm reports "missing peer @deepseek-ai/dsh-mcp-client" | The peer is supplied by the installation and is not installed into the profile | Ignore the warning; no action needed |
| Bundle installed but not active | Installing adds the dependency only; the bundle is not enabled | Click **Enable now** in the install dialog or switch the bundle on its card |
| Bundle enabled but tools still missing | The bundle patch failed to load | Read the error on the Plugins page; check `package.json`/`cordis.patch.yml`; check `%APPDATA%\dsh-desktop\logs\harness.log` |
| Tools missing after a DSH update | DSH version changed, profile rebuilt | Reinstall the bundle on the Plugins page and restart the app |

Checking the configuration:

- **CLI profile:** `dsh --profile web --dump-config` shows the composed patch
  layers including the `mcp-javalens` row; `!!js` expressions appear there
  unevaluated.
- **Desktop:** The Plugins page lists the bundle and its rows. The recorded
  bundle list is in
  `%APPDATA%\dsh-desktop\harness\profiles\desktop\package.json`; harness and
  MCP client errors are written to `%APPDATA%\dsh-desktop\logs\harness.log`
  (fatal launcher crash dumps stay in `%APPDATA%\dsh-desktop\harness\logs`).

## Development

```
package.json          bundle manifest (dsh.bundle.patch, peer on dsh-mcp-client)
cordis.patch.yml      patch layer: inserts the mcp-client row
index.js              empty ESM module (bundle convention)
test/plugin.test.mjs  smoke tests for manifest, patch and docs
docs/javalens-tools-1.5.3.txt  canonical JavaLens 1.5.3 tool surface
docs/decisions/       decision records
```

```powershell
npm test
```

Non-trivial changes require a decision record under `docs/decisions/`; the
maintainer decides on versioning and releases.

## License

MIT — see [LICENSE](LICENSE). JavaLens is a separate third-party project
(MIT, Peter Zalutski) loaded at runtime through `npx`.
