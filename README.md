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

Six questions about any system, plus a render tool. Every tool takes `source` (EN code or `.en`/`.txt` file path). Tool names are shorthand, not specs — read each description before calling; `compose` and `equivalent` are mode-based, not general analyzers.

| Tool | What it answers | Levers |
|------|-----------------|--------|
| `structure` | What is this system? Shape, stages, bridges, cycles, critical path, dominator tree, min-cuts, subsystems, actors, locations. | `detect_findings=true` flags risks (unguarded-sink, single-cut-path, multi-cut-path); `node=X` returns per-node centrality (betweenness, closeness, eigenvector). |
| `invariant` | What's always true? Conservation laws, T-invariants (sustainable cycles), depletable sets, deficiency, reversibility. | `rules` (one per line) checks custom claims. Four supported shapes: `no bridge that is also hub` · `every path from X to Y passes through at least one of [A,B,C]` (precedence) · `no node with centrality above N` · `removing any single node disconnects at most N others`. |
| `live` | Can it deadlock? Can entities overflow? Siphons, traps, unbounded cycles, structural liveness and boundedness. | — |
| `reachable` | Can X reach Y? Path, distance, boundary crossings. `from`/`to` accept entity or action names. | `defense_nodes=a,b,c` checks whether guards cover every path. |
| `equivalent` | Are two systems the same, or what changes if I change this one? | Compare mode (`source_a`+`source_b`): edit distance + spectral cospectrality. Evolve mode (`source`+`patch`): plain EN adds; `- name` removes; same-name replaces. |
| `compose` | How do parts combine (merge) or how does a part stand alone (extract)? | Merge: `source_a`+`source_b`+`links` (`a.entity=b.entity` per line). Extract: `source`+`subsystem` (names come from `structure.subsystems`). |
| `render` | SVG or PNG diagram. Only call when the user asks to visualize. | Themes: `Editorial`, `Primer`, `Carbon` (each ± `isDark`) or seed-derived from `color=#RRGGBB`. `structure_layers` bitmask (1=subsystems, 2=pipelines, 4=cycles, 8=forks, 16=joins, 32=hubs, 64=deadlock, 128=overflow). |

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

## Modeling

Same name = same thing. Put all required inputs in one `needs:` list (AND). Give two actions the same yield-name to offer alternatives (OR). Sequence = one action consuming another's yield. Re-yield stateful resources to keep them persistent; one-shot data stays consumed. Model at the real atomic granularity — split only when the pieces could be accessed independently.

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
