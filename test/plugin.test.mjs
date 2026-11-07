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

test('patch pins JavaLens and derives the project path from cwd', () => {
  assert.match(patch, /javalens-mcp@1\.5\.3/)
  assert.match(patch, /JAVA_PROJECT_PATH: !!js process\.env\.JAVA_PROJECT_PATH \|\| process\.cwd\(\)/)
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

test('documentation covers requirements, install and overrides', () => {
  assert.match(readme, /Java[^\n]{0,40}21/)
  assert.match(readme, /Plugins/) // Desktop installs through the app-owned plugin page
  assert.match(readme, /Enable now|switch the bundle/) // install does not enable the layer
  assert.match(readme, /plugin --profile web add github:weymann\/dsh-java-mcp/)
  assert.match(readme, /JAVA_PROJECT_PATH/)
  assert.match(readme, /harness\.log/) // Desktop runtime log path
})

test('decision record for the bundle approach exists', () => {
  const record = read('docs/decisions/0001-bundle-patch-mcp-javalens.md')
  assert.match(record, /^# 0001/m)
  assert.match(record, /dsh\.bundle\.patch/)
})
