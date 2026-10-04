const $ = (id) => document.getElementById(id);

const STORAGE_KEY = 'firstflush-ui-v2';
const POLL_MS = 20000;
const RAINFALL_MM = {light: 8, moderate: 24, heavy: 62, extreme: 110};

const ui = {
  items: [],
  current: null,
  loading: false,
  polling: null,
  map: null,
  markers: null,
  tileErrors: 0,
  mapMode: 'loading',
  mapFallbackMessage: '',
  scenario: {
    dryDays: 18,
    rainfall: 'heavy',
    region: 'All India',
    state: 'all',
    city: 'all',
    risk: 'all'
  }
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function loadScenario() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    ui.scenario = {...ui.scenario, ...parsed};
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveScenario() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ui.scenario));
}

function syncScenarioToForm() {
  $('dry').value = String(ui.scenario.dryDays);
  $('dryOut').textContent = `${ui.scenario.dryDays} days`;
  $('rain').value = ui.scenario.rainfall;
  $('region').value = ui.scenario.region;
  $('risk').value = ui.scenario.risk;
  $('state').value = ui.scenario.state;
  $('city').value = ui.scenario.city;
}

function queryString() {
  return new URLSearchParams({
    dryDays: String(ui.scenario.dryDays),
    rainfall: ui.scenario.rainfall,
    region: ui.scenario.region,
    state: ui.scenario.state,
    city: ui.scenario.city,
    risk: ui.scenario.risk
  }).toString();
}

function toast(text) {
  const element = $('toast');
  element.textContent = text;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 3000);
}

async function api(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Request failed');
  return body;
}

function setStatus(mode, label, detail = '') {
  const element = $('systemStatus');
  element.textContent = label;
  element.className = `status-pill ${mode}`;
  element.setAttribute('aria-label', detail ? `${label}. ${detail}` : label);
}

function setMapState(mode, message = '') {
  ui.mapMode = mode;
  ui.mapFallbackMessage = message;
  const fallback = $('mapFallback');
  fallback.hidden = mode === 'tiles';
  fallback.innerHTML = message ? `<p>${message}</p>` : '';
}

function ensureMap() {
  const mapRoot = $('leafletMap');
  if (!window.L || ui.map) {
    if (!window.L) setMapState('fallback', 'Leaflet map failed to load. Use the priority list below.');
    return;
  }

  ui.map = L.map(mapRoot, {
    zoomControl: true,
    keyboard: true,
    minZoom: 4
  }).setView([22.5937, 78.9629], 5);

  ui.markers = L.layerGroup().addTo(ui.map);

  const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  });

  tiles.on('load', () => {
    ui.tileErrors = 0;
    setMapState('tiles');
  });

  tiles.on('tileerror', () => {
    ui.tileErrors += 1;
    if (ui.tileErrors >= 3) {
      setMapState('fallback', 'Map tiles unavailable right now. Markers are shown in the fallback list.');
    }
  });

  tiles.addTo(ui.map);
}

function renderMap(items) {
  ensureMap();

  if (!ui.map || !ui.markers) {
    setMapState('fallback', 'Map preview is unavailable. Use the API-backed priority list and details panel.');
    renderMapFallbackList(items);
    return;
  }

  ui.markers.clearLayers();
  const bounds = [];

  items.forEach((item) => {
    const marker = L.marker([Number(item.lat), Number(item.lon)], {
      title: `${item.name} (${item.score})`
    });

    marker.bindPopup(`<strong>${escapeHtml(item.name)}</strong><br>${escapeHtml(item.city)}, ${escapeHtml(item.state)}<br>Risk: ${escapeHtml(item.score)}/100 (${escapeHtml(item.level)})<br><button class="map-popup-open" data-open-id="${escapeHtml(item.id)}">Open details</button>`);

    marker.on('click', () => {
      ui.current = item;
    });

    ui.markers.addLayer(marker);
    bounds.push([Number(item.lat), Number(item.lon)]);
  });

  renderMapFallbackList(items);

  if (bounds.length === 1) {
    ui.map.setView(bounds[0], 9);
  } else if (bounds.length > 1) {
    ui.map.fitBounds(bounds, {padding: [18, 18]});
  }
}

function renderMapFallbackList(items) {
  const fallback = $('mapFallback');
  if (ui.mapMode === 'tiles') {
    fallback.hidden = true;
    fallback.innerHTML = '';
    return;
  }

  const buttons = items
    .map((item) => `<button class="fallback-item" data-open-id="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(item.city)} (${escapeHtml(item.score)})</button>`)
    .join('');

  fallback.hidden = false;
  fallback.innerHTML = `<p>${ui.mapFallbackMessage || 'Fallback location list'}</p><div class="fallback-list">${buttons}</div>`;
}

function populateFilters(items) {
  const states = [...new Set(items.map((item) => item.state))].sort();
  const cities = [...new Set(items.map((item) => item.city))].sort();

  $('state').innerHTML = '<option value="all">All states</option>' + states.map((state) => `<option>${state}</option>`).join('');
  $('city').innerHTML = '<option value="all">All cities</option>' + cities.map((city) => `<option>${city}</option>`).join('');

  if (states.includes(ui.scenario.state)) $('state').value = ui.scenario.state;
  if (cities.includes(ui.scenario.city)) $('city').value = ui.scenario.city;
}

function renderQueue(items) {
  const queue = $('queueList');

  if (!items.length) {
    queue.innerHTML = '<div class="loading">No matching locations. Change filters and try again.</div>';
    return;
  }

  queue.innerHTML = items.map((item) => `
    <div class="queue-item">
      <div>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.city)}, ${escapeHtml(item.state)} · ${escapeHtml(item.waterBody)}</p>
      </div>
      <div class="queue-score"><b>${escapeHtml(item.score)}</b><small>${escapeHtml(item.level)}</small></div>
      <div class="queue-action">${escapeHtml(item.recommendedAction || 'Inspect')}<br><small>${escapeHtml(item.status || 'Pending')}</small></div>
      <button data-open-id="${escapeHtml(item.id)}">Inspect</button>
    </div>
  `).join('');
}

function renderDashboard(items, stats) {
  const highRiskCount = items.filter((item) => item.score >= 65).length;
  const avgConfidence = items.length ? Math.round(items.reduce((sum, item) => sum + item.confidence, 0) / items.length) : 0;

  $('locationCount').textContent = String(items.length);
  $('highCount').textContent = String(highRiskCount);
  $('confidence').textContent = `${avgConfidence}%`;
  $('actionCount').textContent = String(stats?.actions ?? 0);

  const top = items[0];
  if (!top) {
    $('heroRisk').textContent = '—';
    $('topName').textContent = 'No matching locations';
    $('topScore').textContent = '—';
    $('topSummary').textContent = 'Adjust filters to view records.';
    $('topReasons').innerHTML = '';
    return;
  }

  $('heroRisk').textContent = String(top.score);
  $('topName').textContent = top.name;
  $('topScore').textContent = String(top.score);
  $('topSummary').textContent = `${top.city}, ${top.state} · connected to ${top.waterBody}. ${top.provenance?.note || 'Estimate uses current scenario factors.'}`;
  const reasons = [
    ['Dry spell', `${ui.scenario.dryDays} days`],
    ['Rainfall', `${RAINFALL_MM[ui.scenario.rainfall]} mm`],
    ['Catchment', `${top.catchment}/100`],
    ['Traffic', `${top.traffic}/100`]
  ];
  $('topReasons').replaceChildren(...reasons.map(([label, value]) => {
    const container = document.createElement('div');
    const span = document.createElement('span');
    const strong = document.createElement('b');
    container.className = 'reason';
    span.textContent = label;
    strong.textContent = value;
    container.append(span, strong);
    return container;
  }));

  $('topOpen').onclick = () => openDetail(top.id);
  $('coverage').textContent = `${items.length} monitored · source: API`;
}

function setLastUpdated(dateLike) {
  $('lastUpdated').textContent = `Updated ${new Date(dateLike).toLocaleTimeString('en-IN')}`;
}

async function loadWeather() {
  const weather = await api('/api/weather?lat=17.385&lon=78.486');
  const live = weather.mode === 'live';

  $('weatherMode').textContent = live ? 'Live weather provider' : 'Fallback weather mode';
  $('weatherSource').textContent = `${weather.source} · ${new Date(weather.updatedAt).toLocaleTimeString('en-IN')}`;
  $('weatherSignal').className = `signal-dot ${live ? '' : 'fallback'}`;

  return weather;
}

async function load() {
  if (ui.loading) return;

  ui.loading = true;
  setStatus('pending', 'Refreshing…');
  $('queueList').innerHTML = '<div class="loading">Loading API-backed locations…</div>';

  try {
    const data = await api(`/api/locations?${queryString()}`);
    ui.items = data.items;

    populateFilters(data.items);
    renderDashboard(data.items, data.stats);
    renderQueue(data.items);
    renderMap(data.items);

    const weather = await loadWeather();
    const detail = weather.mode === 'live' ? 'Live provider online' : 'Fallback mode active';
    setStatus(weather.mode === 'live' ? 'live' : 'pending', weather.mode === 'live' ? 'Live' : 'Fallback', detail);
    setLastUpdated(data.updatedAt);
  } catch (error) {
    setStatus('offline', 'Offline', 'Last refresh failed');
    $('queueList').innerHTML = '<div class="loading">Could not load data. <button id="retryLoad">Retry</button></div>';
    const retry = $('retryLoad');
    if (retry) retry.onclick = load;
    toast(error.message);
  } finally {
    ui.loading = false;
  }
}

function factorRows(item) {
  const factors = {
    dryDays: Math.min(100, (ui.scenario.dryDays / 18) * 100),
    rainfall: Math.min(100, (RAINFALL_MM[ui.scenario.rainfall] / 62) * 100),
    catchment: item.catchment,
    traffic: item.traffic,
    construction: item.construction,
    waste: item.waste
  };

  return Object.entries(factors)
    .map(([key, value]) => `<div class="factor-row"><span>${key}</span><div class="factor-bar"><span style="width:${value}%"></span></div><b>${Math.round(value)}</b></div>`)
    .join('');
}

function renderObservationHistory(observations = []) {
  if (!observations.length) return '<small>No observations recorded yet.</small>';

  return observations.map((observation) => `
    <div class="history-item">
      <b>${escapeHtml(observation.condition)}</b>
      <small>${new Date(observation.createdAt).toLocaleString('en-IN')}</small>
    </div>
  `).join('');
}

async function openDetail(id) {
  try {
    const detail = await api(`/api/locations/${id}?dryDays=${ui.scenario.dryDays}&rainfall=${ui.scenario.rainfall}`);
    ui.current = detail;

    $('detailTitle').textContent = detail.name;
    $('detailBody').innerHTML = `
      <div class="detail-meta">
        <div><small>Relative risk</small><b>${detail.score}/100 · ${detail.level}</b></div>
        <div><small>Confidence</small><b>${detail.confidence}%</b></div>
        <div><small>Water body</small><b>${escapeHtml(detail.waterBody)}</b></div>
        <div><small>Provenance</small><b>${escapeHtml(detail.source)}</b></div>
      </div>
      <p class="notice">${escapeHtml(detail.source)}. This score supports prioritization; it is not a laboratory result.</p>
      <h3>Factor breakdown</h3>
      ${factorRows(detail)}
      <div class="history">
        <h3>Action history</h3>
        ${(detail.actions || []).map((action) => `<div class="history-item"><b>${escapeHtml(action.actionType)}</b><small>${new Date(action.createdAt).toLocaleString('en-IN')} · ${escapeHtml(action.actor)}</small></div>`).join('') || '<small>No actions recorded yet.</small>'}
      </div>
      <div class="history">
        <h3>Observation history</h3>
        ${renderObservationHistory(detail.observations)}
      </div>
      <label>Action
        <select id="actionType">
          <option>Inspect</option><option>Clean</option><option>Temporary screen / diversion</option><option>Sample water</option><option>Monitor</option>
        </select>
      </label>
      <label>Note<textarea id="actionNote" rows="2"></textarea></label>
    `;

    $('observationLocationId').value = detail.id;
    $('detail').showModal();
    $('saveAction').focus();
  } catch (error) {
    toast(error.message);
  }
}

async function saveAction() {
  if (!ui.current) return;

  try {
    await api(`/api/locations/${ui.current.id}/actions`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        actionType: $('actionType').value,
        notes: $('actionNote').value
      })
    });

    $('detail').close();
    toast('Action saved to the API.');
    await load();
  } catch (error) {
    toast(error.message);
  }
}

async function submitObservation(event) {
  event.preventDefault();
  const form = event.target;

  try {
    await api('/api/observations', {
      method: 'POST',
      body: new FormData(form)
    });

    $('observation').close();
    form.reset();
    $('observationLocationId').value = ui.current?.id || '';
    toast('Observation saved as pending verification.');
    await load();
  } catch (error) {
    toast(error.message);
  }
}

function addChat(text, who) {
  const box = $('chatMessages');
  const message = document.createElement('div');
  message.className = who === 'user' ? 'user-msg' : 'assistant-msg';
  message.textContent = text;
  box.appendChild(message);
  box.scrollTop = box.scrollHeight;
}

async function chat(event) {
  event.preventDefault();

  const input = $('chatInput');
  const text = input.value.trim();
  if (!text) return;

  addChat(text, 'user');
  input.value = '';

  try {
    const result = await api('/api/chat', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        message: text,
        scenario: ui.scenario,
        locationId: ui.current?.id
      })
    });

    addChat(result.answer, 'assistant');
  } catch (error) {
    addChat(`I could not reach the assistant: ${error.message}`, 'assistant');
  }
}

function applyScenarioFromForm() {
  ui.scenario.dryDays = Number($('dry').value);
  ui.scenario.rainfall = $('rain').value;
  ui.scenario.region = $('region').value;
  ui.scenario.state = $('state').value;
  ui.scenario.city = $('city').value;
  ui.scenario.risk = $('risk').value;
  $('dryOut').textContent = `${ui.scenario.dryDays} days`;
  saveScenario();
}

function resetScenario() {
  ui.scenario = {
    dryDays: 18,
    rainfall: 'heavy',
    region: 'All India',
    state: 'all',
    city: 'all',
    risk: 'all'
  };
  syncScenarioToForm();
  saveScenario();
}

function startPolling() {
  if (ui.polling) clearInterval(ui.polling);
  ui.polling = setInterval(() => {
    void load();
  }, POLL_MS);
}

function bind() {
  ['chatOpen', 'chatOpen2'].forEach((id) => {
    $(id).onclick = () => {
      $('chat').showModal();
      $('chatInput').focus();
    };
  });

  $('refresh').onclick = load;
  $('export').onclick = () => window.open(`/api/reports/priority.csv?${queryString()}`, '_blank');
  $('saveAction').onclick = saveAction;

  $('observationOpen').onclick = () => {
    $('observationLocationId').value = ui.current?.id || '';
    $('observation').showModal();
    $('observationName').focus();
  };

  $('observationForm').onsubmit = submitObservation;
  $('chatForm').onsubmit = chat;

  $('dry').oninput = async () => {
    applyScenarioFromForm();
    await load();
  };

  ['rain', 'region', 'state', 'city', 'risk'].forEach((id) => {
    $(id).onchange = async () => {
      applyScenarioFromForm();
      await load();
    };
  });

  $('reset').onclick = async () => {
    resetScenario();
    await load();
  };

  $('method').onclick = () => $('methodology').scrollIntoView({behavior: 'smooth'});

  document.querySelectorAll('[data-close]').forEach((button) => {
    button.onclick = () => $(button.dataset.close).close();
  });

  document.body.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const locationId = target.getAttribute('data-open-id');
    if (locationId) {
      void openDetail(locationId);
    }
  });

  window.addEventListener('offline', () => setStatus('offline', 'Offline', 'Network connection lost'));
  window.addEventListener('online', () => void load());
}

window.openDetail = openDetail;

loadScenario();
bind();
syncScenarioToForm();
void load();
startPolling();
