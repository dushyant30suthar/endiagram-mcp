#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const toolsConfig = JSON.parse(
  readFileSync(join(__dirname, "../tools.json"), "utf-8")
);

const EN_API_URL = process.env.EN_API_URL ?? "https://api.endiagram.com";

async function callApi(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ text: string; isError: boolean; svg?: string; data?: unknown }> {
  try {
    const response = await fetch(`${EN_API_URL}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  { name: "endiagram", version: "0.2.0" },
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
