# dsh-java-mcp

[English](README.md) | 中文

一个 DeepSeek Harness **bundle（插件包）**，自动把 [JavaLens](https://github.com/pzalutski-pixel/javalens-mcp)
MCP 服务器接入 DSH。JavaLens 基于 Eclipse JDT，安装后模型可直接使用
`mcp__javalens__*` 命名空间下的 **75 个 Java 分析工具**：符号搜索、引用查找、
类型层次、诊断、调用层次、变更影响、数据/控制流分析，以及返回文本编辑的重构操作。

## 为什么需要它？

`grep "save("` 会返回 47 条结果，其中包含 `saveButton`、注释以及其他类中的同名方法。
基于 JDT 的分析能精确找到 `UserService.save()` 的 12 个真实调用点，因为它理解类型、
继承和重载。本插件实现原始讨论中的想法：给 LLM 提供一个 Java MCP 服务器，让代码
分析从文本匹配升级为编译器级语义分析。

## 怎么做？（示例提示词）

不需要特殊语法：安装并启用插件后，用自然语言描述目标即可。每个会话开始时 JavaLens
还没有项目；模型会先调用一次 `load_project` 加载工作区，然后使用 75 个工具。以下是
四个已经验证过的起点：

### 1. 一次修复所有诊断

> “用 JavaLens 加载当前工作区的 Java 项目，然后修复所有可修复的诊断：调用
> `diagnose_and_fix`，把返回的文本编辑应用到源文件，再重新运行 `get_diagnostics`
> 直到没有错误。”

模型会运行 `get_diagnostics`、`diagnose_and_fix`（或 `get_quick_fixes` +
`apply_quick_fix`），并用文件编辑工具应用修改。JavaLens 本身不写文件，所有改动
都可见、可审查。

### 2. 清理无用代码

> “用 `find_unused_code` 找出未使用的方法和字段，删除明确无用的部分，并列出
> 删除了什么、在哪里。”

### 3. 全项目安全重命名

> “用 `rename_symbol` 把 `Service.describeAll` 重命名为 `summarizeAll`，在所有
> 受影响的文件中应用编辑，并用 `get_diagnostics` 确认没有破坏其他代码。”

重命名会为每个出现位置返回一条编辑（声明和所有调用点），模型可以一次性应用。

### 4. 改代码前评估影响范围

> “我想修改 `Service.describeAll` 的签名。动手之前，用 `analyze_change_impact`
> 和调用层次列出所有受影响的文件和调用点，并总结风险。如果项目有测试，也请指出
> 需要运行的测试。”

这正是 JDT 优于 `grep` 的地方：分析会跟踪重写、接口调用和传递调用者，而不是做
文本匹配。

## 前提条件

| 项目 | 说明 |
|---|---|
| DSH | Desktop 或 CLI **0.2.x**（已在 0.2.1-rc.3 测试） |
| Node.js | 需要安装提供 `npx` 的 Node.js。Desktop 自带 Node 24.21 和 pnpm，但**不含 npm/npx**；纯桌面环境可改用 `pnpm dlx` 方案 |
| Java | **21 或更高版本**（`java -version`），DSH 进程需能通过 `PATH` 或 `JAVA_HOME` 找到 |
| 网络 | 仅首次启动时通过 npx 下载 `javalens-mcp`（约 38 MB），之后使用缓存 |
| 操作系统 | Windows、macOS、Linux |

## 安装

### 桌面版（推荐）

桌面版的 profile 由应用管理，`dsh plugin --profile desktop …` 会被拒绝。请通过侧边栏的
**Plugins** 页面安装：

1. 打开 **Plugins** 页面。
2. 在安装框中填写 GitHub 地址：
   ```
   github:weymann/dsh-java-mcp
   ```
   或使用本地路径 `C:\Projects\dsh-java-mcp`。
3. 点击 **Install**，然后点击 **Enable now**（安装本身不会启用插件）。
4. 如果 `mcp__javalens__*` 工具没有立即出现，请重启应用。

> `dsh-java-mcp` 尚未发布到 npm，因此只能通过 GitHub 地址或本地路径安装；
> 直接输入包名会提示 “No such plugin was found”。

### CLI（独立 profile：web/headless）

```powershell
cd C:\path\to\my-java-project
npx --yes @deepseek-ai/dsh@0.2.1-rc.3 plugin --profile web add github:weymann/dsh-java-mcp
npx --yes @deepseek-ai/dsh@0.2.1-rc.3 web
```

### 本地开发

- **Desktop：** 在 Plugins 页面安装本地 checkout 的绝对路径。
- **CLI：** `dsh plugin --profile web add file:C:/Projects/dsh-java-mcp`。

`file:` 依赖会被**复制**到 profile，修改 `cordis.patch.yml`/`package.json` 后需要重新安装；
实时开发可使用 `link:C:/Projects/dsh-java-mcp`。

## 使用

安装并启用后，工具会自动出现在每个会话中。DSH 不会在启动时把会话工作区传给 MCP
服务器（Desktop 从 profile 目录启动 Harness），因此 **不会自动加载 Java 项目**。
每个会话中让模型加载一次工作区即可：

> “用 `mcp__javalens__load_project` 加载当前工作区的 Java 项目，然后找出未使用的方法。”

模型知道当前会话的工作区路径。`health_check` 在加载前显示
`project.loaded: false`，加载后为 `true`；所有分析工具都要求先加载项目。

### 固定项目自动加载（可选）

如果只有一个主 Java 项目，可设置环境变量并重启 DSH，服务器启动时会自动加载：

```powershell
setx JAVA_PROJECT_PATH "C:\Path\To\MyJavaProject"
```

也可在 profile 的补丁层中设置（Desktop：
`%APPDATA%\dsh-desktop\harness\profiles\desktop\cordis.patch.yml`；CLI：
`$DSH_HOME/profiles/<profile>/cordis.patch.yml`）。基于 `id` 的覆盖会替换整个配置，
因此需要重复所有字段。

## 配置

Bundle 默认值：

| 字段 | 值 | 说明 |
|---|---|---|
| `serverName` | `javalens` | 工具前缀：`mcp__javalens__*` |
| `command` / `args` | `npx -y javalens-mcp@1.5.3` | 固定版本，保证结果可复现 |
| `env` | 无 | 可选；设置 `JAVA_PROJECT_PATH` 可自动加载固定项目 |
| `toolCallTimeoutMs` | `120000` | 单次工具调用超时（JDT 项目加载可能较慢） |
| `failOnStartupError` | `false` | 缺少 Java/npx 时 DSH 仍可启动，只记录错误 |

其他可调项：

- **其他 JavaLens 版本**：修改 `args` 为已发布的版本（当前最新为 1.5.3）；不存在的版本会导致
  npx 失败、所有工具消失。
- **Lombok 项目**：JavaLens 自带 Lombok agent，可用 `JAVALENS_LOMBOK_JAR` 覆盖。
- **构建工具参数**：`JAVALENS_MAVEN_ARGS`、`JAVALENS_GRADLE_ARGS`、
  `JAVALENS_BAZEL_ARGS`。
- **日志**：`JAVALENS_LOG_LEVEL`（TRACE…ERROR），输出到 stderr，会进入 DSH 日志。

### 启动行为

- 首次启动通过 `npx` 下载 `javalens-mcp`（冷启动可能需要数秒到数分钟），之后使用缓存。
- **冷启动注意：** MCP 客户端初次连接和工具同步使用 SDK 固定约 60 秒超时
  （`toolCallTimeoutMs` 只限制工具调用）。首次下载过慢可能导致激活失败，工具暂时缺失；
  可在首次启动前预热：`npx -y javalens-mcp@1.5.3`（启动后按 Ctrl+C 退出）。
- MCP 握手本身只需数秒；小型项目加载约 10 秒，大型多模块项目更久，因此
  `toolCallTimeoutMs` 设为 120 秒。

## 可用工具

全部 **75 个** JavaLens 工具，例如：

- 导航：`search_symbols`、`go_to_definition`、`find_references`、
  `get_type_hierarchy`、`get_document_symbols`、`get_symbol_info`、
  `get_hover_info`、`get_javadoc`
- 分析：`get_diagnostics`、`get_call_hierarchy_incoming`、
  `get_call_hierarchy_outgoing`、`analyze_change_impact`、
  `find_unused_code`、`find_unreachable_code`、`find_possible_bugs`、
  `analyze_data_flow`、`analyze_control_flow`、`analyze_file`、
  `analyze_type`、`analyze_method`、`get_complexity_metrics`
- 重构（返回文本编辑，不直接写文件）：`rename_symbol`、`extract_method`、
  `extract_variable`、`extract_constant`、`inline_variable`、`inline_method`、
  `change_method_signature`、`organize_imports`、`encapsulate_field`、
  `pull_up`、`push_down`
- 项目：`health_check`、`load_project`、`get_project_structure`、
  `get_classpath_info`

> 注意：所有工具定义都会进入每次模型请求，会占用上下文。上下文紧张时，建议只在
> Java 相关的 profile/会话中启用该插件。

## 工作原理

```
DSH profile (package.json)
  └─ dsh.profile.bundles ← 启用后追加 dsh-java-mcp
       └─ dsh.bundle.patch → cordis.patch.yml
            └─ insert: @deepseek-ai/dsh-mcp-client (serverName: javalens)
  └─ 启动时 MCP 服务器：npx -y javalens-mcp@1.5.3
       └─ 75 个 mcp__javalens__* 工具
            └─ 每个会话由模型调用一次 load_project(workspace)
```

本插件是纯配置 bundle：`index.js` 是空 ESM 模块（与官方
`@deepseek-ai/dsh-*` bundle 相同），实际工作由 DSH 官方 MCP 客户端完成。除首次
`npx` 下载外没有网络访问；项目代码和分析结果都保留在本地。

## DSH 如何识别与显示

- **识别：** `package.json` 中的
  `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`。Git 标签不是识别条件；
  没有 `dsh` 字段的包只会作为普通依赖安装。
- **显示：** 包根目录的 `icon.svg`（或 `icon` 字段）以及 `locale/<lang>.json` 中的
  `{"meta": {"title", "description"}}`，Plugins 页面会显示图标、标题和描述。
- **发现：** npm 关键词（`dsh`、`dsh-plugin`、`deepseek-harness`）和 GitHub topic
  `dsh-plugin` 仅用于检索，不影响识别。
- **可选：** 发布标签（如 `v0.1.0`）便于固定安装：
  `github:weymann/dsh-java-mcp#v0.1.0`。

## 常见问题

| 现象 | 可能原因 | 解决方法 |
|---|---|---|
| 没有 `mcp__javalens__*` 工具 | Java < 21、npx 不在 PATH、首次下载失败 | 检查 `java -version`；手动运行 `npx -y javalens-mcp@1.5.3`；查看 DSH 日志；重启 DSH |
| 日志提示 Java not found | DSH 进程看不到 `java` | 将 Java 目录加入系统 PATH 或设置 `JAVA_HOME`，重启应用 |
| 分析的不是目标项目 | 未加载项目或加载了其他项目 | 调用 `load_project` 传入绝对路径；或设置 `JAVA_PROJECT_PATH` |
| `health_check` 显示 `loaded: false` | 默认不自动加载项目 | 属正常状态，调用 `load_project` 即可 |
| 工具调用超时 | 大型多模块构建、冷索引 | 提高 `toolCallTimeoutMs`；先加载一次项目预热 |
| 插件已安装但未启用 | 安装不会自动启用 | 点击 **Enable now** 或打开卡片上的开关 |
| 启用后仍无工具 | bundle patch 加载失败 | 查看 Plugins 页面错误；检查 `%APPDATA%\dsh-desktop\logs\harness.log` |

## 开发

```
package.json          bundle 清单（dsh.bundle.patch，peer 依赖 dsh-mcp-client）
cordis.patch.yml      补丁层：插入 mcp-client 行
index.js              空 ESM 模块（bundle 约定）
icon.svg              Plugins 页面显示的图标
locale/               Plugins 页面的标题和描述（en、zh）
test/plugin.test.mjs  manifest、patch 和文档的冒烟测试
docs/decisions/       决策记录
```

```powershell
npm test
```

非平凡改动需在同一提交中于 `docs/decisions/` 添加决策记录；版本与发布由维护者决定。

## 许可证

MIT — 见 [LICENSE](LICENSE)。JavaLens 是独立第三方项目（MIT，作者 Peter Zalutski），
运行时通过 `npx` 加载。
