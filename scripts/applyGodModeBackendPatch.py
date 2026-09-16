from pathlib import Path

p = Path('server/multiplayerServer.mjs')
s = p.read_text()

needle = "const MAX_PLAYERS_PER_ROOM = Number(process.env.MAX_PLAYERS_PER_ROOM || 24);"
if "const GOD_MODE_TOKEN" not in s:
    s = s.replace(needle, needle + "\nconst GOD_MODE_TOKEN = String(process.env.GOD_MODE_TOKEN || '');", 1)

marker = """const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/health') {"""
replacement = """function validGodModeToken(value) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!GOD_MODE_TOKEN || !candidate) return false;
  const expected = Buffer.from(GOD_MODE_TOKEN);
  const received = Buffer.from(candidate);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function godModeCors(response) {
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-methods', 'GET, OPTIONS');
  response.setHeader('access-control-allow-headers', 'authorization');
  response.setHeader('cache-control', 'no-store');
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/god-mode/verify') {
    godModeCors(response);
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }
    const authorization = String(request.headers.authorization || '');
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const ok = validGodModeToken(token);
    response.writeHead(ok ? 200 : 401, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok }));
    return;
  }
  if (url.pathname === '/health') {"""
if "/god-mode/verify" not in s:
    if marker not in s:
        raise SystemExit('server handler marker not found')
    s = s.replace(marker, replacement, 1)

p.write_text(s)
