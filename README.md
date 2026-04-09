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
| `structure` | Topology, bridges, bottlenecks, parallelism, critical path, dominator tree, subsystems |
| `invariant` | Conservation laws, deadlock detection, boundedness, structural complexity |
| `live` | Liveness analysis — can resources drain permanently? Can queues overflow? |
| `reachable` | Path tracing between any two points — distance, intermediaries, defense coverage |
| `equivalent` | Compare two systems or simulate a change — what breaks, what shifts |
| `compose` | Extract or merge subsystems — interface boundaries, shared resources |
| `render` | SVG diagram of the system |

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

## Telemetry

`@endiagram/mcp` generates a random install ID on first run, stored at
`~/.endiagram/install-id` (mode `0600`). It is sent with every request as
the `X-Endiagram-Install-Id` HTTP header so we can correlate requests
from the same install for debugging issues that the per-IP signal alone
cannot track (mobile networks, VPNs, CGNAT all collapse or churn IPs).

**No source code, no file paths, no environment variables, and no PII
are sent.** The install ID is a random opaque UUIDv4 generated locally.

A first-run notice prints to **stderr** (never stdout — stdout is the
MCP JSON-RPC channel) with the disclosure and the opt-out instructions.
The notice fires once per install and never again.

### Opting out

Any of these three methods disables the install ID:

1. Set `ENDIAGRAM_TELEMETRY=off` as an environment variable (also
   accepts `0`, `false`, `no`).
2. Create a file at `~/.endiagram/telemetry` containing the word `off`.
3. Delete `~/.endiagram/install-id`. (A new one is generated on next
   run unless option 1 or 2 is also set.)

When any of these is active, the `X-Endiagram-Install-Id` header is not
sent at all — the server falls back to its per-IP HMAC `cid` for
correlation, which works fine for short-term per-session tracing.

Full privacy policy: [endiagram.com/privacy](https://endiagram.com/privacy)

## License

MIT
