---
name: memory-graph
description: Generate an interactive 2D or 3D visualization of the assistant's memory and knowledge graph. Renders nodes, connections, and categories as a force-directed graph in a self-contained HTML file.
activation-hints:
  - visualize my memory
  - show me your knowledge graph
  - build a memory map
  - what does your memory look like
  - graph my knowledge base
avoid-when:
  - User wants to search or recall specific memories (use recall instead)
  - User wants to edit or manage memory entries
compatibility: Designed for Vellum personal assistants
---

# Memory Graph Visualization

You generate interactive HTML visualizations of your memory and knowledge base as force-directed graphs.

## When to Use

- User asks to see/visualize your memory, knowledge, or what you know
- User wants a map of topics, people, projects, and how they connect
- User asks for a knowledge graph or memory graph

## How It Works

### Step 1: Gather Data

Read your PKB files, memory, or any markdown knowledge files. For each file, extract:
- **Nodes** — people, projects, events, concepts, tools, companies, etc.
- **Categories** — group each node (person, project, event, tool, company, etc.)
- **Connections** — which nodes relate to each other and how

### Step 2: Build Graph JSON

Run the graph builder script to generate structured JSON:

```bash
python3 scripts/build_graph_data.py --input <dir_of_markdown_files> --output /tmp/graph_data.json
```

Or build the JSON manually with this structure:

```json
{
  "nodes": [
    {"id": "n_0", "label": "Node Name", "category": "person", "detail": "Description", "type": "hub", "size": 20}
  ],
  "links": [
    {"source": "n_0", "target": "n_1", "relation": "works_at", "strength": 1}
  ],
  "category_colors": {
    "person": "#e06c75",
    "project": "#98c379",
    "event": "#e5c07b"
  },
  "stats": {"total_nodes": 0, "total_links": 0}
}
```

Node types: `"hub"` (large, central) or `"entity"` (standard). Size range: 6-28.

### Step 3: Generate HTML

Read the template from `assets/template-3d.html` (or `template-2d.html`).
Replace the placeholder `const DATA = __GRAPH_DATA__;` with the actual JSON.
Write the final HTML to a scratch file for the user.

### Step 4: Deliver

Tell the user where the file is and how to open it:
```
open <path_to_file>
```

## Customization

- **Colors**: Edit `category_colors` in the JSON to match your aesthetic
- **Node sizing**: Hub nodes should be 18-28, entities 6-16. Size by importance or connection count.
- **3D vs 2D**: 3D is the visual showstopper, 2D is more practical for daily use
- **Click behavior**: Clicking a node dims unconnected nodes and brightens connections

## Retrieval Graph Mode

For a "ground truth" retrieval graph, run `recall` for each node label and draw edges based on which other nodes appear in the results. This shows how memory *actually* retrieves vs how you *think* things connect.
