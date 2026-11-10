/* eslint-disable @typescript-eslint/no-explicit-any */
// Routeplanner voor de WetterWinkel-app.
//
// Vaarwegennet: NWB Vaarwegen (Rijkswaterstaat via PDOK, CC0).
// Bruggen, doorvaarthoogtes en sluizen: Fairway Information Services (Rijkswaterstaat).
// Bewust zonder imports, zodat dit los te testen is.

const NWB_URL =
  "https://api.pdok.nl/rws/nationaal-wegenbestand-vaarwegen/ogc/v1/collections/vaarwegvakken/items?f=json&limit=1000";
const FIS_WFS =
  "https://geo.rijkswaterstaat.nl/services/ogc/gdr/fis_vnds/ows?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json";

type Coord = [number, number]; // [lon, lat]

type Edge = {
  id: number;
  a: string;
  b: string;
  coords: Coord[];
  cum: number[]; // cumulatieve lengte in meters per punt
  len: number;
  name: string;
  objects: RouteObject[];
  blockedFor: number; // doorvaarthoogte waarboven deze vaarweg niet kan (Infinity = geen vaste brug)
};

export type RouteObject = {
  kind: "bridge" | "lock";
  id: number;
  name: string;
  city: string;
  canOpen: boolean;
  clearance: number | null;
  pos: number; // meters vanaf begin van de edge
  lat: number;
  lon: number;
};

type Network = {
  edges: Edge[];
  adjacency: Map<string, number[]>;
  grid: Map<string, Array<[number, number]>>; // cel -> [edgeIndex, segmentIndex]
  builtAt: number;
  stats: Record<string, number>;
};

const R = 6371000;
const CELL = 0.01;

function dist(a: Coord, b: Coord) {
  const x = ((b[0] - a[0]) * Math.PI) / 180 * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  const y = ((b[1] - a[1]) * Math.PI) / 180;
  return Math.sqrt(x * x + y * y) * R;
}

// Afstand van punt p tot segment a-b, plus fractie t langs het segment.
function pointSegment(p: Coord, a: Coord, b: Coord) {
  const k = Math.cos((p[1] * Math.PI) / 180);
  const ax = a[0] * k, ay = a[1], bx = b[0] * k, by = b[1], px = p[0] * k, py = p[1];
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const proj: Coord = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return { d: dist(p, proj), t, proj };
}

function cellKey(lon: number, lat: number) {
  return `${Math.floor(lon / CELL)}:${Math.floor(lat / CELL)}`;
}

async function getJson(url: string, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`${response.status} bij ${url.slice(0, 80)}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function lineCoords(geometry: any): Coord[] {
  if (!geometry) return [];
  if (geometry.type === "LineString") return geometry.coordinates;
  if (geometry.type === "MultiLineString") {
    const out: Coord[] = [];
    for (const part of geometry.coordinates || []) {
      for (const c of part) {
        const last = out[out.length - 1];
        if (!last || last[0] !== c[0] || last[1] !== c[1]) out.push([c[0], c[1]]);
      }
    }
    return out;
  }
  return [];
}

function centroid(geometry: any): Coord | null {
  if (!geometry) return null;
  if (geometry.type === "Point") return [geometry.coordinates[0], geometry.coordinates[1]];
  let ring: Coord[] | null = null;
  if (geometry.type === "Polygon") ring = geometry.coordinates?.[0];
  if (geometry.type === "MultiPolygon") ring = geometry.coordinates?.[0]?.[0];
  if (!ring?.length) return null;
  let x = 0, y = 0;
  for (const c of ring) { x += c[0]; y += c[1]; }
  return [x / ring.length, y / ring.length];
}

async function loadNwb() {
  const features: any[] = [];
  let url: string | null = NWB_URL;
  for (let page = 0; url && page < 60; page++) {
    const data: any = await getJson(url);
    features.push(...(data.features || []));
    const next = (data.links || []).find((l: any) => l.rel === "next");
    url = next?.href || null;
  }
  return features;
}

function nearestSegment(net: Network, p: Coord, maxMeters: number) {
  let best: { edge: number; seg: number; d: number; t: number; proj: Coord } | null = null;
  const cx = Math.floor(p[0] / CELL), cy = Math.floor(p[1] / CELL);
  const maxRing = Math.ceil(maxMeters / 600) + 1;
  for (let ring = 0; ring <= maxRing; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const list = net.grid.get(`${cx + dx}:${cy + dy}`);
        if (!list) continue;
        for (const [ei, si] of list) {
          const e = net.edges[ei];
          const r = pointSegment(p, e.coords[si], e.coords[si + 1]);
          if (!best || r.d < best.d) best = { edge: ei, seg: si, d: r.d, t: r.t, proj: r.proj };
        }
      }
    }
    // Zodra er iets dichtbij gevonden is en de volgende ring verder weg ligt: stoppen.
    if (best && best.d < ring * 600) break;
  }
  return best && best.d <= maxMeters ? best : null;
}

export async function buildNetwork(log: (msg: string) => void = () => {}): Promise<Network> {
  const started = Date.now();
  const [nwb, bruggen, openingen, sluizen] = await Promise.all([
    loadNwb(),
    getJson(`${FIS_WFS}&typeName=brug&count=20000`).then((d) => d.features || []),
    getJson(`${FIS_WFS}&typeName=opening&count=20000`).then((d) => d.features || []),
    getJson(`${FIS_WFS}&typeName=sluis&count=5000`).then((d) => d.features || []),
  ]);
  log(`data geladen: ${nwb.length} vaarwegvakken, ${bruggen.length} bruggen, ${openingen.length} openingen, ${sluizen.length} sluizen in ${Date.now() - started} ms`);

  const edges: Edge[] = [];
  const adjacency = new Map<string, number[]>();
  const grid = new Map<string, Array<[number, number]>>();
  for (const f of nwb) {
    const p = f.properties || {};
    const coords = lineCoords(f.geometry);
    if (coords.length < 2 || p.vwj_id_beg == null || p.vwj_id_end == null) continue;
    const cum = [0];
    for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + dist(coords[i - 1], coords[i]));
    const edge: Edge = {
      id: Number(p.vwk_id),
      a: String(p.vwj_id_beg),
      b: String(p.vwj_id_end),
      coords,
      cum,
      len: cum[cum.length - 1],
      name: String(p.vwg_naam || p.vrt_naam || ""),
      objects: [],
      blockedFor: Infinity,
    };
    const index = edges.push(edge) - 1;
    for (const node of [edge.a, edge.b]) {
      const list = adjacency.get(node) || [];
      list.push(index);
      adjacency.set(node, list);
    }
    for (let s = 0; s < coords.length - 1; s++) {
      const minX = Math.floor(Math.min(coords[s][0], coords[s + 1][0]) / CELL);
      const maxX = Math.floor(Math.max(coords[s][0], coords[s + 1][0]) / CELL);
      const minY = Math.floor(Math.min(coords[s][1], coords[s + 1][1]) / CELL);
      const maxY = Math.floor(Math.max(coords[s][1], coords[s + 1][1]) / CELL);
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const key = `${x}:${y}`;
          const cell = grid.get(key) || [];
          cell.push([index, s]);
          grid.set(key, cell);
        }
      }
    }
  }
  const net: Network = { edges, adjacency, grid, builtAt: Date.now(), stats: {} };

  // Doorvaarthoogtes per brug (hoogste opening telt) en of hij open kan.
  const openingsByBridge = new Map<number, { clearance: number | null; movable: boolean }>();
  for (const f of openingen) {
    const p = f.properties || {};
    if (p.parentgeotype !== "bridge" || !p.parentid) continue;
    const cur = openingsByBridge.get(p.parentid) || { clearance: null, movable: false };
    const c = typeof p.clearanceheightclosed === "number" ? p.clearanceheightclosed : null;
    if (c != null && (cur.clearance == null || c > cur.clearance)) cur.clearance = c;
    if (p.type && p.type !== "VST") cur.movable = true;
    openingsByBridge.set(p.parentid, cur);
  }

  let matchedBridges = 0, matchedLocks = 0;
  const attach = (kind: "bridge" | "lock", f: any, maxMeters: number) => {
    const p = f.properties || {};
    const c = centroid(f.geometry);
    if (!c) return false;
    const hit = nearestSegment(net, c, maxMeters);
    if (!hit) return false;
    const e = edges[hit.edge];
    const pos = e.cum[hit.seg] + (e.cum[hit.seg + 1] - e.cum[hit.seg]) * hit.t;
    const o = openingsByBridge.get(p.id);
    const canOpen = kind === "lock" ? true : p.canopen === "Yes" || Boolean(o?.movable);
    const clearance = kind === "bridge" ? (o?.clearance ?? null) : null;
    e.objects.push({ kind, id: Number(p.id), name: String(p.name || ""), city: String(p.city || ""), canOpen, clearance, pos, lat: c[1], lon: c[0] });
    if (kind === "bridge" && !canOpen && clearance != null) e.blockedFor = Math.min(e.blockedFor, clearance);
    return true;
  };
  for (const f of bruggen) if (attach("bridge", f, 35)) matchedBridges++;
  for (const f of sluizen) if (attach("lock", f, 80)) matchedLocks++;
  for (const e of edges) e.objects.sort((x, y) => x.pos - y.pos);

  net.stats = {
    edges: edges.length,
    nodes: adjacency.size,
    bridges: bruggen.length,
    bridgesOnNetwork: matchedBridges,
    locks: sluizen.length,
    locksOnNetwork: matchedLocks,
    buildMs: Date.now() - started,
  };
  log(`netwerk klaar: ${JSON.stringify(net.stats)}`);
  return net;
}

// Kleine binaire heap voor Dijkstra.
class Heap {
  private items: Array<[number, string]> = [];
  push(item: [number, string]) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): [number, string] | undefined {
    const a = this.items;
    if (!a.length) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() { return this.items.length; }
}

function slice(e: Edge, from: number, to: number): Coord[] {
  // Coördinaten van positie `from` naar `to` (meters) langs de edge; omgekeerd als from > to.
  const forward = from <= to;
  const lo = Math.min(from, to), hi = Math.max(from, to);
  const at = (pos: number): Coord => {
    let i = 0;
    while (i < e.cum.length - 2 && e.cum[i + 1] < pos) i++;
    const segLen = e.cum[i + 1] - e.cum[i] || 1;
    const t = Math.max(0, Math.min(1, (pos - e.cum[i]) / segLen));
    return [e.coords[i][0] + (e.coords[i + 1][0] - e.coords[i][0]) * t, e.coords[i][1] + (e.coords[i + 1][1] - e.coords[i][1]) * t];
  };
  const out: Coord[] = [at(lo)];
  for (let i = 0; i < e.coords.length; i++) if (e.cum[i] > lo && e.cum[i] < hi) out.push(e.coords[i]);
  out.push(at(hi));
  return forward ? out : out.reverse();
}

export type RouteResult =
  | { ok: false; reason: string }
  | {
      ok: true;
      distanceM: number;
      coords: Array<[number, number]>; // [lat, lon]
      objects: Array<RouteObject & { atM: number; mustOpen: boolean; passes: boolean }>;
      waterways: string[];
      snapFromM: number;
      snapToM: number;
    };

export function planRoute(net: Network, from: Coord, to: Coord, airDraft: number | null): RouteResult {
  const margin = 0.1;
  const s = nearestSegment(net, from, 15000);
  const t = nearestSegment(net, to, 15000);
  if (!s) return { ok: false, reason: "Je vertrekpunt ligt te ver van een bekende vaarweg." };
  if (!t) return { ok: false, reason: "Je bestemming ligt te ver van een bekende vaarweg." };
  const es = net.edges[s.edge], et = net.edges[t.edge];
  const sPos = es.cum[s.seg] + (es.cum[s.seg + 1] - es.cum[s.seg]) * s.t;
  const tPos = et.cum[t.seg] + (et.cum[t.seg + 1] - et.cum[t.seg]) * t.t;
  const passable = (e: Edge) => airDraft == null || e.blockedFor === Infinity || e.blockedFor >= airDraft + margin;

  // Objecten tussen twee posities op een edge die je niet kunt passeren?
  const blockedBetween = (e: Edge, a: number, b: number) => {
    if (airDraft == null) return false;
    const lo = Math.min(a, b), hi = Math.max(a, b);
    return e.objects.some((o) => o.kind === "bridge" && !o.canOpen && o.clearance != null && o.clearance < airDraft + margin && o.pos >= lo && o.pos <= hi);
  };

  // Zelfde vaarwegvak en vrij pad: direct.
  type Step = { edge: number; from: number; to: number };
  let steps: Step[] | null = null;
  if (s.edge === t.edge && !blockedBetween(es, sPos, tPos)) {
    steps = [{ edge: s.edge, from: sPos, to: tPos }];
  } else {
    const distMap = new Map<string, number>();
    const prev = new Map<string, { node: string; edge: number }>();
    const heap = new Heap();
    const START = "__start", END = "__end";
    distMap.set(START, 0);
    heap.push([0, START]);
    // Virtuele verbindingen vanaf start en naar eind.
    const startLinks: Array<{ node: string; cost: number }> = [];
    if (!blockedBetween(es, sPos, 0)) startLinks.push({ node: es.a, cost: sPos });
    if (!blockedBetween(es, sPos, es.len)) startLinks.push({ node: es.b, cost: es.len - sPos });
    const endLinks = new Map<string, number>();
    if (!blockedBetween(et, 0, tPos)) endLinks.set(et.a, tPos);
    if (!blockedBetween(et, tPos, et.len)) endLinks.set(et.b, Math.min(endLinks.get(et.b) ?? Infinity, et.len - tPos));

    while (heap.size) {
      const [d, node] = heap.pop()!;
      if (d > (distMap.get(node) ?? Infinity)) continue;
      if (node === END) break;
      const relax = (next: string, cost: number, edge: number) => {
        const nd = d + cost;
        if (nd < (distMap.get(next) ?? Infinity)) {
          distMap.set(next, nd);
          prev.set(next, { node, edge });
          heap.push([nd, next]);
        }
      };
      if (node === START) {
        for (const l of startLinks) relax(l.node, l.cost, s.edge);
        continue;
      }
      const end = endLinks.get(node);
      if (end != null) relax(END, end, t.edge);
      for (const ei of net.adjacency.get(node) || []) {
        const e = net.edges[ei];
        if (!passable(e)) continue;
        const other = e.a === node ? e.b : e.a;
        relax(other, e.len, ei);
      }
    }
    if (!prev.has(END)) {
      return {
        ok: false,
        reason:
          airDraft != null
            ? "Geen route gevonden die past bij de doorvaarthoogte van je boot. Een vaste brug onderweg is te laag."
            : "Geen route gevonden over het vaarwegennet.",
      };
    }
    // Pad terug opbouwen.
    const nodes: Array<{ node: string; edge: number }> = [];
    let cur = END;
    while (cur !== START) {
      const p = prev.get(cur)!;
      nodes.unshift({ node: cur, edge: p.edge });
      cur = p.node;
    }
    steps = [];
    let prevNode = START;
    for (const n of nodes) {
      const e = net.edges[n.edge];
      if (prevNode === START) {
        steps.push({ edge: n.edge, from: sPos, to: n.node === e.a ? 0 : e.len });
      } else if (n.node === END) {
        steps.push({ edge: n.edge, from: prevNode === e.a ? 0 : e.len, to: tPos });
      } else {
        steps.push({ edge: n.edge, from: prevNode === e.a ? 0 : e.len, to: n.node === e.a ? 0 : e.len });
      }
      prevNode = n.node;
    }
  }

  const coords: Array<[number, number]> = [];
  const objects: Array<RouteObject & { atM: number; mustOpen: boolean; passes: boolean }> = [];
  const waterways: string[] = [];
  let travelled = 0;
  for (const st of steps) {
    const e = net.edges[st.edge];
    const part = slice(e, st.from, st.to);
    for (const c of part) {
      const last = coords[coords.length - 1];
      if (!last || last[0] !== c[1] || last[1] !== c[0]) coords.push([c[1], c[0]]);
    }
    if (e.name && waterways[waterways.length - 1] !== e.name) waterways.push(e.name);
    const lo = Math.min(st.from, st.to), hi = Math.max(st.from, st.to);
    const onPart = e.objects.filter((o) => o.pos >= lo && o.pos <= hi);
    if (st.from > st.to) onPart.reverse();
    for (const o of onPart) {
      const fits = airDraft != null && o.clearance != null ? o.clearance >= airDraft + margin : null;
      objects.push({
        ...o,
        atM: travelled + Math.abs(o.pos - st.from),
        mustOpen: o.kind === "lock" ? true : fits === false && o.canOpen,
        passes: o.kind === "lock" ? true : fits !== false || o.canOpen,
      });
    }
    travelled += Math.abs(st.to - st.from);
  }
  // Dubbele objecten (op knooppunten) eruit.
  const seen = new Set<string>();
  const unique = objects.filter((o) => {
    const key = `${o.kind}:${o.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { ok: true, distanceM: travelled, coords, objects: unique, waterways, snapFromM: s.d, snapToM: t.d };
}

// Eén netwerk per serverproces, lui geladen en elke 24 uur ververst.
let network: Network | null = null;
let building: Promise<Network> | null = null;

export function networkStatus() {
  return { ready: Boolean(network), building: Boolean(building), stats: network?.stats || null };
}

export function ensureNetwork(): Promise<Network> | null {
  const stale = network && Date.now() - network.builtAt > 24 * 60 * 60 * 1000;
  if (network && !stale) return null;
  if (!building) {
    building = buildNetwork((m) => console.log(`[vaarroute] ${m}`))
      .then((n) => { network = n; return n; })
      .catch((error) => { console.error("[vaarroute] netwerk laden mislukt", error); throw error; })
      .finally(() => { building = null; });
  }
  return building;
}

export function currentNetwork() {
  return network;
}
