// Smoke tests for the bundle contract and the patch/documentation wiring.
// They intentionally avoid a YAML dependency: the repository stays
// dependency-free, so `npm test` works without an install step.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(join(root, file), 'utf8')
const manifest = JSON.parse(read('package.json'))
const patch = read(manifest.dsh.bundle.patch.replace(/^\.\//, ''))
const readme = read('README.md')
const canonicalTools = read('docs/javalens-tools-1.5.3.txt')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)

test('manifest is a DSH bundle with the documented patch file', () => {
  assert.equal(manifest.name, 'dsh-java-mcp')
  assert.equal(manifest.dsh?.bundle?.patch, './cordis.patch.yml')
  assert.ok(manifest.files.includes('cordis.patch.yml'))
  assert.ok(manifest.files.includes('index.js'))
})

test('manifest declares the MCP client peer used by the inserted row', () => {
  assert.ok(Object.hasOwn(manifest.peerDependencies ?? {}, '@deepseek-ai/dsh-mcp-client'))
  assert.equal(manifest.peerDependencies['@deepseek-ai/dsh-mcp-client'], '*')
})

test('manifest ships the display metadata and discovery keyword', () => {
  assert.equal(manifest.icon, './icon.svg')
  assert.ok(manifest.files.includes('icon.svg'))
  assert.ok(manifest.files.includes('locale/*.json'))
  assert.ok(manifest.keywords.includes('dsh-plugin'))
  assert.ok(manifest.keywords.includes('deepseek-harness'))
})

test('display metadata files are valid', () => {
  const icon = read('icon.svg')
  assert.match(icon, /^<svg[\s>]/)
  assert.match(icon, /aria-label="JavaLens MCP"/)
  for (const language of ['en', 'zh']) {
    const locale = JSON.parse(read(`locale/${language}.json`))
    assert.equal(typeof locale.meta?.title, 'string')
    assert.equal(typeof locale.meta?.description, 'string')
    assert.ok(locale.meta.title.length > 0 && locale.meta.description.length > 0)
  }
})

test('Chinese documentation is shipped and cross-linked', () => {
  assert.ok(manifest.files.includes('README.zh.md'))
  const chinese = read('README.zh.md')
  assert.match(chinese, /^# dsh-java-mcp/m)
  assert.match(chinese, /\[English\]\(README\.md\)/)
  assert.match(readme, /\[中文\]\(README\.zh\.md\)/)
  assert.match(chinese, /github:weymann\/dsh-java-mcp/)
  assert.match(chinese, /mcp__javalens__load_project/)
  assert.match(chinese, /75/)
})

test('index.js is an importable ESM no-op', async () => {
  const namespace = await import(pathToFileURL(join(root, 'index.js')).href)
  assert.deepEqual(Object.keys(namespace), [])
})

test('patch inserts exactly one JavaLens MCP client row', () => {
  assert.match(patch, /^- insert:\s*$/m)
  assert.equal([...patch.matchAll(/- id: /g)].length, 1)
  assert.match(patch, /id: mcp-javalens/)
  assert.match(patch, /name: '@deepseek-ai\/dsh-mcp-client'/)
  assert.match(patch, /serverName: javalens/)
  assert.match(patch, /transport: stdio/)
  assert.match(patch, /command: npx/)
})

test('patch pins JavaLens and leaves project selection to load_project', () => {
  assert.match(patch, /javalens-mcp@1\.5\.3/)
  // DSH does not expose the session workspace at boot (the Desktop harness
  // runs from its profile directory), so the row must not bind JAVA_PROJECT_PATH
  // to process.cwd(); an environment-provided value is inherited instead.
  assert.doesNotMatch(patch, /JAVA_PROJECT_PATH: !!js process\.env\.JAVA_PROJECT_PATH \|\| process\.cwd\(\)/)
  assert.doesNotMatch(patch, /^\s*env:\s*$/m)
  assert.match(patch, /toolCallTimeoutMs: 120000/)
  assert.match(patch, /failOnStartupError: false/)
})

test('canonical tool list is the 75-tool JavaLens surface', () => {
  assert.equal(canonicalTools.length, 75)
  assert.equal(new Set(canonicalTools).size, 75)
  for (const name of ['health_check', 'load_project', 'find_references', 'get_diagnostics']) {
    assert.ok(canonicalTools.includes(name), `${name} missing from tool list`)
  }
})

test('README tool names are all in the canonical JavaLens list', () => {
  // Snake-case tokens in README backticks are the JavaLens tool names; drift
  // between docs and the real server surface (or a typo) fails this test.
  const backticked = [...readme.matchAll(/`([^`\s]+)`/g)].map((match) => match[1])
  const snakeCase = backticked.filter((token) => /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(token))
  const unknown = [...new Set(snakeCase)].filter((token) => !canonicalTools.includes(token))
  assert.deepEqual(unknown, [])
  assert.match(readme, /all \*\*75\*\* JavaLens tools/)
})

test('pinned JavaLens version is consistent across patch and README', () => {
  const patchPin = patch.match(/javalens-mcp@([0-9][\w.-]*)/)?.[1]
  const readmePin = readme.match(/javalens-mcp@([0-9][\w.-]*)/)?.[1]
  assert.equal(patchPin, '1.5.3')
  assert.equal(readmePin, patchPin)
})

test('documentation covers requirements, install and project loading', () => {
  assert.match(readme, /Java[^\n]{0,40}21/)
  assert.match(readme, /Plugins/) // Desktop installs through the app-owned plugin page
  assert.match(readme, /Enable now|switch the bundle/) // install does not enable the layer
  assert.match(readme, /plugin --profile web add github:weymann\/dsh-java-mcp/)
  assert.match(readme, /JAVA_PROJECT_PATH/) // optional auto-load override
  assert.match(readme, /load_project/) // per-session project loading
  assert.match(readme, /profile directory/) // why no cwd-based auto-load
  assert.match(readme, /harness\.log/) // Desktop runtime log path
})

test('documentation explains recognition and display metadata', () => {
  assert.match(readme, /How DSH recognises and displays the plugin/)
  assert.match(readme, /no git-tag convention/i)
  assert.match(readme, /dsh\.bundle\.patch/)
  assert.match(readme, /icon\.svg/)
  assert.match(readme, /locale\/<lang>\.json/)
})

test('language switchers sit directly under the title in both READMEs', () => {
  for (const file of ['README.md', 'README.zh.md']) {
    assert.match(
      read(file),
      /^# dsh-java-mcp\n\n(?:English \| \[中文\]\(README\.zh\.md\)|\[English\]\(README\.md\) \| 中文)\n\n/,
      `${file}: switcher must follow the title, before the description`,
    )
  }
})

test('documentation provides verified usage prompts', () => {
  const promptTools = ['diagnose_and_fix', 'find_unused_code', 'rename_symbol', 'analyze_change_impact']
  assert.match(readme, /## How\?/)
  const chinese = read('README.zh.md')
  assert.match(chinese, /## 怎么做/)
  for (const tool of promptTools) {
    assert.ok(readme.includes(tool), `${tool} missing from the English How? section`)
    assert.ok(chinese.includes(tool), `${tool} missing from the Chinese How? section`)
  }
})

test('decision records cover the bundle approach and the workspace correction', () => {
  const record = read('docs/decisions/0001-bundle-patch-mcp-javalens.md')
  assert.match(record, /^# 0001/m)
  assert.match(record, /dsh\.bundle\.patch/)
  assert.match(record, /superseded by \[0002\]/)
  const followUp = read('docs/decisions/0002-load-project-per-session.md')
  assert.match(followUp, /^# 0002/m)
  assert.match(followUp, /load_project/)
  assert.match(followUp, /profile directory/)
  const metadata = read('docs/decisions/0003-plugin-metadata.md')
  assert.match(metadata, /^# 0003/m)
  assert.match(metadata, /git tags/i)
  const chinese = read('docs/decisions/0004-chinese-docs.md')
  assert.match(chinese, /^# 0004/m)
  assert.match(chinese, /README\.zh\.md/)
})
