#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const EN_API_URL = process.env.EN_API_URL ?? "https://api.endiagram.com";

async function callApi(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ text: string; isError: boolean }> {
  try {
    const response = await fetch(`${EN_API_URL}/api/tools/${toolName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });

    const text = await response.text();

    if (!response.ok) {
      return {
        text: `API error (${response.status}): ${text}`,
        isError: true,
      };
    }

    return { text, isError: false };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return {
      text: `Failed to reach EN API at ${EN_API_URL}: ${message}`,
      isError: true,
    };
  }
}

const server = new McpServer({
  name: "en-diagram",
  version: "0.1.0",
});

// --- analyze_system ---

server.tool(
  "analyze_system",
  "Structural signal. You describe the system, the tool computes structural facts. All computation is deterministic — no AI inside. EN syntax: subject do: action needs: inputs yields: outputs.",
  {
    source: z.string().describe("EN source code describing the system"),
    invariants: z
      .string()
      .optional()
      .describe("Invariants to check against the structure"),
    detect_antipatterns: z
      .string()
      .optional()
      .describe("Antipatterns to detect in the structure"),
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

// --- render ---

server.tool(
  "render",
  "Render an EN dependency graph as a publication-quality SVG image.",
  {
    source: z.string().describe("EN source code describing the system"),
    theme: z
      .enum(["dark", "light"])
      .optional()
      .describe("Color theme for the rendered image"),
    quality: z
      .enum(["small", "mid", "max"])
      .optional()
      .describe("Output quality / resolution"),
  },
  async ({ source, theme, quality }) => {
    const result = await callApi("render", { source, theme, quality });
    return {
      content: [{ type: "text" as const, text: result.text }],
      isError: result.isError,
    };
  }
);

// --- detail ---

server.tool(
  "detail",
  "Deep structural analysis — concurrency, flow landmarks, resilience, dominator tree, min-cuts.",
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

// --- distance ---

server.tool(
  "distance",
  "Shortest path between two nodes with subsystem crossing annotations.",
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
  "Structural diff between two systems — topology, role, and subsystem changes.",
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
  "Follow directed flow from node A to node B with role and subsystem annotations.",
  {
    source: z.string().describe("EN source code describing the system"),
    from: z.string().describe("Starting node name"),
    to: z.string().describe("Target node name"),
    defense_nodes: z
      .string()
      .optional()
      .describe("Comma-separated list of defense nodes to annotate"),
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

// --- extract ---

server.tool(
  "extract",
  "Extract a named subsystem as standalone EN source code.",
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
  "Blast radius — remove a node and see what disconnects.",
  {
    source: z.string().describe("EN source code describing the system"),
    node: z.string().describe("Node to remove for impact analysis"),
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
  "Dry-run architectural changes — apply a patch and see the structural delta.",
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

// --- between ---

server.tool(
  "between",
  "Betweenness centrality for a node — what fraction of all shortest paths flow through it.",
  {
    source: z.string().describe("EN source code describing the system"),
    node: z.string().describe("Node to compute betweenness centrality for"),
  },
  async ({ source, node }) => {
    const result = await callApi("between", { source, node });
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

// --- compose ---

server.tool(
  "compose",
  "Merge two EN graphs into one with entity linking.",
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

// --- start server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Failed to start EN Diagram MCP server:", error);
  process.exit(1);
});
