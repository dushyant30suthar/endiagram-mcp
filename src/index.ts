#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const EN_API_URL = process.env.EN_API_URL ?? "https://api.endiagram.com";

async function callApi(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ text: string; isError: boolean; svg?: string }> {
  try {
    const response = await fetch(`${EN_API_URL}/api/tools/${toolName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });

    const body = await response.text();

    if (!response.ok) {
      return {
        text: `API error (${response.status}): ${body}`,
        isError: true,
      };
    }

    try {
      const parsed = JSON.parse(body);
      return {
        text: parsed.text ?? body,
        isError: parsed.isError ?? false,
        svg: parsed.svg ?? undefined,
      };
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

const EN_INSTRUCTIONS = `EN Diagram is a deterministic structural analysis engine. No AI inside — all results are backed by named mathematical theorems.

To describe a system, write one statement per line:
  actor do: action needs: input1, input2 yields: output1, output2

Shared names between yields and needs create connections automatically. Multi-word names work fine. Use commas to separate multiple inputs or outputs.

The engine computes structural truth from the description — the tool outputs are raw mathematical findings. Translate them into clear, practical insights relevant to what the user is trying to achieve.

How to use these tools effectively: model the system first, then explore. The first tool call reveals the structure — but the real insights come from following up. A node labeled HUB that should be simple? Dig into it with between or impact. A surprising subsystem boundary? Extract it and analyze deeper. An unexpected dependency chain? Trace it. A proposed change? Evolve it and diff. The tools are designed to chain — each finding opens a question that another tool can answer. Don't stop at one call. Explore, tinker, compare, and let the math surface what no one expected.

Go deep, not wide. When a finding catches your attention — a surprising hub, an unexpected bottleneck, a structural anomaly — lock onto it. Use one tool to surface it, then chain the next tool to explain it, then the next to stress-test it. Keep narrowing until you reach the root. One thread, followed to the end, beats ten shallow observations. Only call render when the user explicitly asks to visualize.`;

const server = new McpServer({
  name: "endiagram",
  version: "0.2.0",
});

// --- analyze ---

server.tool(
  "analyze",
  EN_INSTRUCTIONS + " This tool gives the system overview: shape, node roles, single points of failure, failure threshold, flow hotspots.",
  {
    source: z.string().describe("EN source code describing the system"),
    invariants: z
      .string()
      .optional()
      .describe("Invariants to check against the structure"),
    detect_antipatterns: z
      .string()
      .optional()
      .describe("Set to 'true' to detect structural antipatterns"),
  },
  async ({ source, invariants, detect_antipatterns }) => {
    const result = await callApi("analyze_system", {
      source,
      invariants,
      detect_antipatterns,
    });
    return {
      content: [{ type: "text" as const, text: result.text }],
      isError: result.isError,
    };
  }
);

// --- detail ---

server.tool(
  "detail",
  "Concurrency, critical path, flow landmarks, resilience, dependency chains, dominator tree.",
  {
    source: z.string().describe("EN source code describing the system"),
  },
  async ({ source }) => {
    const result = await callApi("detail", { source });
    return {
      content: [{ type: "text" as const, text: result.text }],
      isError: result.isError,
    };
  }
);

// --- categorize ---

server.tool(
  "categorize",
  "Auto-discover subsystem boundaries from dependency structure.",
  {
    source: z.string().describe("EN source code describing the system"),
  },
  async ({ source }) => {
    const result = await callApi("categorize", { source });
    return {
      content: [{ type: "text" as const, text: result.text }],
      isError: result.isError,
    };
  }
);

// --- distance ---

server.tool(
  "distance",
  "Structural distance between two nodes with the path between them.",
  {
    source: z.string().describe("EN source code describing the system"),
    from: z.string().describe("Starting node name"),
    to: z.string().describe("Target node name"),
  },
  async ({ source, from, to }) => {
    const result = await callApi("distance", { source, from, to });
    return {
      content: [{ type: "text" as const, text: result.text }],
      isError: result.isError,
    };
  }
);

// --- diff ---

server.tool(
  "diff",
  "Compare two systems. What changed structurally.",
  {
    source_a: z.string().describe("EN source code for the first system"),
    source_b: z.string().describe("EN source code for the second system"),
  },
  async ({ source_a, source_b }) => {
    const result = await callApi("diff", { source_a, source_b });
    return {
      content: [{ type: "text" as const, text: result.text }],
      isError: result.isError,
    };
  }
);

// --- trace ---

server.tool(
  "trace",
  "Follow directed flow from A to B. Optional: check if defense nodes cover all paths.",
  {
    source: z.string().describe("EN source code describing the system"),
    from: z.string().describe("Starting node name"),
    to: z.string().describe("Target node name"),
    defense_nodes: z
      .string()
      .optional()
      .describe("Comma-separated list of defense nodes to check coverage"),
  },
  async ({ source, from, to, defense_nodes }) => {
    const result = await callApi("trace", {
      source,
      from,
      to,
      defense_nodes,
    });
    return {
      content: [{ type: "text" as const, text: result.text }],
      isError: result.isError,
    };
  }
);

// --- between ---

server.tool(
  "between",
  "How much of the system flows through a specific node.",
  {
    source: z.string().describe("EN source code describing the system"),
    node: z.string().describe("Node name"),
  },
  async ({ source, node }) => {
    const result = await callApi("between", { source, node });
    return {
      content: [{ type: "text" as const, text: result.text }],
      isError: result.isError,
    };
  }
);

// --- extract ---

server.tool(
  "extract",
  "Extract a subsystem as standalone EN source. Feed back into other tools.",
  {
    source: z.string().describe("EN source code describing the system"),
    subsystem: z.string().describe("Name of the subsystem to extract"),
  },
  async ({ source, subsystem }) => {
    const result = await callApi("extract", { source, subsystem });
    return {
      content: [{ type: "text" as const, text: result.text }],
      isError: result.isError,
    };
  }
);

// --- impact ---

server.tool(
  "impact",
  "What changes if a node is removed. Includes how far the effect propagates.",
  {
    source: z.string().describe("EN source code describing the system"),
    node: z.string().describe("Node to remove"),
  },
  async ({ source, node }) => {
    const result = await callApi("impact", { source, node });
    return {
      content: [{ type: "text" as const, text: result.text }],
      isError: result.isError,
    };
  }
);

// --- evolve ---

server.tool(
  "evolve",
  "Dry-run a structural change before making it.",
  {
    source: z.string().describe("EN source code describing the current system"),
    patch: z.string().describe("EN source code patch to apply"),
  },
  async ({ source, patch }) => {
    const result = await callApi("evolve", { source, patch });
    return {
      content: [{ type: "text" as const, text: result.text }],
      isError: result.isError,
    };
  }
);

// --- compose ---

server.tool(
  "compose",
  "Merge two systems into one by linking shared entities.",
  {
    source_a: z.string().describe("EN source code for the first system"),
    source_b: z.string().describe("EN source code for the second system"),
    links: z
      .string()
      .describe(
        "Entity links between the two systems (e.g. 'a.node1=b.node2, a.node3=b.node4')"
      ),
  },
  async ({ source_a, source_b, links }) => {
    const result = await callApi("compose", { source_a, source_b, links });
    return {
      content: [{ type: "text" as const, text: result.text }],
      isError: result.isError,
    };
  }
);

// --- conserve ---

server.tool(
  "conserve",
  "Structural invariants, deadlock analysis, complexity, and resilience.",
  {
    source: z.string().describe("EN source code describing the system"),
  },
  async ({ source }) => {
    const result = await callApi("conserve", { source });
    return {
      content: [{ type: "text" as const, text: result.text }],
      isError: result.isError,
    };
  }
);

// --- render ---

server.tool(
  "render",
  "SVG diagram. Only call when user explicitly asks to visualize. Saves SVG to a local file — no SVG content enters the conversation.",
  {
    source: z.string().describe("EN source code describing the system"),
    theme: z
      .enum(["dark", "light"])
      .optional()
      .describe("Color theme"),
    quality: z
      .enum(["small", "mid", "max"])
      .optional()
      .describe("Output quality"),
  },
  async ({ source, theme, quality }) => {
    const result = await callApi("render", { source, theme, quality });
    if (result.isError || !result.svg) {
      return {
        content: [{ type: "text" as const, text: result.text }],
        isError: result.isError,
      };
    }

    const outDir = join(process.cwd(), ".endiagram");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const filePath = join(outDir, `en-${Date.now()}.svg`);
    writeFileSync(filePath, result.svg);

    return {
      content: [{ type: "text" as const, text: `SVG saved: ${filePath}` }],
      isError: false,
    };
  }
);

// --- start server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Failed to start EN Diagram MCP server:", error);
  process.exit(1);
});
