#!/usr/bin/env python3
"""
Build graph data JSON from markdown knowledge base files.
Usage: python3 build_graph_data.py --input <dir> --output <output.json>

Scans markdown files, extracts entities and relationships,
outputs structured JSON for the memory graph visualization templates.
"""

import argparse
import json
import os
import re
import sys

# Default category color palette
DEFAULT_COLORS = {
    "person": "#e06c75",
    "project": "#98c379",
    "event": "#e5c07b",
    "company": "#61afef",
    "tool": "#4ecdc4",
    "skill": "#6c5ce7",
    "concept": "#c678dd",
    "strategy": "#c678dd",
    "technical": "#b2bec3",
    "data": "#56b6c2",
    "content": "#f7dc6f",
    "partner": "#fab1a0",
    "competitor": "#ff6b6b",
    "component": "#d19a66",
    "feature": "#98c379",
    "platform": "#56b6c2",
    "equipment": "#d19a66",
    "channel": "#45b7d1",
    "logistics": "#a29bfe",
    "system": "#fd79a8",
    "identity": "#ff9ff3",
    "infrastructure": "#b2bec3",
    "bug": "#e06c75",
    "issue": "#e06c75",
    "blocked": "#636e72",
    "constraint": "#636e72",
}


def read_markdown_files(input_dir):
    """Read all .md files from directory."""
    contents = {}
    for fname in sorted(os.listdir(input_dir)):
        if fname.endswith('.md') and not fname.startswith('_'):
            path = os.path.join(input_dir, fname)
            with open(path, 'r', encoding='utf-8') as f:
                contents[fname] = f.read()
    return contents


def extract_headers(text):
    """Extract markdown headers as potential node labels."""
    headers = []
    for line in text.split('\n'):
        m = re.match(r'^(#{1,4})\s+(.+)', line)
        if m:
            level = len(m.group(1))
            title = m.group(2).strip()
            # Skip generic headers
            if title.lower() not in ('overview', 'notes', 'details', 'summary', 'status'):
                headers.append({'level': level, 'title': title})
    return headers


def build_example_graph():
    """Build an example graph to demonstrate the format."""
    nodes = [
        {"id": "n_0", "label": "You", "category": "identity", "detail": "The assistant — your knowledge hub.", "type": "hub", "size": 24},
        {"id": "n_1", "label": "Your User", "category": "person", "detail": "The person you assist.", "type": "hub", "size": 22},
        {"id": "n_2", "label": "Project Alpha", "category": "project", "detail": "A key project you're tracking.", "type": "hub", "size": 18},
        {"id": "n_3", "label": "Daily Standup", "category": "event", "detail": "Recurring team sync.", "type": "entity", "size": 12},
        {"id": "n_4", "label": "Slack", "category": "tool", "detail": "Primary communication tool.", "type": "entity", "size": 10},
        {"id": "n_5", "label": "Competitor X", "category": "competitor", "detail": "Key competitor being tracked.", "type": "entity", "size": 10},
        {"id": "n_6", "label": "Feature Launch", "category": "event", "detail": "Upcoming feature release.", "type": "entity", "size": 14},
        {"id": "n_7", "label": "Team Lead", "category": "person", "detail": "Engineering lead on Project Alpha.", "type": "entity", "size": 12},
    ]
    links = [
        {"source": "n_0", "target": "n_1", "relation": "assists", "strength": 1},
        {"source": "n_1", "target": "n_2", "relation": "owns", "strength": 1},
        {"source": "n_2", "target": "n_3", "relation": "has_meeting", "strength": 1},
        {"source": "n_2", "target": "n_6", "relation": "milestone", "strength": 1},
        {"source": "n_2", "target": "n_7", "relation": "led_by", "strength": 1},
        {"source": "n_1", "target": "n_4", "relation": "uses", "strength": 1},
        {"source": "n_0", "target": "n_5", "relation": "tracks", "strength": 1},
        {"source": "n_6", "target": "n_5", "relation": "competes_with", "strength": 1},
    ]
    return {
        "nodes": nodes,
        "links": links,
        "category_colors": DEFAULT_COLORS,
        "stats": {"total_nodes": len(nodes), "total_links": len(links)}
    }


def main():
    parser = argparse.ArgumentParser(description='Build memory graph data from markdown files')
    parser.add_argument('--input', '-i', help='Directory of markdown files to scan')
    parser.add_argument('--output', '-o', default='/tmp/graph_data.json', help='Output JSON path')
    parser.add_argument('--example', action='store_true', help='Generate example graph data')
    args = parser.parse_args()

    if args.example:
        data = build_example_graph()
    elif args.input:
        if not os.path.isdir(args.input):
            print(f"Error: {args.input} is not a directory", file=sys.stderr)
            sys.exit(1)
        files = read_markdown_files(args.input)
        print(f"Read {len(files)} markdown files from {args.input}")
        print("Files:", ', '.join(files.keys()))
        print()
        print("NOTE: This script extracts file structure. For full node/link extraction,")
        print("have your LLM analyze the files and generate the JSON using the schema in SKILL.md.")
        print()
        # Output a skeleton with file-level nodes
        nodes = []
        for i, (fname, content) in enumerate(files.items()):
            label = fname.replace('.md', '').replace('-', ' ').title()
            headers = extract_headers(content)
            detail = f"{len(headers)} sections, {len(content)} chars"
            nodes.append({
                "id": f"n_{i}", "label": label, "category": "system",
                "detail": detail, "type": "hub", "size": min(28, 10 + len(headers))
            })
        data = {
            "nodes": nodes, "links": [],
            "category_colors": DEFAULT_COLORS,
            "stats": {"total_nodes": len(nodes), "total_links": 0}
        }
    else:
        print("Usage: python3 build_graph_data.py --input <dir> --output <out.json>")
        print("       python3 build_graph_data.py --example --output <out.json>")
        sys.exit(1)

    with open(args.output, 'w') as f:
        json.dump(data, f)
    print(f"Wrote {data['stats']['total_nodes']} nodes, {data['stats']['total_links']} links → {args.output}")


if __name__ == '__main__':
    main()
