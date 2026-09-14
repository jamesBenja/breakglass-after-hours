export const AVATAR_IDENTITIES = [
  'woman',
  'man',
  'nonbinary',
  'neutral',
  'custom',
  'unspecified',
];

export const AVATAR_BODIES = ['slim', 'regular', 'broad'];
export const AVATAR_HAIR = ['buzz', 'short', 'bob', 'long', 'bald'];
export const AVATAR_OUTFITS = ['black', 'club', 'studio', 'bright', 'sport'];
export const AVATAR_ROLES = [
  'dj',
  'producer',
  'dancer',
  'musician',
  'promoter',
  'vj',
  'photographer',
  'explorer',
];
export const AVATAR_SKIN_TONES = ['light', 'warm', 'tan', 'brown', 'deep'];

export const DEFAULT_AVATAR = Object.freeze({
  displayName: 'Guest',
  identity: 'neutral',
  body: 'regular',
  hair: 'short',
  outfit: 'black',
  role: 'explorer',
  skinTone: 'warm',
  photoConsent: true,
});

const allowed = (value, values, fallback) => (values.includes(value) ? value : fallback);

export function normalizeAvatar(value = {}) {
  const displayName =
    typeof value.displayName === 'string' && value.displayName.trim()
      ? value.displayName.trim().slice(0, 24)
      : DEFAULT_AVATAR.displayName;
  return {
    displayName,
    identity: allowed(value.identity, AVATAR_IDENTITIES, DEFAULT_AVATAR.identity),
    body: allowed(value.body, AVATAR_BODIES, DEFAULT_AVATAR.body),
    hair: allowed(value.hair, AVATAR_HAIR, DEFAULT_AVATAR.hair),
    outfit: allowed(value.outfit, AVATAR_OUTFITS, DEFAULT_AVATAR.outfit),
    role: allowed(value.role, AVATAR_ROLES, DEFAULT_AVATAR.role),
    skinTone: allowed(value.skinTone, AVATAR_SKIN_TONES, DEFAULT_AVATAR.skinTone),
    photoConsent: value.photoConsent !== false,
  };
}

export const avatarPalette = {
  skin: {
    light: 0xe8c4ab,
    warm: 0xb9997b,
    tan: 0x9d7358,
    brown: 0x714d3b,
    deep: 0x4a3128,
  },
  outfit: {
    black: 0x242428,
    club: 0x6b2f73,
    studio: 0x344b56,
    bright: 0xd66d3f,
    sport: 0x425aa8,
  },
  hair: {
    buzz: 0x2b211c,
    short: 0x3a2a20,
    bob: 0x1d1716,
    long: 0x472d24,
    bald: 0x2b211c,
  },
};
