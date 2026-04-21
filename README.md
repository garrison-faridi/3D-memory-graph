# Memory Graph — Live 3D Visualization

Real-time 3D visualization of a [Vellum](https://www.vellum.ai) assistant's memory system. Reads directly from the assistant's SQLite database — every node, edge, and retrieval event is ground truth from the running system.

Chat with your assistant in one window. Watch its memory light up in another.

---

## How It Works

```
assistant.db (SQLite, WAL mode — read-only)
       ↓
Bun server (serves HTML + JSON endpoints)
       ↓ HTTP polling every 1.5s
Browser (Three.js + 3d-force-graph)
       ↓
Live updates: new nodes, new edges, retrieval cascades
```

The server opens the assistant's database in **read-only WAL mode** — safe for concurrent reads while the assistant is actively writing. The browser polls `/poll` for incremental events and `/data` for the full snapshot on load. Zero npm dependencies — only Bun built-ins (`bun:sqlite`, `fs`, `path`). Frontend libraries load from CDN.

---

## Two Versions

|                               | **Minimal** (`server.js`)  | **Full** (`server-full.js`) |
|-------------------------------|----------------------------|-----------------------------|
| Default port                  | 7777                       | 7778                        |
| Live retrieval animation      | ✅                         | ✅                          |
| Timeline playback             | ✅                         | ✅                          |
| Node inspection + search      | ✅                         | ✅                          |
| 🔥 Emotional charge halos    | —                          | ✅                          |
| ◎ Confidence rings            | —                          | ✅                          |
| ⚡ Reinforcement pulses       | —                          | ✅                          |
| ◉ Query point drop + lasers  | —                          | ✅                          |
| ⟷ Co-retrieval threads       | —                          | ✅                          |
| Source type → shape           | —                          | ✅                          |
| Narrative role markers        | —                          | ✅                          |
| Feature toggles               | —                          | ✅                          |
| Metadata live sync            | —                          | ✅                          |

**Start with the minimal version.** It's the clean demo. The full version adds every visual feature we've built — toggleable from the top bar.

---

## Prerequisites

- **[Bun](https://bun.sh)** v1.0+ runtime
- A **[Vellum](https://www.vellum.ai)** assistant with at least one conversation (so the database exists)

No `npm install`. No `node_modules`. The server uses Bun's built-in SQLite driver and standard Node-compatible APIs.

---

## Quick Start

```bash
# Clone
git clone https://github.com/garrison-faridi/3D-memory-graph.git
cd 3D-memory-graph

# Run the minimal version
bun server.js

# Or run the full "kitchen sink" version
bun server-full.js
```

Open [http://localhost:7777](http://localhost:7777) (minimal) or [http://localhost:7778](http://localhost:7778) (full).

The graph loads with all existing memories. Then open a separate chat with your assistant — new memories spawn with a green flash and retrieval cascades fire on every message.

---

## Configuration

### Database Path

By default the server looks for the Vellum database at:

```
~/.vellum/workspace/data/db/assistant.db
```

Override with a CLI argument or environment variable:

```bash
# CLI argument
bun server.js /custom/path/to/assistant.db

# Environment variable
VELLUM_DB=/custom/path/to/assistant.db bun server.js
```

### Port

```bash
PORT=9000 bun server.js
```

---

## What's On Screen

### Nodes = Memories

Each sphere is a memory — a discrete fact, event, behavior, or plan the assistant has stored.

- **Color** = memory type (7 categories, see legend)
- **Size** = significance × reinforcement count
- **Opacity** = fidelity (how vivid the memory is — decays without reinforcement)

| Type | Color | What It Stores |
|------|-------|----------------|
| `procedural` | 🟢 Green | How-to knowledge, workflows, instructions |
| `episodic` | 🔴 Pink | Events, conversations, moments in time |
| `semantic` | 🟣 Purple | Facts, definitions, stable knowledge |
| `behavioral` | 🔵 Teal | Habits, preferences, interaction patterns |
| `prospective` | 🟡 Gold | Plans, reminders, future intentions |
| `narrative` | 🟠 Orange | Story arcs, ongoing threads, context |
| `shared` | 🔴 Red | Shared context between user and assistant |

### Edges = Relationships

Lines between nodes are typed, weighted relationships:

| Relationship | Meaning |
|-------------|---------|
| `part-of` | Memory belongs to a larger structure |
| `reminds-of` | Associative link (retrieval affinity) |
| `depends-on` | Prerequisite relationship |
| `supersedes` | Newer memory replaces older |
| `caused-by` | Causal chain |
| `resolved-by` | Problem → solution link |
| `contradicts` | Conflicting information |

### Retrieval Animation

When you chat with the assistant, the system performs a **memory recall** — a vector similarity search across the graph. This fires a visual cascade:

1. **BFS wave** sweeps the graph from the top retrieval hit (white flash per node)
2. Non-matches fade to near-invisible
3. **Retrieved nodes stay lit** — these are the actual memories the assistant is using right now
4. A side panel shows retrieval results with cosine similarity scores

### Modes

- **LIVE** — Real-time. New nodes spawn as the assistant learns. Retrieval cascades fire as you chat.
- **TIMELINE** — Historical playback. Scrub from the assistant's first memory to the present and watch the graph grow from nothing.

---

## Full Version Features

All features toggle from the top bar. Everything below reads from real database fields — nothing is randomly generated.

### 🔥 Emotional Charge Halos

Glow around nodes based on `emotional_charge` metadata. Size = intensity (how emotionally significant). Color = valence (warm amber for positive, cool teal for negative). Milestone moments glow hot; procedural facts have no halo.

### ◎ Confidence Rings

Partial arc torus around each node. Fill proportional to the `confidence` field — how certain the system is that this memory is accurate. A full ring = 100% confident. A half ring = 50%.

### ⚡ Reinforcement Pulses

Expanding green ring when a node's `reinforcement_count` increments mid-conversation — the assistant just re-confirmed or strengthened a memory.

### ◉ Query Point Drop

On retrieval: a white pulsing sphere spawns at the centroid of all retrieved nodes, with animated laser lines extending to each hit. Line brightness = cosine similarity score. The centroid isn't a real construct — it's a visual anchor showing where the query "landed" in the graph's topology.

### ⟷ Co-Retrieval Threads

Gold dashed lines between every pair of nodes retrieved together in the same recall event. These reveal retrieval topology — which memories the system considers related even if they aren't directly connected by an edge.

### Source Type → Shape

Node geometry encodes how the memory was formed:

| Shape | Source | Meaning |
|-------|--------|---------|
| Sphere | `direct` | User told the assistant directly |
| Octahedron | `inferred` | Assistant figured it out |
| Dodecahedron | `observed` | Assistant noticed a pattern |
| Tetrahedron | `told-by-other` | Information from a third party |

### Narrative Role Markers

Diamond markers floating above nodes that play a key role in ongoing story arcs (turning points, inciting incidents, resolutions, theses).

---

## Accuracy & Honesty Labels

This visualization is explicit about what it shows and what it approximates.

### ✅ REAL (Ground Truth)

- **Nodes** — Every node comes from `memory_graph_nodes` in `assistant.db`. Type, content, timestamps, all metadata fields — unmodified ground truth.
- **Edges** — Every edge comes from `memory_graph_edges`. Typed relationships with numeric weights, directly from the database.
- **Retrieval hits** — When retrieval animates, the nodes that stay lit are the exact nodes the system retrieved. Their UUIDs come from `memory_recall_logs.top_candidates_json`.
- **New node detection** — Nodes that appear mid-conversation are real SQLite inserts, detected within 1–2 seconds.
- **Metadata** (full version) — Emotional charge, confidence, fidelity, source type, narrative role — all read from real database fields, not generated.

### ⚠️ APPROXIMATION

- **Spatial positions** — The 3D layout uses a force-directed simulation (d3-force). Clustering emerges from edge density, but exact XYZ positions are arbitrary. There is no "real" spatial position for a memory.
- **Query point centroid** (full version) — The white sphere's position is the geometric mean of retrieved nodes' positions. Since those positions are themselves approximate, the centroid is doubly approximate.

### 🎨 DECORATIVE

- **BFS cascade** — The white lightning wave animates along graph edges. Real retrieval is parallel vector comparison (cosine similarity across all nodes simultaneously), not graph traversal. The cascade is eye candy — the nodes that stay lit at the end are the real signal.
- **Edge particles** — Flowing dots on edges indicating relationship type. Pure visual flair.
- **Laser line animations** (full version) — The staggered extension of query point lines is choreographed for visual impact, not reflecting actual retrieval timing.

---

## Server Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serves the HTML visualization |
| `/data` | GET | Full graph snapshot (all nodes + edges as JSON) |
| `/poll` | GET | Incremental events since timestamps. Params: `recall`, `node`, `edge` (ms timestamps) |

The `/poll` endpoint is the live connection. The browser sends its latest-seen timestamps and gets back only new events (recalls, node creations, edge creations, and — on the full server — reinforcement and metadata changes).

---

## Database Schema

The visualization reads from three tables in `assistant.db`:

### `memory_graph_nodes`

| Column | Used For |
|--------|----------|
| `id` | Node identity (UUID) |
| `content` | Memory text (truncated to 400 chars for display) |
| `type` | Node color (procedural, episodic, semantic, behavioral, prospective, narrative, shared) |
| `created` | Timeline position, spawn detection |
| `fidelity` | Opacity (vivid → gone) |
| `confidence` | Confidence ring fill (full version) |
| `significance` | Node size |
| `stability` | Displayed in detail panel |
| `reinforcement_count` | Node size boost, pulse animation (full version) |
| `emotional_charge` | Halo glow size + color (full version) |
| `source_type` | Node shape (full version) |
| `narrative_role` | Diamond markers (full version) |

### `memory_graph_edges`

| Column | Used For |
|--------|----------|
| `source_node_id` / `target_node_id` | Edge endpoints |
| `relationship` | Edge color + particles |
| `weight` | Edge thickness |
| `created` | Timeline filtering, new edge detection |

### `memory_recall_logs`

| Column | Used For |
|--------|----------|
| `top_candidates_json` | Which nodes were retrieved (UUIDs + scores) |
| `created_at` | New retrieval detection |
| `latency_ms` | Displayed in retrieval panel |
| `semantic_hits` | Displayed in retrieval panel |

---

## Interaction Guide

| Action | What Happens |
|--------|-------------|
| **Click node** | Detail panel with full content, metadata, connected edges |
| **Click edge target in panel** | Fly camera to that connected node |
| **Hover node** | Highlight node + neighbors, brighten connected edges |
| **Type in search** | Filter to matching nodes, dim everything else |
| **Click TIMELINE** | Switch to historical scrubber mode |
| **Drag scrubber / press ▶** | Replay the graph growing from first memory |
| **Speed buttons** | 0.5×, 1×, 2×, 5×, 10× playback |
| **Click 🔄 Rotate** | Slow cinematic orbit |
| **Click background** | Deselect, restore all nodes |
| **Close retrieval panel (×)** | End spotlight, restore normal view |
| **Click ⓘ banner** | Show accuracy & honesty labels |

---

Built on [Vellum](https://www.vellum.ai).
