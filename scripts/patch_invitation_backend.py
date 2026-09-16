from pathlib import Path

path = Path('server/multiplayerServer.mjs')
text = path.read_text()

old = "const GOD_MODE_TOKEN = String(process.env.GOD_MODE_TOKEN || '');\nconst MAX_MESSAGE_BYTES"
new = """const GOD_MODE_TOKEN = String(process.env.GOD_MODE_TOKEN || '');
const INVITE_TYPES = new Set(['participant', 'guestlist', 'dj', 'producer', 'promoter']);
const MAX_MESSAGE_BYTES"""
if text.count(old) != 1:
    raise SystemExit('Could not locate server token constants')
text = text.replace(old, new, 1)

old = """function godModeCors(response) {
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-methods', 'GET, OPTIONS');
  response.setHeader('access-control-allow-headers', 'authorization');
  response.setHeader('cache-control', 'no-store');
}

const server = http.createServer((request, response) => {"""
new = """function godModeCors(response) {
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-methods', 'GET, OPTIONS');
  response.setHeader('access-control-allow-headers', 'authorization');
  response.setHeader('cache-control', 'no-store');
}

function inviteTypeFromToken(value) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!GOD_MODE_TOKEN || !candidate) return null;
  const separator = candidate.indexOf('.');
  if (separator <= 0) return null;
  const type = candidate.slice(0, separator);
  const signature = candidate.slice(separator + 1);
  if (!INVITE_TYPES.has(type) || !signature) return null;
  const expectedText = crypto
    .createHmac('sha256', GOD_MODE_TOKEN)
    .update(`breakglass-invite:${type}`)
    .digest('base64url');
  const expected = Buffer.from(expectedText);
  const received = Buffer.from(signature);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received)
    ? type
    : null;
}

const server = http.createServer((request, response) => {"""
if text.count(old) != 1:
    raise SystemExit('Could not locate CORS helper')
text = text.replace(old, new, 1)

old = """    response.end(JSON.stringify({ ok }));
    return;
  }
  if (url.pathname === '/health') {"""
new = """    response.end(JSON.stringify({ ok }));
    return;
  }
  if (url.pathname === '/invite/verify') {
    godModeCors(response);
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }
    const authorization = String(request.headers.authorization || '');
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const type = inviteTypeFromToken(token);
    response.writeHead(type ? 200 : 401, {
      'content-type': 'application/json; charset=utf-8',
    });
    response.end(JSON.stringify({ ok: !!type, type }));
    return;
  }
  if (url.pathname === '/health') {"""
if text.count(old) != 1:
    raise SystemExit('Could not locate server routes')
text = text.replace(old, new, 1)

path.write_text(text)
print('Invitation verification endpoint patched.')
