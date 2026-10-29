(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const state = { city: null, map: null, tileLayer: null, diagram: false, mode: "time", routeLayers: [], roadLayers: new Map(), nodeLayers: new Map(), activeRoad: null, latestResults: null, routePath: [] };
  const colors = { free: "#62dfb1", light: "#8fdcae", moderate: "#ffc979", heavy: "#ff8b92", jam: "#ff5d79", blocked: "#6e7890", custom: "#9caad0" };

  function fmt(value, digits = 1) { return Number(value || 0).toFixed(digits); }
  function humanLevel(road) { return road.blocked ? "blocked" : (road.level || "custom"); }
  function toast(message) {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
  }
  async function api(url, body) {
    const options = body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    const response = await fetch(url, options);
    let data = {}; try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }
  function setMessage(msg, isError = false) { $("formMessage").textContent = msg || ""; $("formMessage").style.color = isError ? "var(--red)" : "var(--amber)"; }
  function clearRouteLayers() {
    state.routeLayers.forEach(layer => state.map.removeLayer(layer));
    state.routeLayers = []; state.routePath = [];
  }
  function addRouteLayer(layer) { layer.addTo(state.map); state.routeLayers.push(layer); }
  function nodeByName(name) { return state.city.nodes.find(n => n.name === name); }
  function roadKey(a, b) { return [a, b].sort().join("|||"); }
  function roadStyle(road, isRoute = false) {
    if (isRoute) return { color: "#8295ff", weight: 6, opacity: .98 };
    return { color: road.blocked ? colors.blocked : (colors[humanLevel(road)] || colors.custom), weight: road.blocked ? 3 : 3.5, opacity: road.blocked ? .7 : .82, dashArray: road.blocked ? "5 7" : null };
  }
  function drawRoad(road) {
    const a = nodeByName(road.a), b = nodeByName(road.b);
    if (!a || !b || !a.lat || !b.lat) return;
    const key = roadKey(road.a, road.b);
    if (state.roadLayers.has(key)) state.map.removeLayer(state.roadLayers.get(key));
    const layer = L.polyline([[a.lat, a.lon], [b.lat, b.lon]], roadStyle(road)).addTo(state.map);
    layer.on("click", () => openRoadDialog(road));
    layer.bindTooltip(`${road.a} ↔ ${road.b}<br>${fmt(road.length_km, 1)} km · ${road.blocked ? "Road closed" : humanLevel(road) + " traffic"}`, { sticky: true });
    state.roadLayers.set(key, layer);
  }
  function drawNode(node) {
    if (!node.lat || !node.lon) return;
    const marker = L.marker([node.lat, node.lon], { icon: L.divIcon({ className: "", html: '<div class="node-pin"></div>', iconSize: [11,11], iconAnchor: [5,5] }), keyboard: true }).addTo(state.map);
    marker.bindTooltip(node.name, { direction: "top", offset: [0,-5] });
    marker.on("click", () => {
      if (!$("start").value || $("start").value === $("goal").value) $("start").value = node.name;
      else $("goal").value = node.name;
      toast(`${node.name} selected. Press “Find best route” to calculate.`);
    });
    state.nodeLayers.set(node.name, marker);
  }
  function drawDiagram() {
    state.roadLayers.forEach(layer => state.map.removeLayer(layer)); state.roadLayers.clear();
    state.nodeLayers.forEach(layer => state.map.removeLayer(layer)); state.nodeLayers.clear();
    if (!state.city) return;
    state.city.roads.forEach(drawRoad);
    state.city.nodes.forEach(drawNode);
  }
  function fillLocationSelects() {
    const names = state.city.nodes.map(n => n.name).sort((a,b) => a.localeCompare(b));
    ["start","goal"].forEach(id => {
      const select = $(id); select.innerHTML = "";
      names.forEach(name => { const option = document.createElement("option"); option.value = name; option.textContent = name; select.appendChild(option); });
    });
    const trip = state.city.default_trip || [names[0], names[1]];
    $("start").value = trip[0]; $("goal").value = trip[1];
    $("locationCount").textContent = state.city.nodes.length;
    $("roadCount").textContent = state.city.roads.length;
  }
  function initMap(city) {
    const valid = city.nodes.filter(n => n.lat && n.lon);
    const center = valid.length ? [valid.reduce((s,n)=>s+n.lat,0)/valid.length, valid.reduce((s,n)=>s+n.lon,0)/valid.length] : [22.56,88.36];
    state.map = L.map("map", { zoomControl: true, preferCanvas: true }).setView(center, 11);
    state.tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(state.map);
    drawDiagram();
    if (valid.length) state.map.fitBounds(L.latLngBounds(valid.map(n => [n.lat,n.lon])).pad(.1));
    $("mapStatus").textContent = "City network loaded";
  }
  function setMapView(diagram) {
    state.diagram = diagram;
    $("streetView").classList.toggle("active", !diagram); $("diagramView").classList.toggle("active", diagram);
    if (diagram) { if (state.tileLayer) state.map.removeLayer(state.tileLayer); }
    else if (state.tileLayer && !state.map.hasLayer(state.tileLayer)) state.tileLayer.addTo(state.map);
    $("mapStatus").textContent = diagram ? "Network diagram view" : "Street map view";
  }
  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll("[data-mode]").forEach(btn => btn.classList.toggle("selected", btn.dataset.mode === mode));
  }
  function routePin(node, kind) {
    const icon = L.divIcon({ className: "", html: `<div class="route-pin ${kind}"></div>`, iconSize: [14,14], iconAnchor: [7,14] });
    addRouteLayer(L.marker([node.lat,node.lon], {icon, zIndexOffset: 1000}).bindTooltip(`${kind === "start" ? "START" : "DESTINATION"} · ${node.name}`));
  }
  function renderRoute(results, mode, algorithm) {
    clearRouteLayers(); state.latestResults = results;
    const primaryName = algorithm === "compare" ? (results.astar?.found ? "astar" : "dijkstra") : algorithm;
    const result = results[primaryName] || Object.values(results)[0];
    if (!result || !result.found) {
      setMessage("No route found. A road closure may disconnect the destination.", true);
      $("resultCaption").textContent = "No route available"; $("itinerary").className = "itinerary empty-state"; $("itinerary").textContent = "No available route. Try resetting traffic or reopening a road.";
      renderComparison(results, mode); return;
    }
    state.routePath = result.path;
    const points = result.path.map(nodeByName).filter(n => n && n.lat && n.lon);
    if (points.length > 1) {
      addRouteLayer(L.polyline(points.map(n => [n.lat,n.lon]), {color:"#091020",weight:11,opacity:.65,lineCap:"round",lineJoin:"round"}));
      addRouteLayer(L.polyline(points.map(n => [n.lat,n.lon]), {color:"#7d91ff",weight:5,opacity:1,lineCap:"round",lineJoin:"round"}));
      routePin(points[0],"start"); routePin(points[points.length-1],"end");
      state.map.fitBounds(L.latLngBounds(points.map(n => [n.lat,n.lon])).pad(.25));
    }
    $("resultCaption").textContent = `${result.path[0]} → ${result.path[result.path.length-1]}`;
    const totalKm = result.total_km ?? 0, totalMin = result.total_min ?? 0;
    const cards = $("summaryCards").querySelectorAll(".summary-card");
    cards[0].querySelector(".summary-value").innerHTML = `${fmt(totalKm)} <small>km</small>`;
    cards[1].querySelector(".summary-value").innerHTML = `${fmt(totalMin,0)} <small>min</small>`;
    cards[2].querySelector(".summary-value").innerHTML = `${result.path.length} <small>landmarks</small>`;
    cards[3].querySelector(".summary-value").textContent = result.explored;
    const legs = result.legs || [];
    if (!legs.length) {
      $("itinerary").className = "itinerary";
      $("itinerary").innerHTML = `<div class="leg-row"><span class="leg-index">✓</span><div class="leg-main"><strong>${escapeHtml(result.path[0])}</strong><small>Start and destination are the same</small></div><div class="leg-stats">0 km</div></div>`;
    } else {
      $("itinerary").className = "itinerary";
      $("itinerary").innerHTML = legs.map((leg,i) => `<div class="leg-row"><span class="leg-index">${String(i+1).padStart(2,"0")}</span><div class="leg-main"><strong>${escapeHtml(leg.from)} <span style="color:#7384a0">→</span> ${escapeHtml(leg.to)}</strong><small>${escapeHtml(leg.level || "normal")} traffic · <span class="traffic-tag">${leg.level === "heavy" || leg.level === "jam" ? "slow section" : "road segment"}</span></small></div><div class="leg-stats">${fmt(leg.km)} km<small>${fmt(leg.min,0)} min</small></div></div>`).join("");
    }
    renderComparison(results, mode);
    setMessage("Route calculated successfully.");
  }
  function renderComparison(results, mode) {
    const entries = Object.entries(results || {}).filter(([,r]) => r);
    if (!entries.length) return;
    const costs = entries.map(([,r]) => Number(r.cost || 0));
    const maxCost = Math.max(...costs, 1);
    $("comparison").className = "comparison";
    $("comparison").innerHTML = entries.map(([name,r]) => {
      const label = name === "astar" ? "A* search" : "Dijkstra";
      const cost = r.found ? (mode === "time" ? `${fmt(r.cost,1)} min` : `${fmt(r.cost,2)} km`) : "No route";
      return `<div class="compare-row"><div class="compare-top"><span class="compare-name">${label}</span><span class="compare-cost">${cost}</span></div><div class="compare-sub"><span>${r.explored ?? 0} nodes explored</span><span>${r.path?.length || 0} landmarks</span><span>${r.found ? "Route found" : "Unreachable"}</span></div><div class="bar-track"><div class="bar-fill" style="width:${r.found ? Math.max(4,Number(r.cost || 0)/maxCost*100) : 0}%"></div></div></div>`;
    }).join("");
  }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  async function findRoute() {
    if ($("start").value === $("goal").value) {
      // Same-location trips are supported by the backend; this message is just informational.
      setMessage("Calculating route…");
    } else setMessage("Calculating route…");
    const btn = $("routeForm").querySelector(".primary-button"); btn.disabled = true;
    try {
      const algorithm = $("algorithm").value;
      const data = await api("/api/route", {start:$("start").value, goal:$("goal").value, mode:state.mode, algorithm});
      renderRoute(data.results, data.mode, algorithm);
      $("mapStatus").textContent = "Route updated";
    } catch (err) { setMessage(err.message, true); toast(err.message); }
    finally { btn.disabled = false; }
  }
  function openRoadDialog(road) {
    state.activeRoad = road;
    $("roadTitle").textContent = `${road.a} ↔ ${road.b}`;
    $("roadMeta").textContent = `${fmt(road.length_km)} km · speed limit ${road.speed_limit} km/h · ${road.blocked ? "currently closed" : humanLevel(road) + " traffic"}`;
    $("trafficLevel").value = road.level && road.level !== "blocked" ? road.level : "free";
    $("toggleBlock").textContent = road.blocked ? "Reopen this road" : "Close this road";
    $("roadDialog").showModal();
  }
  async function applyTraffic() {
    if (!state.activeRoad) return;
    try {
      const r = state.activeRoad;
      await api("/api/traffic", {a:r.a,b:r.b,level:$("trafficLevel").value});
      await refreshCity(); $("roadDialog").close(); toast("Traffic level updated."); await findRoute();
    } catch (err) { toast(err.message); }
  }
  async function toggleBlock() {
    if (!state.activeRoad) return;
    try {
      const r = state.activeRoad;
      await api("/api/block", {a:r.a,b:r.b,blocked:!r.blocked});
      await refreshCity(); $("roadDialog").close(); toast(r.blocked ? "Road reopened." : "Road closed."); await findRoute();
    } catch (err) { toast(err.message); }
  }
  async function refreshCity() {
    const city = await api("/api/city");
    state.city = city; drawDiagram();
  }
  async function randomTraffic() {
    try { await api("/api/randomize", {}); await refreshCity(); toast("Rush-hour traffic simulated."); await findRoute(); }
    catch (err) { toast(err.message); }
  }
  async function resetTraffic() {
    try { await api("/api/reset", {}); await refreshCity(); toast("All roads reset to free flow."); await findRoute(); }
    catch (err) { toast(err.message); }
  }
  function wireEvents() {
    $("routeForm").addEventListener("submit", e => { e.preventDefault(); findRoute(); });
    document.querySelectorAll("[data-mode]").forEach(btn => btn.addEventListener("click", () => setMode(btn.dataset.mode)));
    $("swapPlaces").addEventListener("click", () => { const a=$("start").value; $("start").value=$("goal").value; $("goal").value=a; });
    $("streetView").addEventListener("click", () => setMapView(false));
    $("diagramView").addEventListener("click", () => setMapView(true));
    $("randomTraffic").addEventListener("click", randomTraffic);
    $("resetTraffic").addEventListener("click", resetTraffic);
    $("applyTraffic").addEventListener("click", applyTraffic);
    $("toggleBlock").addEventListener("click", toggleBlock);
  }
  async function boot() {
    wireEvents();
    try {
      state.city = await api("/api/city");
      fillLocationSelects(); initMap(state.city);
      setMode("time");
      await findRoute();
    } catch (err) {
      $("mapStatus").textContent = "Could not load city network";
      setMessage(`Could not initialise the planner: ${err.message}`, true);
      $("itinerary").textContent = `The backend could not be reached: ${err.message}`;
    }
  }
  document.addEventListener("DOMContentLoaded", boot);
})();