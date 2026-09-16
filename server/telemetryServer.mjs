import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 8788);
const ADMIN_TOKEN = String(process.env.TELEMETRY_ADMIN_TOKEN || '').trim();
const MAX_BODY_BYTES = 12_000;
const MAX_EVENTS = 50_000;
const ACTIVE_WINDOW_MS = 2 * 60_000;
const STALE_SESSION_MS = 10 * 60_000;
const FIRST_20_MS = 20 * 60_000;
const ALLOWED_ORIGINS = new Set([
  'https://jamesbenja.github.io',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5174',
  'http://localhost:5174',
]);

const EVENT_NAMES = new Set([
  'session_start',
  'session_heartbeat',
  'session_end',
  'avatar_entered',
  'scene_enter',
  'zone_enter',
  'interaction',
  'npc_interaction',
  'locked_door',
  'travel',
  'progression_unlock',
  'dj_start',
  'dj_end',
  'mix_start',
  'mix_submit',
  'mix_pass',
  'mix_fail',
  'police_arrive',
  'police_outcome',
  'arcade_start',
  'arcade_end',
  'group_photo',
  'bar_order',
  'coffee',
  'beaver_food',
  'phone_call_start',
  'phone_call_end',
  'chat_send',
  'voice_toggle',
  'facetime_toggle',
  'multiplayer_join',
  'multiplayer_leave',
]);

const DATA_KEYS = new Set([
  'action',
  'npcId',
  'targetId',
  'progression',
  'result',
  'challengeId',
  'score',
  'attempt',
  'fighterId',
  'callMode',
  'enabled',
  'count',
  'durationMs',
  'trackId',
  'reason',
  'source',
  'outcome',
]);

const sessions = new Map();
const events = [];
const rate = new Map();

const cleanId = (value, max = 64) =>
  typeof value === 'string' ? value.replace(/[^a-zA-Z0-9:._-]/g, '').slice(0, max) : '';
const cleanEnum = (value, max = 48) =>
  typeof value === 'string' ? value.replace(/[^a-zA-Z0-9 _./:-]/g, '').trim().slice(0, max) : '';
const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const clamp = (value, min, max) => Math.max(min, Math.min(max, finite(value)));

function anonymizeBrowser(value) {
  const raw = cleanId(value, 128);
  if (!raw) return null;
  return crypto.createHash('sha256').update(`breakglass-playtest:${raw}`).digest('hex').slice(0, 16);
}

function secureTokenMatch(candidate) {
  if (!candidate || !ADMIN_TOKEN) return false;
  const a = Buffer.from(String(candidate));
  const b = Buffer.from(ADMIN_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function adminToken(request) {
  const authorization = String(request.headers.authorization || '');
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

function cors(request, response) {
  const origin = String(request.headers.origin || '');
  if (ALLOWED_ORIGINS.has(origin)) response.setHeader('access-control-allow-origin', origin);
  response.setHeader('vary', 'origin');
  response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  response.setHeader('access-control-allow-headers', 'content-type, authorization');
  response.setHeader('cache-control', 'no-store');
}

function sanitizeData(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!DATA_KEYS.has(key)) continue;
    if (typeof raw === 'boolean') out[key] = raw;
    else if (typeof raw === 'number') out[key] = clamp(raw, -1_000_000, 1_000_000);
    else if (typeof raw === 'string') out[key] = cleanEnum(raw, 64);
  }
  return out;
}

function sanitizeEvent(value) {
  if (!value || typeof value !== 'object') return null;
  const event = cleanId(value.event, 48);
  if (!EVENT_NAMES.has(event)) return null;
  const sessionId = cleanId(value.sessionId, 72);
  const playtestId = cleanId(value.playtestId, 20);
  if (!sessionId || !playtestId) return null;
  const invitationType = ['participant', 'guestlist', 'dj', 'producer', 'promoter', 'god'].includes(
    value.invitationType,
  )
    ? value.invitationType
    : 'participant';
  const device = ['mobile', 'tablet', 'desktop'].includes(value.device) ? value.device : 'desktop';
  const sceneId = ['alley', 'downstairs', 'upstairs', 'roof'].includes(value.sceneId)
    ? value.sceneId
    : null;
  return {
    event,
    sessionId,
    playtestId,
    browserId: anonymizeBrowser(value.browserId),
    invitationType,
    device,
    sceneId,
    zoneId: cleanEnum(value.zoneId, 64) || null,
    elapsedMs: clamp(value.elapsedMs, 0, 24 * 60 * 60 * 1000),
    at: Date.now(),
    data: sanitizeData(value.data),
  };
}

function rateAllowed(sessionId) {
  const now = Date.now();
  const current = rate.get(sessionId) || { start: now, count: 0 };
  if (now - current.start >= 60_000) {
    current.start = now;
    current.count = 0;
  }
  current.count += 1;
  rate.set(sessionId, current);
  return current.count <= 180;
}

function updateSession(record) {
  const previous = sessions.get(record.sessionId);
  const session =
    previous ||
    {
      sessionId: record.sessionId,
      playtestId: record.playtestId,
      browserId: record.browserId,
      invitationType: record.invitationType,
      device: record.device,
      startedAt: record.at,
      lastAt: record.at,
      lastElapsedMs: 0,
      ended: false,
      eventCount: 0,
      currentScene: record.sceneId,
      currentZone: record.zoneId,
      previousZone: record.zoneId,
      previousElapsedMs: record.elapsedMs,
      zoneSeconds: {},
      eventNames: new Set(),
      firstAt: {},
      npcCounts: {},
      progression: new Set(),
    };

  const deltaMs = Math.max(0, Math.min(60_000, record.elapsedMs - (session.previousElapsedMs || 0)));
  if (session.previousZone && deltaMs > 0) {
    session.zoneSeconds[session.previousZone] =
      (session.zoneSeconds[session.previousZone] || 0) + deltaMs / 1000;
  }

  session.lastAt = record.at;
  session.lastElapsedMs = Math.max(session.lastElapsedMs, record.elapsedMs);
  session.eventCount += 1;
  session.eventNames.add(record.event);
  if (session.firstAt[record.event] == null) session.firstAt[record.event] = record.elapsedMs;
  if (record.sceneId) session.currentScene = record.sceneId;
  if (record.zoneId) session.currentZone = record.zoneId;
  session.previousZone = record.zoneId || session.previousZone;
  session.previousElapsedMs = record.elapsedMs;
  if (record.event === 'session_end') session.ended = true;
  if (record.event === 'npc_interaction' && record.data.npcId) {
    session.npcCounts[record.data.npcId] = (session.npcCounts[record.data.npcId] || 0) + 1;
  }
  if (record.event === 'progression_unlock' && record.data.progression) {
    session.progression.add(record.data.progression);
  }
  sessions.set(record.sessionId, session);
}

function ingest(record) {
  if (!rateAllowed(record.sessionId)) return false;
  events.push(record);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  updateSession(record);
  console.log(`[telemetry] ${JSON.stringify(record)}`);
  return true;
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function countBy(values, getter) {
  const counts = {};
  for (const value of values) {
    const key = getter(value);
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count }));
}

function hasEvent(session, name, predicate = null, withinMs = Infinity) {
  return events.some(
    (event) =>
      event.sessionId === session.sessionId &&
      event.event === name &&
      event.elapsedMs <= withinMs &&
      (!predicate || predicate(event)),
  );
}

function funnel(sessionList, withinMs = Infinity) {
  const steps = [
    ['session', () => true],
    ['avatar', (s) => hasEvent(s, 'avatar_entered', null, withinMs)],
    ['sam', (s) => hasEvent(s, 'npc_interaction', (e) => e.data.npcId === 'sam', withinMs)],
    ['inside', (s) => hasEvent(s, 'scene_enter', (e) => e.sceneId === 'downstairs', withinMs)],
    ['james', (s) => hasEvent(s, 'npc_interaction', (e) => e.data.npcId === 'james', withinMs)],
    ['dj', (s) => hasEvent(s, 'dj_start', null, withinMs)],
    ['studio', (s) => hasEvent(s, 'scene_enter', (e) => e.sceneId === 'upstairs', withinMs)],
    [
      'secret',
      (s) =>
        hasEvent(
          s,
          'progression_unlock',
          (e) => ['tapeArchiveAccessGranted', 'deadRoomAccessGranted', 'roofSecretUnlocked'].includes(e.data.progression),
          withinMs,
        ),
    ],
  ];
  return steps.map(([id, test]) => ({ id, count: sessionList.filter(test).length }));
}

function summary() {
  const now = Date.now();
  const list = [...sessions.values()];
  const active = list.filter((s) => now - s.lastAt <= ACTIVE_WINDOW_MS && !s.ended);
  const finished = list.filter((s) => s.ended || now - s.lastAt > STALE_SESSION_MS);
  const npcTotals = {};
  const zoneTotals = {};
  const progressionTotals = {};
  for (const session of list) {
    for (const [npcId, count] of Object.entries(session.npcCounts))
      npcTotals[npcId] = (npcTotals[npcId] || 0) + count;
    for (const [zoneId, seconds] of Object.entries(session.zoneSeconds))
      zoneTotals[zoneId] = (zoneTotals[zoneId] || 0) + seconds;
    for (const item of session.progression)
      progressionTotals[item] = (progressionTotals[item] || 0) + 1;
  }
  const recent = [...list]
    .sort((a, b) => b.lastAt - a.lastAt)
    .slice(0, 40)
    .map((s) => ({
      playtestId: s.playtestId,
      invitationType: s.invitationType,
      device: s.device,
      durationMs: s.lastElapsedMs,
      scene: s.currentScene,
      zone: s.currentZone,
      events: s.eventCount,
      active: now - s.lastAt <= ACTIVE_WINDOW_MS && !s.ended,
      ended: s.ended,
      startedAt: s.startedAt,
    }));

  return {
    generatedAt: now,
    totalSessions: list.length,
    activeSessions: active.length,
    finishedSessions: finished.length,
    medianDurationMs: median(finished.map((s) => s.lastElapsedMs)),
    invitations: countBy(list, (s) => s.invitationType),
    devices: countBy(list, (s) => s.device),
    funnel: funnel(list),
    first20: funnel(list, FIRST_20_MS),
    topNpcs: Object.entries(npcTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([key, count]) => ({ key, count })),
    topZones: Object.entries(zoneTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 16)
      .map(([key, seconds]) => ({ key, seconds: Math.round(seconds) })),
    progression: Object.entries(progressionTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, count })),
    abandonment: countBy(
      list.filter((s) => !s.ended && now - s.lastAt > STALE_SESSION_MS),
      (s) => s.currentZone || s.currentScene || 'unknown',
    ).slice(0, 12),
    recent,
  };
}

function sessionTimeline(playtestId) {
  const id = cleanId(playtestId, 20);
  const match = [...sessions.values()].find((session) => session.playtestId === id);
  if (!match) return null;
  return events
    .filter((event) => event.sessionId === match.sessionId)
    .map(({ sessionId, browserId, ...event }) => event);
}

function json(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function dashboardHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Breakglass Playtest Analytics</title><style>
  body{font:14px system-ui;background:#0b0b0d;color:#f2f2f2;margin:0;padding:22px}h1{margin:0 0 4px}.muted{color:#aaa}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:18px 0}.card{background:#17171c;border:1px solid #303038;border-radius:12px;padding:14px}.big{font-size:28px;font-weight:700}.row{display:flex;gap:8px;align-items:center;justify-content:space-between;border-bottom:1px solid #292931;padding:7px 0}table{width:100%;border-collapse:collapse;background:#15151a;border-radius:10px;overflow:hidden}td,th{padding:8px;border-bottom:1px solid #292931;text-align:left}code{color:#9bf59b}.bar{height:7px;background:#2a2a31;border-radius:7px;overflow:hidden}.bar i{display:block;height:100%;background:#67d875}</style></head><body>
  <h1>Breakglass Playtest Analytics</h1><div class="muted">Anonymous gameplay timing only. No chat, voice, video, face images, screenshots or avatar names are collected.</div><div id="app">Loading…</div>
  <script>
  const key=new URLSearchParams(location.hash.replace(/^#/,'' )).get('key')||'';
  const fmt=ms=>{const s=Math.round((ms||0)/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
  const rows=(items)=>(items||[]).map(x=>'<div class="row"><span>'+x.key+'</span><b>'+x.count+'</b></div>').join('')||'<span class="muted">No data yet</span>';
  const funnel=(items,total)=>'<div class="grid">'+(items||[]).map(x=>'<div class="card"><b>'+x.id+'</b><div class="big">'+x.count+'</div><div class="bar"><i style="width:'+((x.count/Math.max(1,total))*100)+'%"></i></div></div>').join('')+'</div>';
  async function load(){if(!key){app.innerHTML='<p>Add <code>#key=YOUR_ADMIN_TOKEN</code> to this URL.</p>';return}const r=await fetch('/telemetry/summary',{headers:{Authorization:'Bearer '+key},cache:'no-store'});if(!r.ok){app.textContent='Access denied';return}const d=await r.json();app.innerHTML='<div class="grid"><div class="card"><span class="muted">Sessions</span><div class="big">'+d.totalSessions+'</div></div><div class="card"><span class="muted">Active now</span><div class="big">'+d.activeSessions+'</div></div><div class="card"><span class="muted">Median visit</span><div class="big">'+fmt(d.medianDurationMs)+'</div></div></div><h2>First 20 minutes</h2>'+funnel(d.first20,d.totalSessions)+'<h2>All-session funnel</h2>'+funnel(d.funnel,d.totalSessions)+'<div class="grid"><div class="card"><h3>Invitation types</h3>'+rows(d.invitations)+'</div><div class="card"><h3>Devices</h3>'+rows(d.devices)+'</div><div class="card"><h3>NPC interactions</h3>'+rows(d.topNpcs)+'</div><div class="card"><h3>Progression unlocks</h3>'+rows(d.progression)+'</div><div class="card"><h3>Abandonment points</h3>'+rows(d.abandonment)+'</div><div class="card"><h3>Time by zone</h3>'+((d.topZones||[]).map(x=>'<div class="row"><span>'+x.key+'</span><b>'+Math.round(x.seconds/60)+'m</b></div>').join('')||'<span class="muted">No data yet</span>')+'</div></div><h2>Recent sessions</h2><table><thead><tr><th>ID</th><th>Invite</th><th>Device</th><th>Duration</th><th>Last location</th><th>Events</th></tr></thead><tbody>'+d.recent.map(s=>'<tr><td><code>'+s.playtestId+'</code>'+(s.active?' ●':'')+'</td><td>'+s.invitationType+'</td><td>'+s.device+'</td><td>'+fmt(s.durationMs)+'</td><td>'+(s.zone||s.scene||'—')+'</td><td>'+s.events+'</td></tr>').join('')+'</tbody></table><p class="muted">Auto-refreshes every 15 seconds. Raw sanitized events are also written to Railway deploy logs for historical recovery.</p>'}
  load();setInterval(load,15000);
  </script></body></html>`;
}

const server = http.createServer((request, response) => {
  cors(request, response);
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/health')
    return json(response, 200, { ok: true, sessions: sessions.size, events: events.length });
  if (url.pathname === '/telemetry/dashboard' && request.method === 'GET') {
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(dashboardHtml());
    return;
  }
  if (url.pathname === '/telemetry/summary' && request.method === 'GET') {
    if (!secureTokenMatch(adminToken(request))) return json(response, 401, { ok: false });
    return json(response, 200, { ok: true, ...summary() });
  }
  if (url.pathname === '/telemetry/session' && request.method === 'GET') {
    if (!secureTokenMatch(adminToken(request))) return json(response, 401, { ok: false });
    const timeline = sessionTimeline(url.searchParams.get('id'));
    return timeline ? json(response, 200, { ok: true, timeline }) : json(response, 404, { ok: false });
  }
  if (url.pathname === '/telemetry/event' && request.method === 'POST') {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) request.destroy();
    });
    request.on('end', () => {
      let parsed;
      try {
        parsed = JSON.parse(body || '{}');
      } catch {
        return json(response, 400, { ok: false });
      }
      const record = sanitizeEvent(parsed);
      if (!record) return json(response, 400, { ok: false });
      const accepted = ingest(record);
      return json(response, accepted ? 202 : 429, { ok: accepted });
    });
    return;
  }
  response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('Breakglass playtest telemetry service\n');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Breakglass telemetry listening on :${PORT}`);
});
