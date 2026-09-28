const seedLocations = [
  { id:'D-04', name:'Drain D-04 · Lake North', state:'Telangana', region:'South India', city:'Hyderabad', water:'Lake North', x:49, y:42, base:79, catchment:88, traffic:82, construction:73, waste:61, confidence:72, arrival:'2h 40m', action:'Inspect + temporary screen', status:'Pending', summary:'Large paved catchment and high traffic exposure connect this drain to Lake North before heavy rain.', source:'Fallback catchment record' },
  { id:'D-11', name:'Outfall D-11 · Bellandur edge', state:'Karnataka', region:'South India', city:'Bengaluru', water:'Bellandur Lake', x:47, y:57, base:76, catchment:84, traffic:77, construction:62, waste:73, confidence:68, arrival:'3h 10m', action:'Inspect + sample water', status:'Pending', summary:'High waste activity and a large paved catchment increase the priority of this outfall.', source:'Fallback catchment record' },
  { id:'D-02', name:'Drain D-02 · Yamuna Link', state:'Delhi', region:'North India', city:'Delhi', water:'Yamuna floodplain', x:54, y:23, base:72, catchment:69, traffic:91, construction:65, waste:58, confidence:81, arrival:'1h 55m', action:'Clean inlet', status:'Protected', summary:'Heavy traffic exposure and fast rainfall arrival make early inspection valuable.', source:'Field action record + fallback' },
  { id:'D-07', name:'Outfall D-07 · Mithi corridor', state:'Maharashtra', region:'West India', city:'Mumbai', water:'Mithi River', x:41, y:34, base:70, catchment:80, traffic:86, construction:52, waste:68, confidence:77, arrival:'2h 05m', action:'Inspect + clean', status:'Pending', summary:'Dense urban surfaces and traffic expose this corridor to a high first-flush load.', source:'Fallback catchment record' },
  { id:'D-15', name:'Drain D-15 · Adyar approach', state:'Tamil Nadu', region:'South India', city:'Chennai', water:'Adyar River', x:59, y:67, base:67, catchment:74, traffic:71, construction:60, waste:56, confidence:65, arrival:'3h 45m', action:'Monitor + inspect', status:'Pending', summary:'A mixed residential catchment drains toward a sensitive river approach.', source:'Fallback catchment record' },
  { id:'D-21', name:'Drain D-21 · East Canal', state:'West Bengal', region:'East & North-East India', city:'Kolkata', water:'East Kolkata Wetlands', x:66, y:41, base:64, catchment:72, traffic:63, construction:54, waste:79, confidence:61, arrival:'4h 20m', action:'Place debris screen', status:'Pending', summary:'Waste activity is the leading risk factor near this wetland-connected drain.', source:'Fallback catchment record' },
  { id:'D-31', name:'Drain D-31 · Jaipur market', state:'Rajasthan', region:'North India', city:'Jaipur', water:'Amanishah drain', x:39, y:28, base:57, catchment:60, traffic:70, construction:49, waste:66, confidence:56, arrival:'5h 05m', action:'Inspect inlet', status:'Pending', summary:'Market waste and paved surfaces create a moderate-to-high priority.', source:'Fallback catchment record' },
  { id:'D-42', name:'Drain D-42 · Guwahati lowland', state:'Assam', region:'East & North-East India', city:'Guwahati', water:'Bharalu River', x:70, y:26, base:52, catchment:63, traffic:45, construction:42, waste:58, confidence:49, arrival:'5h 40m', action:'Monitor', status:'Protected', summary:'Lower traffic exposure, but a lowland connection keeps this point under watch.', source:'Fallback catchment record' }
];

const ACTIONS = ['Inspect','Clean','Temporary screen / diversion','Sample water','Monitor'];
const state = JSON.parse(localStorage.getItem('firstflush-state') || 'null') || {
  scenario: { dry: 18, rain: 'heavy', region: 'All India', city: 'All cities' },
  actions: { 'D-02': 'Clean', 'D-42': 'Monitor' },
  observations: []
};
let locations = [...seedLocations];
let currentLocation = null;
const $ = id => document.getElementById(id);
const rainfall = { light: 8, moderate: 24, heavy: 62, extreme: 110 };
const riskLabel = score => score >= 80 ? 'very-high' : score >= 65 ? 'high' : score >= 45 ? 'medium' : 'low';
const titleCase = value => value.replaceAll('-', ' ').replace(/\b\w/g, c => c.toUpperCase());

function persist() { localStorage.setItem('firstflush-state', JSON.stringify(state)); }
function rainValue() { return rainfall[state.scenario.rain]; }
function score(location) {
  const dry = Math.min(100, state.scenario.dry / 18 * 100);
  const rain = Math.min(100, rainValue() / 62 * 100);
  const raw = .25 * dry + .20 * rain + .15 * location.catchment + .15 * location.traffic + .10 * location.construction + .10 * location.waste + .05 * (location.water ? 80 : 40);
  return Math.round(Math.min(99, raw * .82 + location.base * .18));
}
function regionMatches(location) { return state.scenario.region === 'All India' || location.region === state.scenario.region; }
function cityMatches(location) { return state.scenario.city === 'All cities' || location.city === state.scenario.city; }
function visibleLocations() { return locations.filter(regionMatches).filter(cityMatches); }
function computedLocations() { return visibleLocations().map(location => ({ ...location, score: score(location), level: riskLabel(score(location)) })).sort((a,b) => b.score - a.score); }

function ensureCityFilter() {
  const filters = document.querySelector('.queue-filters');
  if (!filters || $('cityFilter')) return;
  const select = document.createElement('select');
  select.id = 'cityFilter';
  select.setAttribute('aria-label', 'Filter by city');
  filters.insertBefore(select, filters.firstChild);
  select.onchange = e => { state.scenario.city = e.target.value; persist(); render(); };
}
function populateFilters() {
  ensureCityFilter();
  const states = [...new Set(locations.map(l => l.state))].sort();
  const cities = [...new Set(locations.map(l => l.city))].sort();
  $('stateFilter').innerHTML = '<option value="all">All states</option>' + states.map(s => `<option value="${s}">${s}</option>`).join('');
  $('cityFilter').innerHTML = '<option value="all">All cities</option>' + cities.map(c => `<option value="${c}">${c}</option>`).join('');
  $('cityFilter').value = state.scenario.city === 'All cities' ? 'all' : state.scenario.city;
}
function updateScenarioControls() {
  $('dryDays').value = state.scenario.dry;
  $('dryDaysOutput').textContent = `${state.scenario.dry} days`;
  $('rainSelect').value = state.scenario.rain;
  $('regionSelect').value = state.scenario.region;
}
function render() {
  updateScenarioControls();
  populateFilters();
  const list = computedLocations();
  const high = list.filter(l => l.score >= 65).length;
  $('metricDryDays').textContent = `${state.scenario.dry} days`;
  $('highRiskCount').textContent = high;
  $('locationsShown').textContent = list.length;
  const top = list[0];
  if (top) {
    $('topPriorityName').textContent = top.name.split(' · ')[0];
    $('topPriorityScore').textContent = top.score;
    $('topPrioritySeverity').textContent = titleCase(top.level).toUpperCase();
    $('topPrioritySeverity').className = `severity ${top.level}`;
    $('topPrioritySummary').textContent = top.summary;
    $('topReasons').innerHTML = [
      ['Dry spell', `${state.scenario.dry} days`],
      ['Rain forecast', `${rainValue()} mm · ${state.scenario.rain}`],
      ['Paved catchment', `${top.catchment}/100`],
      ['Traffic exposure', `${top.traffic}/100`]
    ].map(([name,value]) => `<div class="reason"><span>${name}</span><b>${value}</b></div>`).join('');
    $('openTopPriority').onclick = () => openDetail(top.id);
  }
  renderMap(list);
  renderQueue(list);
  updateCoverage();
}
function renderMap(list) {
  const map = $('map');
  map.querySelectorAll('.map-pin').forEach(pin => pin.remove());
  list.forEach(location => {
    const pin = document.createElement('button');
    pin.className = `map-pin ${location.level}`;
    pin.style.left = `${location.x}%`;
    pin.style.top = `${location.y}%`;
    pin.title = `${location.name}: ${location.score}/100`;
    pin.setAttribute('aria-label', `${location.name}, risk ${location.score} out of 100`);
    pin.innerHTML = '<span>•</span>';
    pin.onclick = () => openDetail(location.id);
    map.appendChild(pin);
  });
}
function renderQueue(list) {
  const stateFilter = $('stateFilter').value;
  const riskFilter = $('riskFilter').value;
  const view = list.filter(l => (stateFilter === 'all' || l.state === stateFilter) && (riskFilter === 'all' || l.level === riskFilter));
  $('queueList').innerHTML = view.map(location => `<div class="queue-item"><div><h3>${location.name}</h3><p>${location.city}, ${location.state} · ${location.water}</p></div><div class="queue-score"><span class="severity ${location.level}">${location.score}</span><small>relative risk</small></div><div class="queue-action">${location.action}<br><span class="${location.status === 'Protected' ? 'status-done' : ''}">${location.status}</span></div><button aria-label="Inspect ${location.name}" onclick="openDetail('${location.id}')">Inspect</button></div>`).join('') || '<p class="disclaimer">No locations match this filter.</p>';
}
function updateCoverage() {
  const total = locations.length;
  const done = locations.filter(l => l.status === 'Protected').length;
  const pct = total ? Math.round(done / total * 100) : 0;
  $('actionsCount').textContent = Object.keys(state.actions).length;
  $('coverageStat').textContent = `${pct}%`;
  $('coverageBar').style.width = `${pct}%`;
}
function openDetail(id) {
  const location = locations.find(item => item.id === id);
  if (!location) return;
  currentLocation = location;
  const value = score(location);
  $('dialogTitle').textContent = location.name;
  $('dialogBody').innerHTML = `<div class="detail-meta"><div><small>Relative risk</small><b>${value}/100 · ${titleCase(riskLabel(value))}</b></div><div><small>Rain arrival window</small><b>${location.arrival}</b></div><div><small>Connected water body</small><b>${location.water}</b></div><div><small>Data confidence</small><b>${location.confidence}% · ${location.source}</b></div></div><p class="warning-box">${location.summary} This is an estimate for prioritization, not a laboratory result.</p><h3>Factor breakdown</h3><div class="detail-factors">${[['Dry-period accumulation', Math.min(100, state.scenario.dry / 18 * 100)], ['Rainfall intensity', Math.min(100, rainValue() / 62 * 100)], ['Paved catchment', location.catchment], ['Traffic exposure', location.traffic], ['Construction proximity', location.construction], ['Waste / animal activity', location.waste]].map(([name,value]) => `<div class="factor-row"><span>${name}</span><div class="factor-bar"><span style="width:${value}%"></span></div><b>${Math.round(value)}</b></div>`).join('')}</div><div class="action-editor"><label>Recommended field action<select id="detailAction">${ACTIONS.map(action => `<option ${state.actions[location.id] === action || (!state.actions[location.id] && location.action.startsWith(action)) ? 'selected' : ''}>${action}</option>`).join('')}</select></label><label>Action note<textarea id="actionNote" rows="2" placeholder="What was observed or done?"></textarea></label><label class="upload-label">Photo evidence <input id="evidenceInput" type="file" accept="image/*" /><small id="fileName">Optional · stored locally for this browser session</small></label></div><p class="disclaimer">Source: ${location.source}. Observation freshness and completeness affect confidence. Nationwide coverage is incomplete.</p>`;
  $('dialogAction').textContent = location.status === 'Protected' ? 'Update action →' : 'Record action →';
  $('detailDialog').showModal();
}
function markAction() {
  if (!currentLocation) return;
  const action = $('detailAction')?.value || 'Inspect';
  state.actions[currentLocation.id] = action;
  currentLocation.status = 'Protected';
  currentLocation.action = action;
  persist();
  $('detailDialog').close();
  render();
  toast(`${currentLocation.id} updated: ${action}.`);
}
function exportCsv() {
  const list = computedLocations();
  const rows = [['FirstFlush India priority report'], ['Generated', new Date().toISOString()], ['Region', state.scenario.region], ['City', state.scenario.city], ['Dry spell', `${state.scenario.dry} days`], ['Rainfall', `${rainValue()} mm (${state.scenario.rain})`], [], ['ID','Location','State','City','Risk','Level','Recommended action','Status','Confidence','Source'], ...list.map(l => [l.id,l.name,l.state,l.city,l.score,l.level,l.action,l.status,`${l.confidence}%`,l.source])];
  const csv = rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'})); link.download = 'firstflush-priority-report.csv'; link.click();
  toast('CSV priority report downloaded.');
}
function printReport() {
  const list = computedLocations();
  const rows = list.map(l => `<tr><td>${l.id}</td><td>${l.name}</td><td>${l.state}</td><td>${l.score}/100</td><td>${titleCase(l.level)}</td><td>${l.action}</td><td>${l.status}</td></tr>`).join('');
  const report = window.open('', '_blank', 'width=1000,height=700');
  if (!report) { toast('Allow pop-ups to print the report.'); return; }
  report.document.write(`<!doctype html><title>FirstFlush India priority report</title><style>body{font:14px Arial;color:#102326;padding:36px}h1{font-size:26px}small{color:#647572}table{border-collapse:collapse;width:100%;margin-top:25px}th,td{border:1px solid #dce6e1;padding:9px;text-align:left}th{background:#e9f3ef}.note{margin-top:22px;background:#fff8e9;padding:12px}</style><h1>FirstFlush India · Priority report</h1><small>${new Date().toLocaleString('en-IN')} · ${state.scenario.region} · ${state.scenario.city}</small><p>Scenario: ${state.scenario.dry} dry days; ${rainValue()} mm ${state.scenario.rain} rainfall fallback context.</p><table><thead><tr><th>ID</th><th>Location</th><th>State</th><th>Risk</th><th>Level</th><th>Action</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table><p class="note">This report contains estimated relative prioritization scores, not laboratory water-quality results. Fallback records are not official municipal measurements.</p><script>window.onload=()=>window.print()<\/script>`);
  report.document.close();
}
function toast(message) { const element = $('toast'); element.textContent = message; element.classList.add('show'); window.clearTimeout(toast.timer); toast.timer = window.setTimeout(() => element.classList.remove('show'), 3200); }
function addObservation(event) {
  event.preventDefault();
  const data = new FormData(event.target);
  const name = String(data.get('name')).trim();
  const condition = String(data.get('condition'));
  const hash = [...name].reduce((total, char) => total + char.charCodeAt(0), 0);
  const newLocation = { id:`OBS-${locations.length + 1}`, name, state:String(data.get('state')), region:'South India', city:'Field observation', water:'To be verified', x:25 + hash % 50, y:20 + hash % 55, base:58, catchment:55, traffic:50, construction:45, waste:condition.includes('Blocked') ? 80 : 40, confidence:25, arrival:'Pending forecast', action:'Verify observation', status:'Pending', summary:String(data.get('notes') || 'Community observation awaiting verification.'), source:'Community field observation · pending verification' };
  locations.push(newLocation); state.observations.push({ id:newLocation.id, createdAt:new Date().toISOString(), condition }); persist(); populateFilters(); event.target.reset(); $('observationDialog').close(); render(); toast('Observation saved as pending verification.');
}
function bindEvents() {
  $('dryDays').oninput = event => { state.scenario.dry = Number(event.target.value); persist(); render(); };
  $('rainSelect').onchange = event => { state.scenario.rain = event.target.value; persist(); render(); };
  $('regionSelect').onchange = event => { state.scenario.region = event.target.value; state.scenario.city = 'All cities'; persist(); render(); };
  $('stateFilter').onchange = () => renderQueue(computedLocations());
  $('riskFilter').onchange = () => renderQueue(computedLocations());
  $('resetButton').onclick = () => { state.scenario = {dry:18,rain:'heavy',region:'All India',city:'All cities'}; persist(); render(); toast('Assessment context reset.'); };
  $('runScenario').onclick = () => { state.scenario = {dry:18,rain:'heavy',region:'All India',city:'All cities'}; persist(); render(); document.querySelector('#priorities').scrollIntoView({behavior:'smooth'}); toast('Risk assessment completed for the heavy-rain scenario.'); };
  $('howItWorks').onclick = () => $('methodDialog').showModal();
  $('helpButton').onclick = () => $('methodDialog').showModal();
  $('reportButton').onclick = exportCsv;
  $('observationButton').onclick = () => $('observationDialog').showModal();
  $('dialogAction').onclick = markAction;
  $('observationForm').onsubmit = addObservation;
  document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => $(button.dataset.close).close());
  document.querySelectorAll('.view-toggle button').forEach(button => button.onclick = () => { document.querySelectorAll('.view-toggle button').forEach(item => item.classList.remove('active')); button.classList.add('active'); document.body.classList.toggle('list-view', button.dataset.view === 'list'); });
  $('reportButton').insertAdjacentHTML('afterend', '<button class="text-button full" id="printReportButton">Print / save PDF <span>↗</span></button>');
  $('printReportButton').onclick = printReport;
}

bindEvents();
populateFilters();
render();
