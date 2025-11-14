/*
  Multi-city travel minimizer
  - Cities: Hyderabad, Mumbai, Chennai, Delhi, Bangalore
  - Cost = distance_km * traffic_rate (traffic_rate ~ 1..10, varies by city/edge)
  - Intercity edges connect city hubs (realistic approximate distances)
  - UI: choose source city & location, destination city & location
  - Visual: light map canvas, pins (green src, red dst, blue intermediate)
*/

/* NODE SET: grouped by city, with coordinates (arranged on canvas in clusters) */
const cityData = {
  Hyderabad: {
    baseTrafficRange:[2,7], // typical traffic intensity (lower min)
    nodes: [
      {id:'hyd_dilsukhnagar', label:'Dilsukhnagar', x:860, y:520},
      {id:'hyd_chaitanyapuri', label:'Chaitanyapuri', x:780, y:480},
      {id:'hyd_kothapet', label:'Kothapet', x:740, y:540},
      {id:'hyd_lbnagar', label:'L.B. Nagar', x:940, y:540},
      {id:'hyd_mehdipatnam', label:'Mehdipatnam', x:520, y:560},
      {id:'hyd_paradise', label:'Parade/Paradise', x:610, y:360},
      {id:'hyd_ameerpet', label:'Ameerpet', x:420, y:320},
      {id:'hyd_jubileehills', label:'Jubilee Hills', x:520, y:260},
      // choose 'paradise' as hub for intercity link
    ],
    edges: [
      ['hyd_dilsukhnagar','hyd_chaitanyapuri',2.5],
      ['hyd_chaitanyapuri','hyd_kothapet',3.2],
      ['hyd_kothapet','hyd_lbnagar',4.0],
      ['hyd_dilsukhnagar','hyd_lbnagar',6.0],
      ['hyd_mehdipatnam','hyd_ameerpet',6.8],
      ['hyd_ameerpet','hyd_jubileehills',4.2],
      ['hyd_jubileehills','hyd_paradise',3.0],
      ['hyd_paradise','hyd_ameerpet',4.5],
      ['hyd_paradise','hyd_kothapet',12.0]
    ],
    hub: 'hyd_paradise'
  },
  Mumbai: {
    baseTrafficRange:[5,10],
    nodes: [
      {id:'mum_andheri', label:'Andheri', x:180, y:160},
      {id:'mum_andheriEast', label:'Andheri East', x:230, y:220},
      {id:'mum_mumbaiCentral', label:'Mumbai Central', x:260, y:120},
      {id:'mum_bandra', label:'Bandra', x:220, y:100},
      {id:'mum_vashi', label:'Vashi', x:340, y:300},
    ],
    edges: [
      ['mum_bandra','mum_andheri',6.0],
      ['mum_andheri','mum_andheriEast',4.0],
      ['mum_andheriEast','mum_vashi',22.0],
      ['mum_mumbaiCentral','mum_bandra',5.5],
      ['mum_mumbaiCentral','mum_andheri',7.0],
    ],
    hub: 'mum_mumbaiCentral'
  },
  Chennai: {
    baseTrafficRange:[3,8],
    nodes: [
      {id:'che_tnag', label:'T. Nagar', x:980, y:220},
      {id:'che_guindy', label:'Guindy', x:980, y:300},
      {id:'che_velachery', label:'Velachery', x:1040, y:340},
      {id:'che_marina', label:'Marina Beach', x:930, y:120},
    ],
    edges: [
      ['che_tnag','che_guindy',6.0],
      ['che_guindy','che_velachery',8.0],
      ['che_marina','che_tnag',5.0],
    ],
    hub: 'che_guindy'
  },
  Delhi: {
    baseTrafficRange:[6,10],
    nodes: [
      {id:'del_cp', label:'Connaught Place', x:620, y:80},
      {id:'del_karol', label:'Karol Bagh', x:560, y:120},
      {id:'del_dwarka', label:'Dwarka', x:500, y:240},
      {id:'del_rajouri', label:'Rajouri Garden', x:520, y:160},
    ],
    edges: [
      ['del_cp','del_karol',4.0],
      ['del_karol','del_rajouri',6.0],
      ['del_rajouri','del_dwarka',10.0],
    ],
    hub: 'del_cp'
  },
  Bangalore: {
    baseTrafficRange:[5,9],
    nodes: [
      {id:'blr_majestic', label:'Majestic', x:420, y:520},
      {id:'blr_mgroad', label:'MG Road', x:480, y:460},
      {id:'blr_indiranagar', label:'Indiranagar', x:520, y:520},
      {id:'blr_whitefield', label:'Whitefield', x:600, y:560},
    ],
    edges: [
      ['blr_majestic','blr_mgroad',4.5],
      ['blr_mgroad','blr_indiranagar',3.8],
      ['blr_indiranagar','blr_whitefield',12.0],
    ],
    hub: 'blr_majestic'
  }
};

/* Build unified nodes & edges lists */
let nodes = [];
let edges = []; // [from,to,dist,cityTag?]
for(const cityName in cityData){
  const city = cityData[cityName];
  city.nodes.forEach(n => { nodes.push(n); });
  city.edges.forEach(e => { edges.push([e[0], e[1], e[2]]); });
}

/* Intercity hub-to-hub approximate distances (km) - realistic approximations */
const intercityEdges = [
  // [fromHub, toHub, approx_km]
  ['hyd_paradise','mum_mumbaiCentral', 710],
  ['hyd_paradise','blr_majestic', 570],
  ['hyd_paradise','che_guindy', 630],
  ['hyd_paradise','del_cp', 1420],

  ['mum_mumbaiCentral','blr_majestic', 980],
  ['mum_mumbaiCentral','del_cp', 1400],
  ['mum_mumbaiCentral','che_guindy', 1330],

  ['blr_majestic','che_guindy', 350],
  ['blr_majestic','del_cp', 2150],

  ['che_guindy','del_cp', 2180]
];
intercityEdges.forEach(e => edges.push(e));

/* Build adjacency map for algorithm */
const adjacency = {};
nodes.forEach(n => adjacency[n.id] = []);
edges.forEach(e => {
  const [a,b,d] = e;
  if(!(a in adjacency)) adjacency[a] = [];
  if(!(b in adjacency)) adjacency[b] = [];
  adjacency[a].push({to:b, dist:d});
  adjacency[b].push({to:a, dist:d});
});

/* UI elements */
const svg = document.getElementById('viz');
const srcCitySel = document.getElementById('srcCity');
const dstCitySel = document.getElementById('dstCity');
const sourcesDiv = document.getElementById('sources');
const destDiv = document.getElementById('destinations');

/* Populate city selects */
const cityNames = Object.keys(cityData);
cityNames.forEach(c => {
  const o1 = document.createElement('option'); o1.value = c; o1.textContent = c;
  const o2 = document.createElement('option'); o2.value = c; o2.textContent = c;
  srcCitySel.appendChild(o1); dstCitySel.appendChild(o2);
});
srcCitySel.value = 'Hyderabad'; dstCitySel.value = 'Hyderabad';

/* Populate location checklists based on selected city */
function populateLocations() {
  // sources
  sourcesDiv.innerHTML = '';
  const sc = srcCitySel.value;
  cityData[sc].nodes.forEach(n => {
    const lbl = document.createElement('label'); lbl.className = 'loc';
    lbl.innerHTML = `<input type="checkbox" name="source" value="${n.id}"> <div style="min-width:8px"></div> <div style="flex:1">${n.label}</div>`;
    sourcesDiv.appendChild(lbl);
  });
  // destinations
  destDiv.innerHTML = '';
  const dc = dstCitySel.value;
  cityData[dc].nodes.forEach(n => {
    const lbl = document.createElement('label'); lbl.className = 'loc';
    lbl.innerHTML = `<input type="checkbox" name="dest" value="${n.id}"> <div style="min-width:8px"></div> <div style="flex:1">${n.label}</div>`;
    destDiv.appendChild(lbl);
  });

  // ensure single-select behavior
  singleSelect('source');
  singleSelect('dest');
}
srcCitySel.addEventListener('change', populateLocations);
dstCitySel.addEventListener('change', populateLocations);
populateLocations();

/* checkbox single-select helpers */
function singleSelect(name){
  const inputs = Array.from(document.querySelectorAll(`input[name="${name}"]`));
  inputs.forEach(inp => inp.addEventListener('change', () => {
    if(inp.checked) inputs.forEach(i => { if(i!==inp) i.checked = false; });
  }));
}

/* SVG utility: clear & add defs */
function clearSVG(){
  while(svg.firstChild) svg.removeChild(svg.firstChild);
  const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
  defs.innerHTML = `
    <pattern id="mapDots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
      <rect x="0" y="0" width="24" height="24" fill="#eef2f3"></rect>
      <circle cx="12" cy="12" r="0.5" fill="#f2f4f6"></circle>
    </pattern>
    <linearGradient id="pathGrad" x1="0" x2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient>
    <linearGradient id="pinBlue" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3aa0ff"/><stop offset="1" stop-color="#2b6bff"/></linearGradient>
    <filter id="pinDrop" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity="0.12"/></filter>
  `;
  svg.appendChild(defs);
}

/* Simulate traffic rate per edge using city-based ranges:
   For intra-city edges, use that city's baseTrafficRange.
   For intercity edges, use an average moderate range.
   We'll store trafficMap keyed by "a|b".
*/
function generateTrafficMap() {
  const map = {};
  // helper to find city for a node id
  const findCityOfNode = (nid) => {
    for(const cn of Object.keys(cityData)){
      if(cityData[cn].nodes.some(x=>x.id===nid)) return cn;
    }
    return null;
  };

  edges.forEach(e => {
    const [a,b] = e;
    const aCity = findCityOfNode(a);
    const bCity = findCityOfNode(b);
    let minR = 2, maxR = 7; // default
    if(aCity && aCity===bCity) {
      const r = cityData[aCity].baseTrafficRange;
      minR = r[0]; maxR = r[1];
    } else {
      // intercity: moderate variability but can be busy on highways
      minR = 2; maxR = 7;
      // if either endpoint is a heavy traffic city, increase max
      const heavy = ['Mumbai','Delhi','Bangalore'];
      if(heavy.includes(aCity) || heavy.includes(bCity)) maxR = Math.max(maxR, 9);
    }
    const val = Math.floor(Math.random() * (maxR - minR + 1)) + minR;
    map[`${a}|${b}`] = val;
  });
  return map;
}

/* draw base realistic map */
function drawBaseMap() {
  clearSVG();
  // light base
  const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
  rect.setAttribute('x',0); rect.setAttribute('y',0); rect.setAttribute('width',1200); rect.setAttribute('height',720);
  rect.setAttribute('fill','#eef2f3');
  svg.appendChild(rect);

  // pattern overlay
  const p = document.createElementNS('http://www.w3.org/2000/svg','rect');
  p.setAttribute('x',0); p.setAttribute('y',0); p.setAttribute('width',1200); p.setAttribute('height',720);
  p.setAttribute('fill','url(#mapDots)'); p.setAttribute('opacity',0.6);
  svg.appendChild(p);

  // Draw faint "roads" using edges to give map feel
  edges.forEach((edge, i) => {
    const [a,b] = edge;
    const na = nodes.find(n=>n.id===a);
    const nb = nodes.find(n=>n.id===b);
    if(!na || !nb) return;
    // wider pale road
    const road = document.createElementNS('http://www.w3.org/2000/svg','line');
    road.setAttribute('x1',na.x); road.setAttribute('y1',na.y); road.setAttribute('x2',nb.x); road.setAttribute('y2',nb.y);
    road.setAttribute('stroke','#ffffff'); road.setAttribute('stroke-width', (i%6===0?5:3));
    road.setAttribute('opacity', (i%5===0?0.22:0.12)); road.setAttribute('stroke-linecap','round');
    svg.appendChild(road);
    // center line
    const road2 = document.createElementNS('http://www.w3.org/2000/svg','line');
    road2.setAttribute('x1',na.x); road2.setAttribute('y1',na.y); road2.setAttribute('x2',nb.x); road2.setAttribute('y2',nb.y);
    road2.setAttribute('stroke','#d6d9db'); road2.setAttribute('stroke-width',1.2); road2.setAttribute('opacity',0.7); road2.setAttribute('stroke-linecap','round');
    svg.appendChild(road2);
  });

  // light grid
  for(let x=0;x<=1200;x+=120){
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',x); line.setAttribute('y1',0); line.setAttribute('x2',x); line.setAttribute('y2',720);
    line.setAttribute('stroke','#e9ecef'); line.setAttribute('stroke-width',0.3); line.setAttribute('opacity',0.06);
    svg.appendChild(line);
  }
}

/* draw edges (roads) and optionally highlight routeEdges array */
function drawEdges(routeEdges = [], trafficMap = {}) {
  edges.forEach(e => {
    const [a,b,d] = e;
    const na = nodes.find(n=>n.id===a), nb = nodes.find(n=>n.id===b);
    if(!na || !nb) return;
    const key = `${a}|${b}`, key2 = `${b}|${a}`;
    const isHighlighted = routeEdges.some(h => h===key || h===key2);
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',na.x); line.setAttribute('y1',na.y); line.setAttribute('x2',nb.x); line.setAttribute('y2',nb.y);
    line.setAttribute('class', isHighlighted ? 'edge-highlight' : 'edge-line');
    svg.appendChild(line);

    // edge label (distance & traffic)
    const midx = (na.x+nb.x)/2, midy = (na.y+nb.y)/2;
    const lbl = document.createElementNS('http://www.w3.org/2000/svg','text');
    lbl.setAttribute('x',midx); lbl.setAttribute('y',midy - 10);
    lbl.setAttribute('class','edge-label'); lbl.setAttribute('fill','#6a6f76'); lbl.setAttribute('font-size','11');
    const t = trafficMap[key] ?? trafficMap[key2] ?? Math.ceil(Math.random()*8);
    lbl.textContent = `${d.toFixed(1)} km • t:${t}`;
    svg.appendChild(lbl);
  });
}

/* draw an intermediate pin */
function drawPin(n) {
  const g = document.createElementNS('http://www.w3.org/2000/svg','g');
  g.setAttribute('transform',`translate(${n.x},${n.y})`);
  // shadow
  const shadow = document.createElementNS('http://www.w3.org/2000/svg','ellipse');
  shadow.setAttribute('cx',0); shadow.setAttribute('cy',22); shadow.setAttribute('rx',16); shadow.setAttribute('ry',6);
  shadow.setAttribute('class','pin-shadow'); shadow.setAttribute('opacity',0.12);
  g.appendChild(shadow);
  // pin
  const pin = document.createElementNS('http://www.w3.org/2000/svg','path');
  const d = `M0,-18 C9,-18 16,-10 16,-2 C16,14 0,24 0,24 C0,24 -16,14 -16,-2 C-16,-10 -9,-18 0,-18 Z`;
  pin.setAttribute('d', d); pin.setAttribute('fill','url(#pinBlue)'); pin.setAttribute('class','pin-core'); pin.setAttribute('filter','url(#pinDrop)');
  g.appendChild(pin);
  // gloss
  const gloss = document.createElementNS('http://www.w3.org/2000/svg','circle');
  gloss.setAttribute('cx',-2); gloss.setAttribute('cy',-14); gloss.setAttribute('r',4);
  gloss.setAttribute('fill','rgba(255,255,255,0.6)'); gloss.setAttribute('opacity',0.65); gloss.setAttribute('transform','rotate(-12)');
  g.appendChild(gloss);
  // label
  const label = document.createElementNS('http://www.w3.org/2000/svg','text');
  label.setAttribute('y',36); label.setAttribute('class','node-label'); label.setAttribute('fill','#0b2230');
  label.textContent = n.label; g.appendChild(label);
  svg.appendChild(g);
}

/* draw special source/destination pin with pulsing */
function drawPinSpecial(n, role) {
  const g = document.createElementNS('http://www.w3.org/2000/svg','g');
  g.setAttribute('transform',`translate(${n.x},${n.y})`);
  const shadow = document.createElementNS('http://www.w3.org/2000/svg','ellipse');
  shadow.setAttribute('cx',0); shadow.setAttribute('cy',22); shadow.setAttribute('rx',20); shadow.setAttribute('ry',7);
  shadow.setAttribute('fill','rgba(2,8,23,0.12)'); g.appendChild(shadow);
  const pulse = document.createElementNS('http://www.w3.org/2000/svg','circle');
  pulse.setAttribute('cx',0); pulse.setAttribute('cy',-2); pulse.setAttribute('r',0); pulse.setAttribute('opacity',0.18);
  if(role==='src'){ pulse.setAttribute('fill','#2ecc71'); pulse.setAttribute('style','animation: pulseGreen 1.8s infinite linear; transform-origin:center;'); }
  else { pulse.setAttribute('fill','#ff676d'); pulse.setAttribute('style','animation: pulseRed 2s infinite linear; transform-origin:center;'); }
  g.appendChild(pulse);
  const pinPath = document.createElementNS('http://www.w3.org/2000/svg','path');
  const d = `M0,-18 C9,-18 16,-10 16,-2 C16,14 0,24 0,24 C0,24 -16,14 -16,-2 C-16,-10 -9,-18 0,-18 Z`;
  pinPath.setAttribute('d', d); pinPath.setAttribute('filter','url(#pinDrop)');
  pinPath.setAttribute('stroke','rgba(255,255,255,0.14)');
  if(role==='src') pinPath.setAttribute('fill','#2ecc71'); else pinPath.setAttribute('fill','#ff676d');
  g.appendChild(pinPath);
  const gloss = document.createElementNS('http://www.w3.org/2000/svg','circle');
  gloss.setAttribute('cx',-2); gloss.setAttribute('cy',-14); gloss.setAttribute('r',4);
  gloss.setAttribute('fill','rgba(255,255,255,0.75)'); gloss.setAttribute('opacity',0.85); gloss.setAttribute('transform','rotate(-12)');
  g.appendChild(gloss);
  const label = document.createElementNS('http://www.w3.org/2000/svg','text');
  label.setAttribute('y',36); label.setAttribute('class','node-label'); label.setAttribute('fill','#0b2230');
  label.textContent = n.label; g.appendChild(label);
  svg.appendChild(g);
}

/* Dijkstra using cost = distance * trafficRate
   trafficMap should contain edge-specific rates keyed as "a|b"
*/
function dijkstraCost(src, dst, trafficMap) {
  const dist = {}; const prev = {}; const visited = new Set();
  Object.keys(adjacency).forEach(k => dist[k] = Infinity);
  dist[src] = 0;
  while(true) {
    let u = null; let best = Infinity;
    for(const k in dist) {
      if(!visited.has(k) && dist[k] < best) { best = dist[k]; u = k; }
    }
    if(u === null) break;
    if(u === dst) break;
    visited.add(u);
    adjacency[u].forEach(edge => {
      const v = edge.to; if(visited.has(v)) return;
      const d = edge.dist;
      const key = `${u}|${v}`; const key2 = `${v}|${u}`;
      const t = trafficMap[key] ?? trafficMap[key2] ?? Math.ceil(Math.random()*8);
      const cost = d * t; // distance * trafficRate
      if(dist[u] + cost < dist[v]) { dist[v] = dist[u] + cost; prev[v] = u; }
    });
  }
  if(!prev[dst] && src !== dst && dist[dst] === Infinity) return null;
  const path = []; let cur = dst;
  if(src === dst) path.push(src); else {
    while(cur) { path.push(cur); if(cur === src) break; cur = prev[cur]; }
    path.reverse();
  }
  return { cost: dist[dst], path, prev };
}

/* estimate time roughly: speed model based on traffic */
function estimateTimeAndTraffic(path, trafficMap) {
  if(!path || path.length <= 1) return {timeMin:0, avgTraffic:0, totalDist:0};
  let totMin = 0, totTraffic = 0, totDist = 0;
  for(let i=0;i<path.length-1;i++){
    const a = path[i], b = path[i+1];
    const edge = edges.find(e => (e[0]===a && e[1]===b) || (e[0]===b && e[1]===a));
    if(!edge) continue;
    const d = edge[2]; const key = `${a}|${b}`;
    const traffic = trafficMap[key] ?? trafficMap[`${b}|${a}`] ?? Math.ceil(Math.random()*8);
    totTraffic += traffic; totDist += d;
    const speed = Math.max(40 - traffic*3, 25); // km/h for intercity/intracity mix (simplified)
    const minutes = (d / speed) * 60;
    totMin += minutes;
  }
  return { timeMin: Math.round(totMin), avgTraffic: +(totTraffic / (path.length-1)).toFixed(1), totalDist: +totDist.toFixed(2) };
}

/* Generate trafficMap & compute shortest path when clicking Calculate */
document.getElementById('calcBtn').addEventListener('click', ()=>{
  const srcInput = document.querySelector('input[name="source"]:checked');
  const dstInput = document.querySelector('input[name="dest"]:checked');
  if(!srcInput || !dstInput) { alert('Please select one source and one destination location.'); return; }
  const src = srcInput.value, dst = dstInput.value;

  const trafficMap = generateTrafficMap(); // randomized but city-aware
  const result = dijkstraCost(src, dst, trafficMap);
  if(!result) { alert('No path found.'); return; }
  const { path, cost } = result;

  // derive edge keys for highlighting
  const pathEdges = [];
  for(let i=0;i<path.length-1;i++) pathEdges.push(`${path[i]}|${path[i+1]}`);

  // draw visualization
  drawBaseMap();
  drawEdges(pathEdges, trafficMap);

  // draw intermediate pins
  nodes.forEach(n=> { if(n.id === src || n.id === dst) return; drawPin(n); });

  // draw special src/dst
  const srcNode = nodes.find(n=>n.id===src); const dstNode = nodes.find(n=>n.id===dst);
  drawPinSpecial(srcNode,'src'); drawPinSpecial(dstNode,'dst');

  // update UI cards
  const et = estimateTimeAndTraffic(path, trafficMap);
  document.getElementById('routeText').textContent = `Route: ${ path.map(p => nodes.find(n=>n.id===p).label).join(' → ') }`;
  document.getElementById('routeNodes').textContent = `Stops: ${path.length} • ${path.join(' ➜ ')}`;
  document.getElementById('costText').textContent = `Total Cost: ${ (cost||0).toFixed(2) } (distance×traffic)`;
  document.getElementById('timeText').textContent = `Estimated Time: ${et.timeMin} min • Distance: ${et.totalDist} km`;
  document.getElementById('trafficText').textContent = `Avg Traffic (path): ${et.avgTraffic}/10`;
});

/* initial render */
function initialRender() {
  drawBaseMap();
  // draw light roads
  edges.forEach(e=>{
    const [a,b] = e; const na = nodes.find(n=>n.id===a); const nb = nodes.find(n=>n.id===b);
    if(!na || !nb) return;
    const l = document.createElementNS('http://www.w3.org/2000/svg','line');
    l.setAttribute('x1',na.x); l.setAttribute('y1',na.y); l.setAttribute('x2',nb.x); l.setAttribute('y2',nb.y);
    l.setAttribute('class','edge-line'); l.setAttribute('opacity','0.18'); svg.appendChild(l);
  });
  // draw all pins as blue by default
  nodes.forEach(n=> drawPin(n));
}
initialRender();
