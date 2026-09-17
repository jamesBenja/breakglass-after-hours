const INVITE_TYPES = new Set([
  'participant',
  'guestlist',
  'dj',
  'producer',
  'residentproducer',
  'promoter',
]);

const INVITE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAB0to465S4Aa52dYKg8xd0o7pV8TgBPokSwhNWUSFVJQ=
-----END PUBLIC KEY-----`;

function matchesResidentProducerToken(candidate, cryptoModule) {
  const configured = String(process.env.INVITE_RESIDENTPRODUCER_TOKEN || '').trim();
  if (!candidate || !configured) return false;
  const expected = Buffer.from(configured);
  const received = Buffer.from(candidate);
  return expected.length === received.length && cryptoModule.timingSafeEqual(expected, received);
}

/**
 * Verify a v1 invitation without storing any bearer credential on the server.
 * The role claim is signed offline with Ed25519. Only the public key ships with the app.
 *
 * Resident Producer also supports the same environment-token workflow as the existing invite
 * classes so a private beta link can be issued immediately without the offline signing key.
 *
 * This function keeps its original export name so the multiplayer server can rotate from the
 * short-lived fingerprint repair without changing its request routing.
 */
export function invitationTypeFromFingerprint(value, cryptoModule) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (matchesResidentProducerToken(candidate, cryptoModule)) return 'residentproducer';

  const match = /^v1\.([a-z]+)\.([A-Za-z0-9_-]+)$/.exec(candidate);
  if (!match) return null;

  const [, type, signatureText] = match;
  if (!INVITE_TYPES.has(type)) return null;

  try {
    const signature = Buffer.from(signatureText, 'base64url');
    const message = Buffer.from(`breakglass-invite-v1:${type}`, 'utf8');
    const publicKey = cryptoModule.createPublicKey(INVITE_PUBLIC_KEY);
    return cryptoModule.verify(null, message, publicKey, signature) ? type : null;
  } catch {
    return null;
  }
}
