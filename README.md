# dsh-java-mcp

English | [中文](README.zh.md)

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

## How?

There is no special syntax: install and enable the bundle, then describe the
outcome you want in natural language. JavaLens starts without a project in each
session; the model loads the workspace once (`load_project`) and then works
through the 75 tools. Four proven starting points:

### 1. Fix the diagnostics in one go

> "Load the Java project in this workspace with JavaLens, then fix every
> fixable diagnostic: use `diagnose_and_fix`, apply the returned text edits to
> the source files, and re-run `get_diagnostics` until it is clean."

The model runs `get_diagnostics`, `diagnose_and_fix` (or `get_quick_fixes` plus
`apply_quick_fix`) and applies the edits with its file-editing tool. JavaLens
never writes files itself, so every change stays visible and reviewable.

### 2. Remove dead code

> "Find unused methods and fields with `find_unused_code`, remove the ones that
> are clearly dead, and list what you deleted and where."

### 3. Rename safely across the project

> "Rename `Service.describeAll` to `summarizeAll` using `rename_symbol`, apply
> the edits in all affected files, and verify with `get_diagnostics` that
> nothing broke."

The rename returns one edit per occurrence — declaration plus every call site —
so the model can apply them all in one step.

### 4. Check the blast radius before changing code

> "I want to change the signature of `Service.describeAll`. Before touching
> anything, use `analyze_change_impact` and the call hierarchy to list every
> affected file and call site, then summarize the risk. If the project has
> tests, also name the tests that would need to run."

This is where JDT beats `grep`: the analysis follows overrides, interface calls
and transitive callers instead of matching text.

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

After DSH starts, load the Java project once per session through the model:
`mcp__javalens__load_project` with the absolute workspace path. The model sees
the workspace path in its session context, so a prompt like "load the Java
project in this workspace and list unused methods" is enough.

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
| `env` | none | Optional; set `JAVA_PROJECT_PATH` to auto-load a fixed project (see below) |
| `toolCallTimeoutMs` | `120000` | Timeout per tool call (JDT project load can take a while) |
| `failOnStartupError` | `false` | DSH still starts without Java/npx; the tools are then missing and an error is logged |

### Loading a project

DSH does not expose the opened workspace to boot-time configuration: the
Desktop app starts the harness from its profile directory, while the workspace
is a per-session property and the MCP client row is configured once when the
harness boots. JavaLens therefore starts without a project, and the model loads
the workspace once per session:

> "Load the Java project in this workspace with
> `mcp__javalens__load_project` and then find unused methods."

The model knows the workspace path from its session context. `health_check`
reports `project.loaded: false` before that call and `true` afterwards; every
analysis tool requires the load.

#### Fixed project via environment (optional)

To auto-load one fixed project instead, set `JAVA_PROJECT_PATH` in the
environment of the DSH process — the variable is inherited by the MCP server —
and restart DSH. Alternatively add it through the profile's patch layer
(Desktop: `%APPDATA%\dsh-desktop\harness\profiles\desktop\cordis.patch.yml`;
CLI profiles: `$DSH_HOME/profiles/<profile>/cordis.patch.yml`). An `id`-based
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

The environment variable is the simpler route for a single main project; the
patch layer keeps the path with the profile.

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
- No project is auto-loaded by default: the Desktop app boots the harness from
  its profile directory, and the session workspace is not available to the
  boot-time MCP configuration. The model calls `load_project` once per session
  with the workspace path. To auto-load a fixed project instead, set
  `JAVA_PROJECT_PATH` in the environment (see [Loading a project](#loading-a-project)).

## How it works

```
DSH profile (package.json)
  ├─ dsh.profile.bundles:        ← dsh-java-mcp is appended when the bundle is enabled
  │    …
  │    └─ dsh-java-mcp ── dsh.bundle.patch → cordis.patch.yml
  │                              └─ insert: @deepseek-ai/dsh-mcp-client (serverName javalens)
  └─ boot: the MCP row starts the server
       └─ stdio: npx -y javalens-mcp@1.5.3   → 75 JDT tools as mcp__javalens__*
            └─ model calls mcp__javalens__load_project(workspace) once per session
```

This plugin is a pure configuration bundle: `index.js` is an empty ESM module
(the same convention as the official `@deepseek-ai/dsh-*` bundles), and DSH's
official MCP client does the work. There is no network access beyond the
initial `npx` download; project code and analysis results stay local.

## How DSH recognises and displays the plugin

DSH has **no git-tag convention** for plugins. Recognition happens entirely
through `package.json`:

- `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }` marks the package as a
  profile bundle. A package without a `dsh` field is installed as a plain
  dependency and never mounted as a layer.
- `peerDependencies` on `@deepseek-ai/dsh-*` are checked against the running
  harness version before the bundle loads.

Optional display metadata (what the Plugins page shows):

- `icon.svg` at the package root (or an explicit `"icon"` field) is used as the
  plugin icon.
- `locale/<lang>.json` (currently `en` and `zh`) with
  `{"meta": {"title", "description"}}` replaces the package name and the
  `package.json` description in the Plugins list, following the client
  language.

Discovery outside DSH (not required for recognition):

- npm `keywords` such as `dsh`, `dsh-plugin`, `deepseek-harness` and a GitHub
  topic `dsh-plugin` help people find the repository.
- Git tags/releases are optional and are **not** a recognition marker; some
  working plugins ship without any tag. Tags are still useful for pinned
  installs: `github:weymann/dsh-java-mcp#v0.1.0`.

Maintainer commands (optional; only when a release should be published):

```powershell
gh repo edit weymann/dsh-java-mcp --add-topic dsh-plugin --add-topic deepseek-harness --add-topic mcp --add-topic java
git tag -a v0.1.0 -m "dsh-java-mcp 0.1.0"
git push origin v0.1.0
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No `mcp__javalens__*` tools | Java < 21, `npx` not on PATH, or the first download failed | Check `java -version`; run `npx -y javalens-mcp@1.5.3` manually; check the DSH log for MCP errors; restart DSH |
| `npx` is not found (Desktop-only machine) | The Desktop app bundles Node and pnpm but no npm/npx | Install Node.js LTS or use the `pnpm dlx` launcher variant (see [Launcher alternatives](#launcher-alternatives-no-npx)) |
| Log says "Java not found" even though Java is installed | The DSH process (especially the GUI app) cannot see `java` in PATH and has no `JAVA_HOME` | Add the Java directory to the system PATH or set `JAVA_HOME`; restart the app. The JavaLens launcher checks `java -version` first, then `%JAVA_HOME%\bin\java.exe` |
| Wrong project analysed | The project was loaded from a different path | Call `load_project` with the correct absolute workspace path; for a fixed project set `JAVA_PROJECT_PATH` (see [Loading a project](#loading-a-project)) |
| `health_check` shows `project.loaded: false` (root = profile directory) | Expected default: no project is auto-loaded | Ask the model to call `load_project` with the workspace path, or set `JAVA_PROJECT_PATH` |
| Analysis tool answers "Requires load_project to be called first" | Project not loaded in this session | Call `load_project` once with the absolute project path |
| Tool call times out | large multi-module build, cold JDT index | Increase `toolCallTimeoutMs`; load the project once to warm it up |
| `dsh plugin --profile desktop …` fails | The Desktop profile is owned by the app | Use the Desktop app's Plugins page (see Installation) |
| GitHub installation fails | Repository not pushed, `git` missing, or network/proxy blocked | Push the repository; check `git --version`; alternatively install from a local path |
| pnpm reports "missing peer @deepseek-ai/dsh-mcp-client" | The peer is supplied by the installation and is not installed into the profile | Ignore the warning; no action needed |
| Bundle installed but not active | Installing adds the dependency only; the bundle is not enabled | Click **Enable now** in the install dialog or switch the bundle on its card |
| Bundle enabled but tools still missing | The bundle patch failed to load | Read the error on the Plugins page; check `package.json`/`cordis.patch.yml`; check `%APPDATA%\dsh-desktop\logs\harness.log` |
| Tools missing after a DSH update | DSH version changed, profile rebuilt | Reinstall the bundle on the Plugins page and restart the app |

Checking the configuration:

- **CLI profile:** `dsh --profile web --dump-config` shows the composed patch
  layers including the `mcp-javalens` row.
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
icon.svg              plugin icon shown in the Plugins page
locale/               display title and description for the Plugins page (en, zh)
README.zh.md          Chinese user documentation
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
