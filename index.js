// dsh-java-mcp is a pure configuration bundle: its cordis.patch.yml inserts
// the @deepseek-ai/dsh-mcp-client row that starts javalens-mcp. Bundles ship a
// no-op ESM entry (same shape as the official @deepseek-ai/dsh-* bundles) so
// the package stays importable; no runtime code is needed here.
export {};
