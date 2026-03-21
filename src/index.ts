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

const PLAIN_LANG =
  " When presenting findings to the user, use plain everyday language. Never use jargon like 'betweenness centrality', 'min-cut', 'bridge node', 'dominator tree', 'vertex-disjoint paths', or 'topology classification'. Instead say 'bottleneck', 'single point of failure', 'no backup path', 'what controls what'. The raw data helps your analysis -- give the user clear, simple insights.";

const server = new McpServer({
  name: "en-diagram",
  version: "0.1.0",
});

// --- analyze_system ---

server.tool(
  "analyze_system",
  "Structural signal. You describe the system, the tool computes structural facts. All computation is deterministic -- no AI inside. EN syntax: subject do: action needs: inputs yields: outputs. Returns topology classification (Pipeline, Tree, Fork-Join, Series-Parallel, State Machine, Disconnected, or Unknown), node roles (SOURCE, SINK, FORK, JOIN, HUB, PIPELINE, CYCLE), and bridges (single points of failure). A node labeled HUB that you expected to be PIPELINE is a real finding." + PLAIN_LANG,
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
  "The depth layer. Run after analyze_system to get the full picture Returns: concurrency metrics (max parallelism, critical path length, parallel paths per depth level), flow landmarks (exact depths where the graph diverges/converges -- these are your bottleneck boundaries), full resilience analysis (bridge implications with which subsystems disconnect if each bridge fails), and structural dependency chains (what feeds what, what must complete first). analyze_system tells you WHERE to look. detail tells you WHY it matters. Use categorize -> extract to isolate a subsystem first, then detail on the extracted source for focused depth." ,
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
  "Auto-organize a flat list into named groups. You give it ungrouped actions with inputs and outputs -- the tool discovers subsystem boundaries from the dependency structure and names them. 25 nodes become 5-6 named subsystems. You don't define the groups. The structure does. When the discovered boundaries differ from your module structure, that difference is a finding. Use after analyze_system to see how the system organizes itself. Then feed subsystem names into extract for fractal zoom." ,
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
  "Structural ruler. Computes shortest path between any two nodes (actions or entities) with annotations at every step. Returns: edge count, subsystem boundary crossings (how many module boundaries the path crosses), bridge edges on path (fragile links), and the full path with subsystem labels. Use to answer: 'how coupled are these two things?' If distance is 1-2 edges, they're tightly coupled. If it crosses 2+ subsystem boundaries, a change to one will ripple far." ,
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
  "Structural diff between two systems. Computes both graphs independently, then reports the delta: nodes/entities present in one but not the other, role changes (a node that was PIPELINE in A became HUB in B -- that's a coupling regression), subsystem membership changes (node migrated between clusters), topology classification changes, and stage count differences. Use for: spec vs implementation (does the code match the design?), version 1 vs version 2 (did the refactor improve or worsen structure?), intended vs actual (model what you think exists, model what does exist, diff them)." ,
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
  "Follow the flow -- data, materials, authority, money, risk. Computes directed shortest path from node A to node B, respecting the yields->needs flow direction. Every node on the path is annotated with its structural role and subsystem membership, so you can see role transitions along the flow (e.g., SOURCE -> PIPELINE -> HUB -> SINK). If no directed path exists, falls back to undirected and flags which edges are traversed backwards -- reverse edges often indicate missing abstractions or circular dependencies. Optional defense_nodes parameter checks whether specified nodes cover all source-to-sink paths." ,
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
  "Quantify coupling. Computes betweenness centrality for a node: what fraction of all shortest paths in the system flow through it. Returns normalized score [0-1], absolute shortest-paths-through count, and total paths. A score of 0.25 means one quarter of all communication in the system passes through this node -- it's a coupling hotspot. Use on nodes flagged as HUB or FORK by analyze_system to get a precise number. Compare centrality scores across nodes to find the true bottleneck vs nodes that just look important." ,
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

// --- extract ---

server.tool(
  "extract",
  "Fractal zoom. Extract a named subsystem as standalone EN source code you can feed back into analyze_system for a deeper look. Reports boundary inputs (dependencies from outside the subsystem), boundary outputs (consumed by other subsystems), and internal entities. This is how you go from surface findings to root causes: categorize gives you subsystem names -> extract gives you the subsystem as its own graph -> analyze_system on that graph reveals internal structure invisible at the top level." ,
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
  "Blast radius calculator. Remove a node and see what breaks. Returns which nodes become disconnected (unreachable), whether the overall topology classification changes, and connected component count before vs after. Use to answer: 'what breaks if this node goes down?' If removing a node disconnects 0 others, it's safely removable. If it splits the graph into multiple components, it's load-bearing. Run this on every bridge node from analyze_system to Works for any domain -- remove a team from an org, a control from a compliance flow, a step from a clinical pathway. Same math." ,
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
  "Dry-run for architectural changes. Apply a patch to a system and see the structural delta before writing any code. Patch nodes with the same name replace originals; new names are additions. Returns the full diff (topology change, role changes, subsystem shifts) plus new bridge nodes created and bridge nodes eliminated. Use to test: 'What happens if I add a validation step here?' 'Does adding a cache layer create a new single point of failure?' 'Will splitting this service improve or worsen coupling?' Answer these questions in seconds, not hours." ,
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
  "Merge two EN graphs into one. Takes two separate system descriptions and a list of entity links that connect them. Linked entities are merged under source A's name. Unlinked entities that share a name are automatically disambiguated. Returns combined EN source that you feed into any other tool -- analyze_system sees cross-graph bridges, impact shows blast radius across both graphs, distance measures paths crossing graph boundaries. Use when modeling two interacting systems (client/server, producer/consumer, spec/implementation) that share specific data points." ,
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

// --- render (last — only use when user explicitly asks to visualize) ---

server.tool(
  "render",
  "Render an EN dependency graph as a publication-quality SVG image. Only call this when the user explicitly asks to visualize or render. Nodes are colored by structural role (source, sink, hub, etc.) and grouped by auto-detected subsystem. The visual reveals patterns (clusters, isolated subgraphs, fan-out imbalance) that text output alone misses." ,
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

// --- start server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Failed to start EN Diagram MCP server:", error);
  process.exit(1);
});
