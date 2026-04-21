#!/usr/bin/env bun
// Memory Graph Live Server — Minimal Version
//
// Reads directly from the Vellum assistant's SQLite database (WAL mode,
// read-only) and serves a live 3D visualization. The browser polls the
// server for incremental updates — no background threads needed.
//
// Usage:
//   bun server.js                                    # default DB path
//   bun server.js /path/to/assistant.db              # custom DB path
//   VELLUM_DB=/path/to/db PORT=8080 bun server.js    # env vars
//
// Then open http://localhost:7777

import { Database } from "bun:sqlite";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

// ── Configuration ────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "7777");
const DEFAULT_DB = resolve(homedir(), ".vellum/workspace/data/db/assistant.db");
const DB_PATH = process.env.VELLUM_DB || Bun.argv[2] || DEFAULT_DB;
const HTML_PATH = resolve(import.meta.dir, "views/live.html");

// ── Validate paths ───────────────────────────────────────────────────
if (!existsSync(DB_PATH)) {
  console.error(`
  ❌ Database not found: ${DB_PATH}

  Make sure Vellum is installed and has been used at least once.
  The assistant's database is created after your first conversation.

  Provide a custom path:
    bun server.js /path/to/assistant.db
    VELLUM_DB=/path/to/assistant.db bun server.js
`);
  process.exit(1);
}

if (!existsSync(HTML_PATH)) {
  console.error(`\n  ❌ HTML file not found: ${HTML_PATH}\n`);
  process.exit(1);
}

// ── Database ─────────────────────────────────────────────────────────
const db = new Database(DB_PATH, { readonly: true });
db.exec("PRAGMA journal_mode=WAL"); // concurrent reads safe

// ── Queries ──────────────────────────────────────────────────────────

function getAllData() {
  const nodes = db
    .query(
      `SELECT id, content, type, created, last_accessed, emotional_charge,
              fidelity, confidence, significance, stability, reinforcement_count,
              source_type, narrative_role
       FROM memory_graph_nodes`
    )
    .all()
    .map(parseNode);

  const edges = db
    .query(
      `SELECT id, source_node_id, target_node_id, relationship, weight, created
       FROM memory_graph_edges`
    )
    .all()
    .map(parseEdge);

  return { nodes, edges };
}

function getRecallLogs(since) {
  return db
    .query(
      `SELECT id, top_candidates_json, created_at, semantic_hits,
              merged_count, selected_count, latency_ms, query_context
       FROM memory_recall_logs
       WHERE created_at > ?
       ORDER BY created_at ASC`
    )
    .all(since)
    .map((row) => {
      let graphNodes = [];
      try {
        const candidates = JSON.parse(row.top_candidates_json);
        graphNodes = candidates
          .filter((c) => c.kind === "graph")
          .map((c) => ({
            key: c.key,
            type: c.type,
            finalScore: c.finalScore,
            semantic: c.semantic,
            recency: c.recency,
          }));
      } catch {}
      return {
        id: row.id,
        created_at: row.created_at,
        latency_ms: row.latency_ms,
        semantic_hits: row.semantic_hits,
        graphNodes,
      };
    });
}

function getNewNodes(since) {
  return db
    .query(
      `SELECT id, content, type, created, confidence, significance, stability,
              reinforcement_count, fidelity, source_type, emotional_charge
       FROM memory_graph_nodes
       WHERE created > ?
       ORDER BY created ASC`
    )
    .all(since)
    .map(parseNode);
}

function getNewEdges(since) {
  return db
    .query(
      `SELECT source_node_id, target_node_id, relationship, weight, created
       FROM memory_graph_edges
       WHERE created > ?
       ORDER BY created ASC`
    )
    .all(since)
    .map(parseEdge);
}

// ── Row parsers ──────────────────────────────────────────────────────

function parseNode(n) {
  let valence = 0,
    intensity = 0;
  try {
    const ec = JSON.parse(n.emotional_charge);
    valence = ec?.valence ?? 0;
    intensity = ec?.intensity ?? 0;
  } catch {}
  return {
    ...n,
    label: (n.content || "").substring(0, 80),
    content: (n.content || "").substring(0, 400),
    valence,
    intensity,
  };
}

function parseEdge(e) {
  return {
    source: e.source_node_id,
    target: e.target_node_id,
    relationship: e.relationship,
    weight: e.weight,
    created: e.created,
  };
}

// ── HTTP Server ──────────────────────────────────────────────────────
const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);

    // Serve the visualization
    if (url.pathname === "/" || url.pathname === "/index.html") {
      try {
        const html = readFileSync(HTML_PATH, "utf-8");
        return new Response(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        });
      } catch (e) {
        return new Response("HTML file not found: " + e.message, {
          status: 500,
        });
      }
    }

    // Full graph snapshot — all nodes and edges
    if (url.pathname === "/data") {
      try {
        const data = getAllData();
        return Response.json(data, {
          headers: { "Access-Control-Allow-Origin": "*" },
        });
      } catch (e) {
        return Response.json(
          { error: e.message },
          { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
        );
      }
    }

    // Incremental poll — returns events since client-supplied timestamps
    if (url.pathname === "/poll") {
      const sinceRecall = parseInt(url.searchParams.get("recall") || "0");
      const sinceNode = parseInt(url.searchParams.get("node") || "0");
      const sinceEdge = parseInt(url.searchParams.get("edge") || "0");

      const events = [];
      try {
        for (const r of getRecallLogs(sinceRecall)) {
          if (r.graphNodes.length > 0) events.push({ type: "recall", data: r });
        }
        for (const n of getNewNodes(sinceNode)) {
          events.push({ type: "node_created", data: n });
        }
        for (const e of getNewEdges(sinceEdge)) {
          events.push({ type: "edge_created", data: e });
        }
      } catch (err) {
        console.error("[poll]", err.message);
      }

      return Response.json(
        { events },
        {
          headers: {
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    return new Response("Not found", { status: 404 });
  },
});

// ── Startup ──────────────────────────────────────────────────────────
console.log(`
  🧠 Memory Graph Live Server
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━
  → http://localhost:${PORT}
  → DB: ${DB_PATH}

  Open the URL in a browser, then chat
  with your assistant — the graph updates
  in real time with each message.
`);
