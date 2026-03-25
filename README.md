# @endiagram/mcp

MCP server for [EN Diagram](https://endiagram.com) — deterministic structural analysis powered by graph theory. Every result is backed by a named mathematical theorem. No AI inside the computation.

## Installation

Run directly:

```bash
npx @endiagram/mcp
```

Or install globally:

```bash
npm install -g @endiagram/mcp
```

## Connect

### Claude Code

```bash
claude mcp add endiagram npx @endiagram/mcp
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "endiagram": {
      "command": "npx",
      "args": ["@endiagram/mcp"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "endiagram": {
      "command": "npx",
      "args": ["@endiagram/mcp"]
    }
  }
}
```

### HTTP (zero install)

Any MCP client that supports HTTP transport:

```
https://api.endiagram.com/mcp
```

### Smithery

```bash
smithery mcp add dushyant30suthar/endiagram
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EN_API_URL` | `https://api.endiagram.com` | API endpoint for the EN Diagram service |

## Tools

| Tool | Description |
|------|-------------|
| `analyze` | System overview: shape, node roles, single points of failure, failure threshold, flow hotspots |
| `detail` | Concurrency, critical path, flow landmarks, resilience, dependency chains, dominator tree |
| `categorize` | Auto-discover subsystem boundaries from dependency structure |
| `distance` | Structural distance between two nodes with the path between them |
| `diff` | Compare two systems — what changed structurally |
| `trace` | Follow directed flow from A to B, optional defense node coverage check |
| `between` | How much of the system flows through a specific node |
| `extract` | Extract a subsystem as standalone EN source |
| `impact` | What changes if a node is removed, includes propagation |
| `evolve` | Dry-run a structural change before making it |
| `compose` | Merge two systems into one by linking shared entities |
| `conserve` | Structural invariants, deadlock analysis, complexity, resilience |
| `render` | SVG diagram |

## EN Syntax

One statement per line:

```
actor do: action needs: input1, input2 yields: output1, output2
```

Shared names between yields and needs create connections automatically:

```
customer do: place order needs: menu yields: order
kitchen do: prepare food needs: order yields: meal
waiter do: deliver needs: meal yields: served customer
```

Learn more at [endiagram.com](https://endiagram.com).

## License

MIT
