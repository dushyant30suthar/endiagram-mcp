# @endiagram/mcp

MCP server for [EN Diagram](https://endiagram.com) — structural analysis powered by deterministic graph algorithms.

Write your system in plain text. Get back structural facts: bottlenecks, blast radius, flow landmarks, concurrency groups, and more. No AI inside the computation — every result is deterministic.

[![endiagram MCP server](https://glama.ai/mcp/servers/dushyant30suthar/endiagram-mcp/badges/card.svg)](https://glama.ai/mcp/servers/dushyant30suthar/endiagram-mcp)

## Installation

Run directly:

```bash
npx @endiagram/mcp
```

Or install globally:

```bash
npm install -g @endiagram/mcp
```

## Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "en-diagram": {
      "command": "npx",
      "args": ["@endiagram/mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add en-diagram npx @endiagram/mcp
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EN_API_URL` | `https://api.endiagram.com` | API endpoint for the EN Diagram service |

## Tools

| Tool | Description |
|------|-------------|
| `analyze_system` | Structural signal — computes topology, roles, antipatterns from EN source |
| `render` | Render a dependency graph as publication-quality SVG |
| `detail` | Deep structural analysis — concurrency, flow landmarks, resilience, dominator tree, min-cuts |
| `distance` | Shortest path between two nodes with subsystem crossing annotations |
| `diff` | Structural diff between two systems — topology, role, and subsystem changes |
| `trace` | Follow directed flow from node A to node B with role and subsystem annotations |
| `extract` | Extract a named subsystem as standalone EN source code |
| `impact` | Blast radius — remove a node and see what disconnects |
| `evolve` | Dry-run architectural changes — apply a patch and see the structural delta |
| `between` | Betweenness centrality — what fraction of all shortest paths flow through a node |
| `categorize` | Auto-discover subsystem boundaries from dependency structure |
| `compose` | Merge two EN graphs into one with entity linking |

## EN Syntax

```
Customer do: place order needs: menu yields: order
Kitchen do: prepare food needs: order yields: meal
Waiter do: deliver needs: meal yields: served customer
```

Learn more at [endiagram.com](https://endiagram.com).

## License

MIT