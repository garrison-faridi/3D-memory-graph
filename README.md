# memory-graph

Interactive 2D and 3D visualizations of your AI assistant's memory and knowledge graph.

![3D Memory Graph](https://img.shields.io/badge/WebGL-3D_Force_Graph-4ecdc4) ![2D Memory Graph](https://img.shields.io/badge/Canvas-2D_Force_Graph-61afef)

## What It Does

Turns your assistant's memory into a navigable, interactive force-directed graph. Nodes represent people, projects, events, tools, and concepts your assistant tracks. Connections represent relationships — either inferred from knowledge base structure or drawn from actual semantic retrieval results.

Two visualization modes:
- **3D** — WebGL with emissive glow spheres, orbital camera, teal particle animations on links, click-to-isolate connected nodes
- **2D** — Canvas-based with diamond hubs, directional particles, hover tooltips

Both are self-contained HTML files — no server required. Open in any browser.

## Quickstart

### 1. Install the skill

```bash
# Copy to your assistant's skills directory
cp -r memory-graph /path/to/workspace/skills/
```

### 2. Generate example graph

```bash
python3 scripts/build_graph_data.py --example --output /tmp/graph_data.json
```

### 3. Build the visualization

Ask your assistant:
> "Visualize your memory as a 3D graph"

Or manually inject data into the template:

```bash
# Replace the placeholder in the template with your data
python3 -c "
import json
with open('/tmp/graph_data.json') as f: data = f.read()
with open('assets/template-3d.html') as f: html = f.read()
html = html.replace('const DATA = __GRAPH_DATA__;', f'const DATA = {data};')
with open('my-graph.html', 'w') as f: f.write(html)
"
open my-graph.html
```

## Graph Data Format

```json
{
  "nodes": [
    {
      "id": "n_0",
      "label": "Node Name",
      "category": "person",
      "detail": "Short description",
      "type": "hub",
      "size": 20
    }
  ],
  "links": [
    {
      "source": "n_0",
      "target": "n_1",
      "relation": "works_at",
      "strength": 1
    }
  ],
  "category_colors": {
    "person": "#e06c75",
    "project": "#98c379",
    "event": "#e5c07b",
    "company": "#61afef",
    "tool": "#4ecdc4"
  },
  "stats": {
    "total_nodes": 2,
    "total_links": 1
  }
}
```

### Node Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `label` | string | Display name |
| `category` | string | Category key (maps to color) |
| `detail` | string | Tooltip / description |
| `type` | `"hub"` or `"entity"` | Hub = large central node, Entity = standard |
| `size` | number | 6-28, controls visual size |

### Link Fields

| Field | Type | Description |
|-------|------|-------------|
| `source` | string | Source node id |
| `target` | string | Target node id |
| `relation` | string | Edge label |
| `strength` | number | 0-1, affects layout force |

## Retrieval Graph Mode

Instead of manually drawing connections, you can build a **ground truth retrieval graph** by querying the assistant's semantic memory for every node and drawing edges based on what the recall system actually returns.

This shows how memory *retrieves* vs how you *think* things connect. In our testing, the inferred graph and retrieval graph had similar edge counts but only **23% overlap** — two very different maps of the same territory.

To build one:
1. For each node, run a semantic recall query with the node's label
2. Scan each result for mentions of other node labels
3. Draw an edge wherever one node's recall results mention another

Limitations:
- Single query phrasing per node (different wording = different edges)
- Label matching only (misses semantic matches without explicit mentions)
- Top-N cutoff drops weak associations
- Approximation of retrieval topology, not an exact mirror

## 3D Features

- **Emissive glow spheres** — MeshPhongMaterial with emissiveIntensity 0.55
- **Outer halo** — Transparent sphere at 1.25x radius
- **Click-to-isolate** — Click a node to dim unconnected nodes (12% opacity) and hide unconnected links
- **Teal particles** — Directional particles flowing on all links
- **3-point lighting** — Ambient + teal point light + purple point light
- **Category coloring** — One Monokai-inspired palette

## 2D Features

- **Diamond hub nodes** — Hub nodes render as diamonds, entities as circles
- **Directional particles** — Teal particles on links
- **Hover tooltips** — Node details on hover
- **Canvas rendering** — Smooth 60fps with d3-force layout

## Dependencies

**3D template:**
- [three.js](https://threejs.org/) v0.160.0
- [3d-force-graph](https://github.com/vasturiano/3d-force-graph) v1.73.4

**2D template:**
- [force-graph](https://github.com/vasturiano/force-graph) (vasturiano)

All loaded from CDN — no install required.

## File Structure

```
memory-graph/
├── SKILL.md              # Vellum skill instructions
├── README.md             # This file
├── scripts/
│   └── build_graph_data.py   # Graph data generator
└── assets/
    ├── template-2d.html      # 2D visualization template
    └── template-3d.html      # 3D visualization template
```

## License

MIT
