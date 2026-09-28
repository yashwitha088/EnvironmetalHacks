import { riskLevel } from './shared/risk.js';

const ACTIONS = ['Inspect', 'Clean', 'Temporary screen / diversion', 'Sample water', 'Monitor'];
const STORAGE_KEY = 'firstflush-ui-state-v2';
const defaultUiState = {
  scenario: { dryDays: 18, rainfall: 62, region: 'All India' },
  filters: { state: 'all', city: 'all', risk: 'all' }
};

const uiState = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || defaultUiState;
const appState = {
  locations: [],
  topLocationId: null,
  currentDetail: null,
  health: null,
  weather: null,
  loading: false,
  map: null,
  markers: []
};

const $ = (id) => document.getElementById(id);

function persistUiState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(uiState));
}

function titleCase(value) {
  return String(value || '').replaceAll('-', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toast(message) {
  const element = $('toast');
  element.textContent = message;
  element.classList.add('show');
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => element.classList.remove('show'), 3200);
}

function setStatus(message, isError = false, retryAction = null) {
  const banner = $('statusBanner');
  banner.classList.toggle('error', isError);
  banner.textContent = message;
  if (retryAction) {
    const retryButton = document.createElement('button');
    retryButton.type = 'button';
    retryButton.textContent = 'Retry';
    retryButton.onclick = retryAction;
    banner.appendChild(retryButton);
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {})
    }
  });
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const message = body?.message || body?.error || `${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  return body;
}

function queryString(includeFilters = true) {
  const params = new URLSearchParams();
  params.set('dryDays', String(uiState.scenario.dryDays));
  params.set('rainfall', String(uiState.scenario.rainfall));
  params.set('region', uiState.scenario.region);
  if (includeFilters) {
    if (uiState.filters.state !== 'all') params.set('state', uiState.filters.state);
    if (uiState.filters.city !== 'all') params.set('city', uiState.filters.city);
    if (uiState.filters.risk !== 'all') params.set('risk', uiState.filters.risk);
  }
  return params.toString();
}

function updateTopPriority(list) {
  const top = list[0];
  if (!top) {
    $('topPriorityName').textContent = 'No matching locations';
    $('topPriorityScore').textContent = '--';
    $('topPrioritySummary').textContent = 'Change filters or scenario to view priorities.';
    $('topReasons').innerHTML = '';
    return;
  }

  appState.topLocationId = top.id;
  $('topPriorityName').textContent = top.name;
  $('topPriorityScore').textContent = top.score;
  $('topPrioritySeverity').textContent = titleCase(top.level).toUpperCase();
  $('topPrioritySeverity').className = `severity ${top.level}`;
  $('topPrioritySummary').textContent = `${top.provenance.sourceLabel}. ${top.provenance.note}`;
  $('topReasons').innerHTML = [
    ['Dry spell', `${uiState.scenario.dryDays} days`],
    ['Rain forecast', `${uiState.scenario.rainfall} mm`],
    ['Paved catchment', `${top.factors.catchment}/100`],
    ['Traffic exposure', `${top.factors.traffic}/100`]
  ].map(([name, value]) => `<div class="reason"><span>${escapeHtml(name)}</span><b>${escapeHtml(value)}</b></div>`).join('');
}

function renderQueue(list) {
  $('queueList').innerHTML = list.map((location) => {
    const severity = riskLevel(location.score);
    return `<div class="queue-item"><div><h3>${escapeHtml(location.name)}</h3><p>${escapeHtml(location.city)}, ${escapeHtml(location.state)} · ${escapeHtml(location.waterBody)}</p></div><div class="queue-score"><span class="severity ${severity}">${escapeHtml(location.score)}</span><small>${escapeHtml(location.confidence)}% confidence</small></div><div class="queue-action">${location.status === 'protected' ? 'Protected' : 'Pending'}<br><span>${escapeHtml(location.provenance.recordType)}</span></div><button aria-label="Inspect ${escapeHtml(location.name)}" onclick="window.openDetail('${escapeHtml(location.id)}')">Inspect</button></div>`;
  }).join('') || '<p class="disclaimer">No locations match this filter.</p>';
}

function refreshFilterOptions(items) {
  const states = [...new Set(items.map((item) => item.state))].sort();
  const cities = [...new Set(items.map((item) => item.city))].sort();

  $('stateFilter').innerHTML = '<option value="all">All states</option>' + states.map((stateName) => `<option value="${stateName}">${stateName}</option>`).join('');
  $('cityFilter').innerHTML = '<option value="all">All cities</option>' + cities.map((cityName) => `<option value="${cityName}">${cityName}</option>`).join('');

  $('stateFilter').value = states.includes(uiState.filters.state) ? uiState.filters.state : 'all';
  $('cityFilter').value = cities.includes(uiState.filters.city) ? uiState.filters.city : 'all';
}

function updateMetrics(list) {
  $('metricDryDays').textContent = `${uiState.scenario.dryDays} days`;
  $('highRiskCount').textContent = list.filter((item) => item.score >= 65).length;
  $('locationsShown').textContent = list.length;
  const done = list.filter((item) => item.status === 'protected').length;
  $('actionsCount').textContent = done;
  const pct = list.length ? Math.round((done / list.length) * 100) : 0;
  $('coverageStat').textContent = `${pct}%`;
  $('coverageBar').style.width = `${pct}%`;
  $('coverageCopy').textContent = `${new Set(list.map((item) => item.state)).size} states · ${list.length} records`;
}

function initMap() {
  if (appState.map || !window.L) return;
  const map = window.L.map('mapCanvas', { zoomControl: true }).setView([22.5, 79], 4);
  appState.map = map;

  let tileErrorCount = 0;
  const tileLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18
  });

  tileLayer.on('tileerror', () => {
    tileErrorCount += 1;
    if (tileErrorCount > 6) {
      $('mapFallback').classList.remove('hidden');
      setStatus('Map tiles are unavailable right now. Using list mode still shows live API data.', true);
    }
  });

  tileLayer.addTo(map);
}

function renderMap(items) {
  initMap();
  if (!appState.map) return;

  appState.markers.forEach((marker) => marker.remove());
  appState.markers = [];

  items.forEach((item) => {
    const marker = window.L.circleMarker([item.lat, item.lon], {
      radius: 8,
      weight: 2,
      color: '#fff',
      fillColor: item.level === 'very-high' ? '#cf4d46' : item.level === 'high' ? '#d96d3b' : item.level === 'medium' ? '#d99a39' : '#308b67',
      fillOpacity: 0.95
    });

    marker.bindTooltip(`${item.name}: ${item.score}/100`);
    marker.on('click', () => openDetail(item.id));
    marker.addTo(appState.map);
    appState.markers.push(marker);
  });
}

function renderWeather() {
  if (!appState.weather) return;
  $('rainCountdown').textContent = `${appState.weather.rainfallMm} mm`;
  $('weatherMeta').textContent = `${appState.weather.source} · ${appState.weather.mode === 'live' ? 'Live provider' : 'Fallback'} · ${new Date(appState.weather.lastUpdated).toLocaleString('en-IN')}`;
}

function renderHealth() {
  if (!appState.health) return;
  const liveText = appState.health.profile === 'Live provider' ? 'Live provider mode' : 'Local development mode';
  $('runtimeMode').innerHTML = `<i></i> ${liveText}`;
  $('sourceBadge').textContent = `${appState.health.modes.persistence} · ${appState.health.modes.weather}`;
}

async function loadWeatherForTop(top) {
  if (!top) return;
  try {
    appState.weather = await api(`/api/weather?lat=${top.lat}&lon=${top.lon}`);
    renderWeather();
  } catch (error) {
    setStatus(`Weather load failed: ${error.message}`, true, () => loadWeatherForTop(top));
  }
}

async function loadLocations() {
  appState.loading = true;
  setStatus('Loading API-backed priority data...');

  try {
    const payload = await api(`/api/locations?${queryString(true)}`);
    appState.locations = payload.items;
    refreshFilterOptions(payload.items);
    updateTopPriority(payload.items);
    updateMetrics(payload.items);
    renderQueue(payload.items);
    renderMap(payload.items);
    setStatus(`Loaded ${payload.items.length} locations · ${payload.sourceMode} · ${payload.fallbackRecords} fallback records labelled.`, false);
    await loadWeatherForTop(payload.items[0]);
  } catch (error) {
    setStatus(`Failed to load locations: ${error.message}`, true, () => loadLocations());
  } finally {
    appState.loading = false;
  }
}

async function loadHealth() {
  try {
    appState.health = await api('/api/health');
    renderHealth();
  } catch (error) {
    setStatus(`Health endpoint unavailable: ${error.message}`, true, () => loadHealth());
  }
}

function makeHistoryHtml(items) {
  if (!items.length) return '<p class="disclaimer">No history yet for this location.</p>';
  return `<div class="history-list">${items.map((item) => {
    if (item.type === 'action') {
      return `<div class="history-item"><b>Action · ${escapeHtml(item.actionType)}</b><small>${escapeHtml(new Date(item.createdAt).toLocaleString('en-IN'))} · ${escapeHtml(item.notes || 'No notes')}</small></div>`;
    }
    const evidence = item.evidence ? ` · Evidence: ${escapeHtml(item.evidence.originalName)} (${escapeHtml(item.evidence.provider)})` : '';
    return `<div class="history-item"><b>Observation · ${escapeHtml(item.condition)}</b><small>${escapeHtml(new Date(item.createdAt).toLocaleString('en-IN'))} · ${escapeHtml(item.verificationStatus)}${evidence}</small></div>`;
  }).join('')}</div>`;
}

async function openDetail(id) {
  try {
    const details = await api(`/api/locations/${id}?${queryString(false)}`);
    const history = await api(`/api/locations/${id}/history`);
    appState.currentDetail = details;

    $('dialogTitle').textContent = details.name;
    $('dialogBody').innerHTML = `<div class="detail-meta"><div><small>Relative risk</small><b>${escapeHtml(details.score)}/100 · ${escapeHtml(titleCase(details.level))}</b></div><div><small>Connected water body</small><b>${escapeHtml(details.waterBody)}</b></div><div><small>Confidence</small><b>${escapeHtml(details.confidence)}%</b></div><div><small>Provenance</small><b>${escapeHtml(details.provenance.sourceLabel)}</b></div></div><p class="warning-box">${escapeHtml(details.provenance.note)}</p><h3>Factor breakdown</h3><div class="detail-factors">${Object.entries(details.factors).map(([name, value]) => `<div class="factor-row"><span>${escapeHtml(titleCase(name))}</span><div class="factor-bar"><span style="width:${Math.min(100, Number(value))}%"></span></div><b>${escapeHtml(Math.round(Number(value)))}</b></div>`).join('')}</div><div class="action-editor"><label>Recommended field action<select id="detailAction">${ACTIONS.map((action) => `<option ${details.actions?.[0]?.actionType === action ? 'selected' : ''}>${escapeHtml(action)}</option>`).join('')}</select></label><label>Action note<textarea id="actionNote" rows="2" placeholder="What was observed or done?"></textarea></label></div><h3>Audit timeline</h3>${makeHistoryHtml(history.items)}`;
    $('dialogAction').textContent = 'Record action →';
    $('detailDialog').showModal();
  } catch (error) {
    setStatus(`Could not load location detail: ${error.message}`, true, () => openDetail(id));
  }
}

window.openDetail = openDetail;

async function recordAction() {
  if (!appState.currentDetail) return;

  const actionType = $('detailAction')?.value;
  const notes = $('actionNote')?.value || '';
  $('dialogAction').disabled = true;

  try {
    await api(`/api/locations/${appState.currentDetail.id}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionType, notes })
    });
    $('detailDialog').close();
    toast(`Action recorded for ${appState.currentDetail.id}`);
    await loadLocations();
  } catch (error) {
    setStatus(`Action save failed: ${error.message}`, true, recordAction);
  } finally {
    $('dialogAction').disabled = false;
  }
}

async function submitObservation(event) {
  event.preventDefault();
  const formData = new FormData(event.target);

  try {
    await api('/api/observations', {
      method: 'POST',
      body: formData
    });
    $('observationDialog').close();
    event.target.reset();
    toast('Observation saved and marked pending verification.');
    await loadLocations();
  } catch (error) {
    setStatus(`Observation save failed: ${error.message}`, true, () => submitObservation(event));
  }
}

function exportCsv() {
  window.open(`/api/reports/priority.csv?${queryString(true)}`, '_blank', 'noopener');
}

function printReport() {
  const rows = appState.locations.map((item) => `<tr><td>${escapeHtml(item.id)}</td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.state)}</td><td>${escapeHtml(item.city)}</td><td>${escapeHtml(item.score)}/100</td><td>${escapeHtml(titleCase(item.level))}</td><td>${escapeHtml(item.confidence)}%</td><td>${escapeHtml(item.status)}</td></tr>`).join('');
  const report = window.open('', '_blank', 'width=1000,height=700');
  if (!report) {
    toast('Allow pop-ups to print the report.');
    return;
  }
  report.document.write(`<!doctype html><title>FirstFlush India report</title><style>body{font:14px Arial;color:#102326;padding:36px}table{border-collapse:collapse;width:100%;margin-top:18px}th,td{border:1px solid #dce6e1;padding:8px;text-align:left}th{background:#eef6f3}.note{margin-top:16px;background:#fff8e9;padding:12px}</style><h1>FirstFlush India priority report</h1><p>Scenario: ${escapeHtml(uiState.scenario.dryDays)} dry days; ${escapeHtml(uiState.scenario.rainfall)} mm rainfall; ${escapeHtml(uiState.scenario.region)}</p><table><thead><tr><th>ID</th><th>Location</th><th>State</th><th>City</th><th>Risk</th><th>Level</th><th>Confidence</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table><p class="note">Estimated relative risk for prioritization. Not a laboratory water-quality measurement.</p><script>window.onload=()=>window.print()<\/script>`);
  report.document.close();
}

function resetScenario() {
  uiState.scenario = { ...defaultUiState.scenario };
  uiState.filters = { ...defaultUiState.filters };
  applyStateToControls();
  persistUiState();
  loadLocations();
}

function applyStateToControls() {
  $('dryDays').value = String(uiState.scenario.dryDays);
  $('dryDaysOutput').textContent = `${uiState.scenario.dryDays} days`;
  $('rainSelect').value = String(uiState.scenario.rainfall);
  $('regionSelect').value = uiState.scenario.region;
  $('riskFilter').value = uiState.filters.risk;
}

function bindEvents() {
  $('dryDays').oninput = (event) => {
    uiState.scenario.dryDays = Number(event.target.value);
    $('dryDaysOutput').textContent = `${uiState.scenario.dryDays} days`;
    persistUiState();
    loadLocations();
  };

  $('rainSelect').onchange = (event) => {
    uiState.scenario.rainfall = Number(event.target.value);
    persistUiState();
    loadLocations();
  };

  $('regionSelect').onchange = (event) => {
    uiState.scenario.region = event.target.value;
    uiState.filters.state = 'all';
    uiState.filters.city = 'all';
    persistUiState();
    loadLocations();
  };

  $('stateFilter').onchange = (event) => {
    uiState.filters.state = event.target.value;
    persistUiState();
    loadLocations();
  };

  $('cityFilter').onchange = (event) => {
    uiState.filters.city = event.target.value;
    persistUiState();
    loadLocations();
  };

  $('riskFilter').onchange = (event) => {
    uiState.filters.risk = event.target.value;
    persistUiState();
    loadLocations();
  };

  $('runScenario').onclick = () => {
    toast('Risk assessment run with current scenario.');
    document.querySelector('#priorities').scrollIntoView({ behavior: 'smooth' });
    loadLocations();
  };

  $('resetButton').onclick = resetScenario;
  $('openTopPriority').onclick = () => appState.topLocationId && openDetail(appState.topLocationId);
  $('observationButton').onclick = () => $('observationDialog').showModal();
  $('dialogAction').onclick = recordAction;
  $('observationForm').onsubmit = submitObservation;
  $('reportButton').onclick = exportCsv;
  $('printReportButton').onclick = printReport;
  $('howItWorks').onclick = () => $('methodDialog').showModal();
  $('helpButton').onclick = () => $('methodDialog').showModal();

  document.querySelectorAll('[data-close]').forEach((button) => {
    button.onclick = () => $(button.dataset.close).close();
  });

  document.querySelectorAll('.view-toggle button').forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll('.view-toggle button').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      document.body.classList.toggle('list-view', button.dataset.view === 'list');
    };
  });
}

async function bootstrap() {
  applyStateToControls();
  bindEvents();
  await loadHealth();
  await loadLocations();
}

bootstrap();
