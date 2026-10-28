/* app.js - browser side of the City Route Planner.
   Draws the map as SVG, talks to the Flask API in app.py. */
(() => {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";
  const SCALE = 58;           // pixels per map km
  const PADX = 100, PADY = 60;
  const LEVEL_LABEL = { free: "Free", light: "Light", moderate: "Moderate", heavy: "Heavy", jam: "Jam" };
  const ALGO_LABEL = { dijkstra: "Dijkstra", astar: "A*" };

  const state = {
    nodes: {}, roads: [], levels: [],
    start: null, goal: null,
    mode: "time", algo: "compare",
    results: null, resultMode: "time", shown: "astar",
    selectedKey: null,
    bounds: null,
  };

  const $ = (sel) => document.querySelector(sel);
  const svg = $("#map");
  const layers = {};

  /* ---------- small helpers ---------- */
  function el(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  }

  function h(tag, className, text, parent) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }

  async function api(path, body) {
    const opts = body === undefined ? undefined : {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };
    const res = await fetch(path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
    return data;
  }

  let toastTimer;
  function toast(message) {
    const t = $("#toast");
    t.textContent = message;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3600);
  }

  const roadKey = (r) => `${r.a}|${r.b}`;
  const fmt = (n) => n.toFixed(1);

  function pt(name) {
    const n = state.nodes[name];
    const { minX, maxY } = state.bounds;
    return { x: PADX + (n.x - minX) * SCALE, y: PADY + (maxY - n.y) * SCALE };
  }

  /* ---------- map drawing ---------- */
  function setupMap() {
    const xs = Object.values(state.nodes).map((n) => n.x);
    const ys = Object.values(state.nodes).map((n) => n.y);
    state.bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
    const w = (state.bounds.maxX - state.bounds.minX) * SCALE + PADX * 2;
    const hgt = (state.bounds.maxY - state.bounds.minY) * SCALE + PADY * 2;
    svg.setAttribute("viewBox", `0 0 ${w} ${hgt}`);
    svg.replaceChildren();
    layers.roads = el("g", {}, svg);
    layers.overlay = el("g", {}, svg);
    layers.nodes = el("g", {}, svg);
  }

  function renderRoads() {
    layers.roads.replaceChildren();
    for (const r of state.roads) {
      const p = pt(r.a), q = pt(r.b);
      const level = r.blocked ? "blocked" : r.level;
      const status = r.blocked ? "closed" : `${(LEVEL_LABEL[r.level] || "Custom").toLowerCase()} traffic`;
      const g = el("g", {
        class: "road" + (roadKey(r) === state.selectedKey ? " selected" : ""),
        "data-level": level,
        tabindex: 0,
        role: "button",
        "aria-label": `Road from ${r.a} to ${r.b}, ${status}`,
      }, layers.roads);
      el("title", {}, g).textContent = `${r.a} to ${r.b}: ${r.length_km} km, limit ${r.speed_limit} km/h, ${status}`;
      const coords = { x1: p.x, y1: p.y, x2: q.x, y2: q.y };
      el("line", { class: "road-casing", ...coords }, g);
      el("line", { class: "road-line", ...coords }, g);
      el("line", { class: "road-hit", ...coords }, g);
      if (r.blocked) {
        const m = el("g", { class: "closed-mark" }, g);
        const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
        el("circle", { cx: mx, cy: my, r: 10 }, m);
        el("text", { x: mx, y: my + 5.5 }, m).textContent = "×";
      }
      g.addEventListener("click", () => selectRoad(r));
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectRoad(r); }
      });
    }
  }

  function renderOverlay(animate) {
    layers.overlay.replaceChildren();
    const res = state.results && state.results[state.shown];
    if (!res) return;

    res.visited.forEach((name, i) => {
      const p = pt(name);
      const c = el("circle", { class: "search-ring" + (animate ? " anim" : ""), cx: p.x, cy: p.y, r: 19 }, layers.overlay);
      if (animate) c.style.animationDelay = `${i * 60}ms`;
    });

    if (res.found && res.path.length > 1) {
      const points = res.path.map((n) => { const p = pt(n); return `${p.x},${p.y}`; }).join(" ");
      el("polyline", { class: "route-casing", points }, layers.overlay);
      const line = el("polyline", { class: "route-line" + (animate ? " anim" : ""), points, pathLength: 1 }, layers.overlay);
      if (animate) line.style.animationDelay = `${Math.min(res.visited.length, 14) * 60 + 80}ms`;
    }
  }

  function renderNodes() {
    layers.nodes.replaceChildren();
    for (const name of Object.keys(state.nodes).sort()) {
      const p = pt(name);
      const isFrom = name === state.start, isTo = name === state.goal;
      const marker = isFrom || isTo;
      const role = isFrom ? ", start" : isTo ? ", destination" : "";
      const g = el("g", {
        class: "node" + (isFrom ? " is-from" : "") + (isTo ? " is-to" : ""),
        tabindex: 0,
        role: "button",
        "aria-label": `${name}${role}`,
      }, layers.nodes);
      el("circle", { class: "node-hit", cx: p.x, cy: p.y, r: 22 }, g);
      el("circle", { class: "node-dot", cx: p.x, cy: p.y, r: marker ? 13 : 8 }, g);
      if (marker) el("text", { class: "node-letter", x: p.x, y: p.y + 4.5 }, g).textContent = isFrom ? "A" : "B";
      el("text", { class: "node-label", x: p.x, y: p.y + (marker ? 31 : 26) }, g).textContent = name;
      g.addEventListener("click", () => clickNode(name));
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); clickNode(name); }
      });
    }
  }

  /* ---------- side sheet ---------- */
  function updateStats() {
    const congested = state.roads.filter((r) => !r.blocked && ["moderate", "heavy", "jam"].includes(r.level)).length;
    const closed = state.roads.filter((r) => r.blocked).length;
    $("#stats").textContent =
      `${Object.keys(state.nodes).length} locations, ${state.roads.length} roads, ${congested} congested, ${closed} closed`;
  }

  function updateHint() {
    const hint = $("#hint");
    if (!state.start) hint.textContent = "Click a location to set your start, then another for your destination.";
    else if (!state.goal) hint.textContent = "Now click your destination.";
    else hint.textContent = "Press Find route, or click a road to change its traffic.";
  }

  function updateSelects() {
    $("#from").value = state.start || "";
    $("#to").value = state.goal || "";
  }

  function renderResults() {
    const box = $("#results");
    box.replaceChildren();
    if (!state.results) {
      h("p", "empty", "Choose a start and a destination, then press Find route.", box);
      return;
    }

    const keys = Object.keys(state.results);
    const maxExplored = Math.max(...keys.map((k) => state.results[k].explored), 1);
    const total = Object.keys(state.nodes).length;
    const byTime = state.resultMode === "time";

    if (keys.length === 2) {
      const d = state.results.dijkstra, a = state.results.astar;
      if (d.found && a.found) {
        const unit = byTime ? "minutes" : "km";
        const diff = d.explored - a.explored;
        const tail = diff > 0 ? `A* searched ${diff} fewer location${diff === 1 ? "" : "s"}.`
          : diff === 0 ? "Both searched the same number of locations."
          : `A* searched ${-diff} more location${diff === -1 ? "" : "s"}.`;
        h("p", "verdict", `Same best route cost (${fmt(d.cost)} ${unit}). ${tail}`, box);
      }
    }

    for (const key of keys) {
      const r = state.results[key];
      const active = key === state.shown;
      const art = h("article", "result", undefined, box);

      const head = h(keys.length > 1 ? "button" : "div", "result-head", undefined, art);
      h("h3", "", ALGO_LABEL[key], head);
      if (keys.length > 1) {
        head.type = "button";
        head.setAttribute("aria-pressed", String(active));
        if (active) h("span", "badge", "Shown on map", head);
        else h("span", "switch", "Show on map", head);
        head.addEventListener("click", () => {
          if (state.shown !== key) { state.shown = key; renderOverlay(true); renderResults(); }
        });
      }

      if (!r.found) {
        h("p", "fail", "No route found. Every road to this destination is closed. Reopen a road and try again.", art);
        continue;
      }

      const total_ = h("p", "total", undefined, art);
      h("strong", "", fmt(byTime ? r.total_min : r.total_km), total_);
      h("span", "unit", byTime ? "min" : "km", total_);
      h("span", "other", byTime ? `${fmt(r.total_km)} km` : `${fmt(r.total_min)} min`, total_);

      h("p", "searched", `Searched ${r.explored} of ${total} locations`, art);
      const meter = h("div", "meter", undefined, art);
      meter.setAttribute("aria-hidden", "true");
      const bar = h("i", "", undefined, meter);
      bar.style.width = `${(r.explored / maxExplored) * 100}%`;

      if (active) {
        const ol = h("ol", "stops", undefined, art);
        r.path.forEach((name, i) => {
          const cls = "stop" + (i === 0 ? " first" : "") + (i === r.path.length - 1 ? " last" : "");
          h("li", cls, name, ol);
          const leg = r.legs[i];
          if (leg) {
            const li = h("li", "leg", `${fmt(leg.min)} min, ${fmt(leg.km)} km`, ol);
            li.dataset.level = leg.level;
          }
        });
      }
    }
  }

  function renderRoadPanel() {
    const box = $("#road-panel");
    box.replaceChildren();
    const r = state.roads.find((x) => roadKey(x) === state.selectedKey);
    if (!r) {
      h("p", "empty", "Click any road on the map to change its traffic or close it.", box);
      return;
    }
    h("p", "road-title", `${r.a} to ${r.b}`, box);
    h("p", "road-facts", `${r.length_km} km, speed limit ${r.speed_limit} km/h${r.blocked ? ", currently closed" : ""}`, box);

    const group = h("div", "levels", undefined, box);
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", "Traffic level");
    for (const level of state.levels) {
      const b = h("button", "level", LEVEL_LABEL[level] || level, group);
      b.type = "button";
      b.dataset.level = level;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(!r.blocked && r.level === level));
      b.addEventListener("click", () => act(async () => {
        await api("/api/traffic", { a: r.a, b: r.b, level });
        toast(`Traffic on ${r.a} to ${r.b} set to ${LEVEL_LABEL[level].toLowerCase()}.`);
      }));
    }

    const closeBtn = h("button", "ghost close-btn" + (r.blocked ? " is-closed" : ""), r.blocked ? "Reopen this road" : "Close this road", box);
    closeBtn.type = "button";
    closeBtn.addEventListener("click", () => act(async () => {
      await api("/api/block", { a: r.a, b: r.b, blocked: !r.blocked });
      toast(r.blocked ? `${r.a} to ${r.b} reopened.` : `${r.a} to ${r.b} closed.`);
    }));
  }

  /* ---------- actions ---------- */
  function setEndpoints(start, goal) {
    state.start = start || null;
    state.goal = goal || null;
    state.results = null;
    renderOverlay(false);
    renderNodes();
    renderResults();
    updateSelects();
    updateHint();
  }

  function clickNode(name) {
    if (!state.start) setEndpoints(name, null);
    else if (!state.goal && name !== state.start) setEndpoints(state.start, name);
    else setEndpoints(name, null);
  }

  function selectRoad(r) {
    state.selectedKey = roadKey(r);
    renderRoads();
    renderRoadPanel();
  }

  async function reloadRoads() {
    const data = await api("/api/city");
    state.roads = data.roads;
    renderRoads();
    renderRoadPanel();
    updateStats();
  }

  /* run a change on the server, refresh the map, and re-plan if a route is showing */
  async function act(change) {
    try {
      await change();
      await reloadRoads();
      if (state.results) await runRoute();
    } catch (err) {
      toast(err.message);
    }
  }

  async function runRoute() {
    if (!state.start || !state.goal) { toast("Choose a start and a destination first."); return; }
    if (state.start === state.goal) { toast("Start and destination are the same place. Choose a different destination."); return; }
    try {
      const data = await api("/api/route", {
        start: state.start, goal: state.goal, mode: state.mode, algorithm: state.algo,
      });
      state.results = data.results;
      state.resultMode = data.mode;
      state.shown = state.algo === "compare" ? (state.shown === "dijkstra" ? "dijkstra" : "astar") : state.algo;
      renderOverlay(true);
      renderResults();
      if (Object.values(data.results).some((r) => !r.found)) toast("No route found. Reopen a closed road and try again.");
    } catch (err) {
      toast(err.message);
    }
  }

  function wireSegment(id, key) {
    const seg = $(id);
    seg.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      for (const b of seg.querySelectorAll("button")) b.setAttribute("aria-checked", String(b === btn));
      state[key] = btn.dataset.value;
      if (state.results) runRoute();
    });
  }

  /* ---------- start up ---------- */
  async function init() {
    try {
      const data = await api("/api/city");
      state.nodes = Object.fromEntries(data.nodes.map((n) => [n.name, n]));
      state.roads = data.roads;
      state.levels = data.levels;
    } catch (err) {
      $("#results").textContent = "Could not load the city. Is the server running?";
      return;
    }

    setupMap();
    const names = Object.keys(state.nodes).sort();
    for (const sel of [$("#from"), $("#to")]) {
      for (const n of names) h("option", "", n, sel).value = n;
    }
    $("#from").addEventListener("change", (e) => setEndpoints(e.target.value, state.goal));
    $("#to").addEventListener("change", (e) => setEndpoints(state.start, e.target.value));
    $("#swap").addEventListener("click", () => setEndpoints(state.goal, state.start));
    $("#go").addEventListener("click", runRoute);
    wireSegment("#mode-seg", "mode");
    wireSegment("#algo-seg", "algo");
    $("#rush").addEventListener("click", () => act(async () => {
      await api("/api/randomize", {});
      toast("Rush-hour traffic applied to every road.");
    }));
    $("#clear").addEventListener("click", () => act(async () => {
      await api("/api/reset", {});
      toast("All traffic cleared and roads reopened.");
    }));

    renderRoads();
    renderNodes();
    renderRoadPanel();
    renderResults();
    updateStats();

    setEndpoints("Airport", "Residential East");
    runRoute();
  }

  init();
})();
