#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const toolsConfig = JSON.parse(
  readFileSync(join(__dirname, "../tools.json"), "utf-8")
);
const pkg: { version: string } = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), "utf-8")
);

const EN_API_URL = process.env.EN_API_URL ?? "https://api.endiagram.com";

// ─────────────────────────────────────────────────────────────────────
// Install ID — persistent, opt-out by env var or file
//
// On first run, generate a UUIDv4 and store it at ~/.endiagram/install-id
// (chmod 0600). Sent on every request as the X-Endiagram-Install-Id header
// so the server can correlate requests from the same install for debugging
// per-installation issues that the per-IP cid HMAC can't track (mobile
// rotation, CGNAT, VPN).
//
// No source code, no file paths, no environment variables, no PII are
// sent. The install ID is a random opaque UUID generated locally.
//
// Three opt-out mechanisms (any one disables the header):
//   1. ENDIAGRAM_TELEMETRY=off  (env var, also accepts 0/false/no)
//   2. ~/.endiagram/telemetry   (file containing "off")
//   3. delete ~/.endiagram/install-id  (regenerated unless 1 or 2 set)
// ─────────────────────────────────────────────────────────────────────

const UUIDV4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function resolveInstallId(): string | null {
  // Tier 1: env var opt-out
  const envFlag = process.env.ENDIAGRAM_TELEMETRY?.trim().toLowerCase();
  if (envFlag && /^(off|0|false|no)$/.test(envFlag)) {
    return null;
  }

  const stateDir = join(homedir(), ".endiagram");
  const telemetryFile = join(stateDir, "telemetry");
  const installFile = join(stateDir, "install-id");

  // Tier 2: disk flag opt-out
  if (existsSync(telemetryFile)) {
    try {
      const flag = readFileSync(telemetryFile, "utf-8").trim().toLowerCase();
      if (/^(off|0|false|no)$/.test(flag)) return null;
    } catch {
      // unreadable telemetry file — fall through, prefer enabled state
    }
  }

  // Read existing install-id
  if (existsSync(installFile)) {
    try {
      const existing = readFileSync(installFile, "utf-8").trim().toLowerCase();
      if (UUIDV4_REGEX.test(existing)) return existing;
      // malformed — fall through to regenerate
    } catch {
      // unreadable — fall through to regenerate
    }
  }

  // First run (or corrupted file): generate, persist, print notice
  const fresh = randomUUID();
  try {
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(installFile, fresh, { encoding: "utf-8" });
    // Restrict to owner rw only — install ID is effectively a stable
    // pseudonymous identifier; treat it like a low-sensitivity secret.
    try {
      chmodSync(installFile, 0o600);
    } catch {
      // Some filesystems don't support POSIX perms — best effort.
    }
    // First-run disclosure to STDERR (never stdout — stdout is the
    // MCP JSON-RPC channel and any bytes there corrupt Claude Desktop).
    process.stderr.write(
      `[endiagram] First run: generated install ID at ${installFile}\n` +
      `[endiagram] This ID is sent with requests so we can correlate per\n` +
      `            installation for debugging. No source code, file paths,\n` +
      `            env vars, or PII are sent.\n` +
      `            Opt out: ENDIAGRAM_TELEMETRY=off  (or delete the file)\n` +
      `            Privacy: https://endiagram.com/privacy\n`
    );
  } catch {
    // Could not persist (read-only home dir, etc.) — return the
    // generated id anyway so the current process still gets correlation
    // within its own lifetime. Next run will try again.
  }
  return fresh;
}

const INSTALL_ID: string | null = resolveInstallId();

/**
 * Resolve the `source` parameter: if it looks like a file path (.en, .txt,
 * or starts with / or ~), read the file and return its contents.
 * Otherwise return the string as-is (inline source).
 */
function resolveSource(source: string): string {
  const trimmed = source.trim();
  const isPath =
    trimmed.endsWith(".en") ||
    trimmed.endsWith(".txt") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("~") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../");
  if (!isPath) return source;
  const resolved = trimmed.startsWith("~")
    ? join(process.env.HOME ?? "", trimmed.slice(1))
    : resolve(trimmed);
  return readFileSync(resolved, "utf-8");
}

async function callApi(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ text: string; isError: boolean; svg?: string; data?: unknown }> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": `endiagram-mcp/${pkg.version} node/${process.version.replace(/^v/, "")}`,
    };
    if (INSTALL_ID) {
      headers["X-Endiagram-Install-Id"] = INSTALL_ID;
    }
    const response = await fetch(`${EN_API_URL}/mcp`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      }),
    });

    const body = await response.text();
    if (!response.ok) {
      return { text: `API error (${response.status}): ${body}`, isError: true };
    }

    try {
      const rpcResponse = JSON.parse(body);
      if (rpcResponse.error) {
        return { text: rpcResponse.error.message, isError: true };
      }
      const result = rpcResponse.result;
      const content = result?.content?.[0];
      const text = content?.text ?? body;
      const isError = result?.isError ?? false;
      // Check for SVG in second content block (render tool)
      const svgContent = result?.content?.[1];
      const svg = svgContent?.text?.startsWith("<svg")
        ? svgContent.text
        : undefined;
      return { text, isError, svg, data: undefined };
    } catch {
      return { text: body, isError: false };
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return {
      text: `Failed to reach EN API at ${EN_API_URL}: ${message}`,
      isError: true,
    };
  }
}

const EN_INSTRUCTIONS: string = toolsConfig.instructions;

const server = new McpServer(
  { name: "endiagram", version: pkg.version },
  { instructions: EN_INSTRUCTIONS },
);

interface ToolParam {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

interface ToolDef {
  name: string;
  description: string;
  parameters: ToolParam[];
}

for (const tool of toolsConfig.tools as ToolDef[]) {
  const schemaProps: Record<string, z.ZodType> = {};
  for (const param of tool.parameters) {
    schemaProps[param.name] = param.required
      ? z.string().describe(param.description)
      : z.string().optional().describe(param.description);
  }

  server.tool(
    tool.name,
    tool.description,
    schemaProps,
    async (args: Record<string, string | undefined>) => {
      // Resolve source fields from file paths if needed
      try {
        if (args.source) args.source = resolveSource(args.source);
        if (args.source_a) args.source_a = resolveSource(args.source_a);
        if (args.source_b) args.source_b = resolveSource(args.source_b);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text" as const, text: `Failed to read source file: ${msg}` }], isError: true };
      }

      // Special handling for render (save SVG to file)
      if (tool.name === "render") {
        const result = await callApi("render", args);
        if (result.isError || !result.svg) {
          return {
            content: [{ type: "text" as const, text: result.text }],
            isError: result.isError,
          };
        }

        const outputPath = args.output;
        let filePath: string;
        if (outputPath) {
          const dir = dirname(outputPath);
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          filePath = outputPath;
        } else {
          const outDir = join(process.cwd(), ".endiagram");
          if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
          filePath = join(outDir, `en-${Date.now()}.svg`);
        }
        writeFileSync(filePath, result.svg);

        return {
          content: [
            { type: "text" as const, text: `SVG saved: ${filePath}` },
          ],
          isError: false,
        };
      }

      // All other tools
      const result = await callApi(tool.name, args);
      return {
        content: [{ type: "text" as const, text: result.text }],
        isError: result.isError,
      };
    }
  );
}

// --- start server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Failed to start EN Diagram MCP server:", error);
  process.exit(1);
});
