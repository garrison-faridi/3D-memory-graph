#!/usr/bin/env bun
// Memory Graph Live Server — Full "Kitchen Sink" Version
//
// Everything from the minimal server PLUS:
//   - Reinforcement change detection (expanding green pulse when a node is reinforced)
//   - Co-retrieval pairing (gold threads between nodes retrieved together)
//   - Real-time metadata sync (fidelity decay, confidence shifts, emotional charge changes)
//
// Usage:
//   bun server-full.js                                    # default DB path
//   bun server-full.js /path/to/assistant.db              # custom DB path
//   VELLUM_DB=/path/to/db PORT=9000 bun server-full.js    # env vars
//
// Then open http://localhost:7778

import { Database } from "bun:sqlite";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

// ── Configuration ────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "7778");
const DEFAULT_DB = resolve(homedir(), ".vellum/workspace/data/db/assistant.db");
const DB_PATH = process.env.VELLUM_DB || Bun.argv[2] || DEFAULT_DB;
const HTML_PATH = resolve(import.meta.dir, "views/full.html");

// ── Validate paths ───────────────────────────────────────────────────
if (!existsSync(DB_PATH)) {
  console.error(`
  ❌ Database not found: ${DB_PATH}

  Make sure Vellum is installed and has been used at least once.
  The assistant's database is created after your first conversation.

  Provide a custom path:
    bun server-full.js /path/to/assistant.db
    VELLUM_DB=/path/to/assistant.db bun server-full.js
`);
  process.exit(1);
}

if (!existsSync(HTML_PATH)) {
  console.error(`\n  ❌ HTML file not found: ${HTML_PATH}\n`);
  process.exit(1);
}

// ── Database ─────────────────────────────────────────────────────────
const db = new Database(DB_PATH, { readonly: true });
db.exec("PRAGMA journal_mode=WAL");

// ── Metadata Snapshot ────────────────────────────────────────────────
// Tracks volatile fields to detect changes between polls.
// Only mutated by the /poll endpoint (not a background thread),
// so state is consistent for single-client use.
const metadataSnapshot = new Map();
let metadataPollCounter = 0;
const METADATA_SYNC_INTERVAL = 5; // full sync every 5th poll (~7.5s at 1.5s intervals)

function initMetadataSnapshot() {
  const rows = db
    .query(
      `SELECT id, reinforcement_count, fidelity, confidence,
              emotional_charge, last_accessed
       FROM memory_graph_nodes`
    )
    .all();
  for (const r of rows) {
    metadataSnapshot.set(r.id, {
      reinforcement_count: r.reinforcement_count || 0,
      fidelity: r.fidelity || "vivid",
      confidence: r.confidence || 0.5,
      emotional_charge: r.emotional_charge || "{}",
      last_accessed: r.last_accessed || 0,
    });
  }
}
initMetadataSnapshot();

function checkMetadataChanges() {
  const reinforcements = [];
  const metadataUpdates = [];

  metadataPollCounter++;
  const fullSync = metadataPollCounter % METADATA_SYNC_INTERVAL === 0;

  const query = fullSync
    ? `SELECT id, reinforcement_count, fidelity, confidence,
              emotional_charge, last_accessed FROM memory_graph_nodes`
    : `SELECT id, reinforcement_count, fidelity FROM memory_graph_nodes`;
  const rows = db.query(query).all();

  for (const r of rows) {
    const prev = metadataSnapshot.get(r.id);
    if (!prev) {
      metadataSnapshot.set(r.id, {
        reinforcement_count: r.reinforcement_count || 0,
        fidelity: r.fidelity || "vivid",
        confidence: r.confidence || 0.5,
        emotional_charge: r.emotional_charge || "{}",
        last_accessed: r.last_accessed || 0,
      });
      continue;
    }

    // Reinforcement (every cycle)
    const currReinf = r.reinforcement_count || 0;
    if (currReinf > prev.reinforcement_count) {
      reinforcements.push({
        id: r.id,
        prev: prev.reinforcement_count,
        curr: currReinf,
        fidelity: r.fidelity,
      });
      prev.reinforcement_count = currReinf;
    }

    // Fidelity (every cycle — most visible decay)
    if (r.fidelity !== prev.fidelity) {
      metadataUpdates.push({ id: r.id, field: "fidelity", value: r.fidelity });
      prev.fidelity = r.fidelity;
    }

    // Full sync fields (every Nth poll)
    if (fullSync) {
      if (r.confidence !== prev.confidence) {
        metadataUpdates.push({
          id: r.id,
          field: "confidence",
          value: r.confidence,
        });
        prev.confidence = r.confidence;
      }
      if (r.emotional_charge !== prev.emotional_charge) {
        let valence = 0,
          intensity = 0;
        try {
          const ec = JSON.parse(r.emotional_charge);
          valence = ec?.valence ?? 0;
          intensity = ec?.intensity ?? 0;
        } catch {}
        metadataUpdates.push({
          id: r.id,
          field: "emotional_charge",
          value: { valence, intensity },
        });
        prev.emotional_charge = r.emotional_charge;
      }
      if (r.last_accessed !== prev.last_accessed) {
        prev.last_accessed = r.last_accessed;
      }
    }
  }
  return { reinforcements, metadataUpdates };
}

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

      // Build co-retrieval pairs — every pair of nodes retrieved together
      const coRetrievalPairs = [];
      for (let i = 0; i < graphNodes.length; i++) {
        for (let j = i + 1; j < graphNodes.length; j++) {
          coRetrievalPairs.push({
            a: graphNodes[i].key,
            b: graphNodes[j].key,
            strength:
              (graphNodes[i].finalScore + graphNodes[j].finalScore) / 2,
          });
        }
      }

      return {
        id: row.id,
        created_at: row.created_at,
        latency_ms: row.latency_ms,
        semantic_hits: row.semantic_hits,
        graphNodes,
        coRetrievalPairs,
      };
    });
}

function getNewNodes(since) {
  return db
    .query(
      `SELECT id, content, type, created, confidence, significance, stability,
              reinforcement_count, fidelity, source_type, narrative_role,
              part_of_story, emotional_charge, last_accessed
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

    // Full graph snapshot
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

    // Incremental poll — events since client-supplied timestamps
    // Also detects metadata changes (reinforcement, fidelity, confidence, emotion)
    if (url.pathname === "/poll") {
      const sinceRecall = parseInt(url.searchParams.get("recall") || "0");
      const sinceNode = parseInt(url.searchParams.get("node") || "0");
      const sinceEdge = parseInt(url.searchParams.get("edge") || "0");

      const events = [];
      try {
        for (const r of getRecallLogs(sinceRecall)) {
          if (r.graphNodes.length > 0)
            events.push({ type: "recall", data: r });
        }
        for (const n of getNewNodes(sinceNode)) {
          events.push({ type: "node_created", data: n });
        }
        for (const e of getNewEdges(sinceEdge)) {
          events.push({ type: "edge_created", data: e });
        }

        // Metadata changes (full version only)
        const { reinforcements, metadataUpdates } = checkMetadataChanges();
        for (const r of reinforcements) {
          events.push({ type: "reinforcement", data: r });
        }
        if (metadataUpdates.length > 0) {
          events.push({ type: "metadata_update", data: metadataUpdates });
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
  🧠 Memory Graph — Full Server
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  → http://localhost:${PORT}
  → DB: ${DB_PATH}
  → Features: emotional halos, confidence rings,
    reinforcement pulses, query point drop,
    co-retrieval threads, metadata sync

  Open the URL in a browser, then chat
  with your assistant — the graph updates
  in real time with each message.
`);
