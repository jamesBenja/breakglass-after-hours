from pathlib import Path

path = Path('server/multiplayerServer.mjs')
text = path.read_text()
old = "const INVITE_TYPES = new Set(['participant', 'guestlist', 'dj', 'producer', 'promoter']);\n"
new = "const INVITE_TYPES = new Set(['participant', 'guestlist', 'dj', 'producer', 'promoter']);\nconst INVITE_TOKENS = Object.fromEntries(\n  [...INVITE_TYPES].map((type) => [\n    type,\n    String(process.env[`INVITE_${type.toUpperCase()}_TOKEN`] || '').trim(),\n  ]),\n);\n"
if old not in text:
    raise SystemExit('invite types anchor not found')
text = text.replace(old, new, 1)
old_fn = "function inviteTypeFromToken(value) {\n  const candidate = typeof value === 'string' ? value.trim() : '';\n  if (!GOD_MODE_TOKEN || !candidate) return null;\n  const separator = candidate.indexOf('.');\n  if (separator <= 0) return null;\n  const type = candidate.slice(0, separator);\n  const signature = candidate.slice(separator + 1);\n  if (!INVITE_TYPES.has(type) || !signature) return null;\n  const expectedText = crypto\n    .createHmac('sha256', GOD_MODE_TOKEN)\n    .update(`breakglass-invite:${type}`)\n    .digest('base64url');\n  const expected = Buffer.from(expectedText);\n  const received = Buffer.from(signature);\n  return expected.length === received.length && crypto.timingSafeEqual(expected, received)\n    ? type\n    : null;\n}\n"
new_fn = "function secureTokenMatch(candidate, expectedText) {\n  if (!candidate || !expectedText) return false;\n  const expected = Buffer.from(expectedText);\n  const received = Buffer.from(candidate);\n  return expected.length === received.length && crypto.timingSafeEqual(expected, received);\n}\n\nfunction inviteTypeFromToken(value) {\n  const candidate = typeof value === 'string' ? value.trim() : '';\n  if (!candidate) return null;\n\n  for (const type of INVITE_TYPES) {\n    if (secureTokenMatch(candidate, INVITE_TOKENS[type])) return type;\n  }\n\n  // Keep existing HMAC invitations valid for backwards compatibility.\n  if (!GOD_MODE_TOKEN) return null;\n  const separator = candidate.indexOf('.');\n  if (separator <= 0) return null;\n  const type = candidate.slice(0, separator);\n  const signature = candidate.slice(separator + 1);\n  if (!INVITE_TYPES.has(type) || !signature) return null;\n  const expectedText = crypto\n    .createHmac('sha256', GOD_MODE_TOKEN)\n    .update(`breakglass-invite:${type}`)\n    .digest('base64url');\n  return secureTokenMatch(signature, expectedText) ? type : null;\n}\n"
if old_fn not in text:
    raise SystemExit('invite verifier function not found')
text = text.replace(old_fn, new_fn, 1)
path.write_text(text)
