export const INVITE_TOKEN_FINGERPRINTS = Object.freeze({
  participant: 'dd14eb2812600449c9af5aba9d22f2c05db55235ad3edb67d426ba9821bb0b2b',
  guestlist: 'c89d78c2364152d4e2e1a1c6539d807b68c7e16486d5b3589b2bf46c907791e9',
  dj: '5b3dd5e4a14bf8547f017ef0d74bced16cf443a077aea6603df57fba9e57dc8b',
  producer: 'bbb06406cb53c9839171a8a495e97eafa1f293a491a5319324281345ea316ef9',
  promoter: '34e42b28ff168d316ed0ed53656533a27b2df6fcde2b02e02278de0446e7bc2c',
});

export function fingerprintInviteToken(value, cryptoModule) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate) return '';
  return cryptoModule.createHash('sha256').update(candidate).digest('hex');
}

export function invitationTypeFromFingerprint(value, cryptoModule) {
  const fingerprint = fingerprintInviteToken(value, cryptoModule);
  if (!fingerprint) return null;
  for (const [type, expected] of Object.entries(INVITE_TOKEN_FINGERPRINTS)) {
    if (fingerprint.length !== expected.length) continue;
    if (
      cryptoModule.timingSafeEqual(
        Buffer.from(fingerprint, 'utf8'),
        Buffer.from(expected, 'utf8'),
      )
    ) {
      return type;
    }
  }
  return null;
}
