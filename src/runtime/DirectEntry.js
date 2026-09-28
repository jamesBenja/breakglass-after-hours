export const DIRECT_ENTRY_ALIASES = Object.freeze({
  'dj-booth': Object.freeze({ id: 'dj-booth', sceneId: 'downstairs', anchorId: 'dj' }),
  spectra: Object.freeze({ id: 'spectra', sceneId: 'upstairs', anchorId: 'console' }),
});

function directEntryValue(locationRef) {
  if (!locationRef) return null;
  const search = new URLSearchParams(locationRef.search || '');
  const hash = new URLSearchParams(String(locationRef.hash || '').replace(/^#/, ''));
  return hash.get('start') || search.get('start') || null;
}

export function directEntryFromLocation(locationRef = globalThis.location) {
  const requested = directEntryValue(locationRef)?.trim().toLowerCase();
  return requested ? (DIRECT_ENTRY_ALIASES[requested] ?? null) : null;
}

function directEntryFreeUrl(locationRef) {
  if (!locationRef?.href) return null;
  const url = new URL(locationRef.href);
  url.searchParams.delete('start');
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  hash.delete('start');
  const nextHash = hash.toString();
  url.hash = nextHash ? `#${nextHash}` : '';
  return url;
}

export function consumeDirectEntry(
  locationRef = globalThis.location,
  historyRef = globalThis.history,
) {
  const entry = directEntryFromLocation(locationRef);
  if (!entry) return null;
  const url = directEntryFreeUrl(locationRef);
  if (url && historyRef?.replaceState) {
    historyRef.replaceState(
      historyRef.state,
      globalThis.document?.title ?? '',
      url.href,
    );
  }
  return entry;
}

function validLanding(level, position) {
  if (!Array.isArray(position) || position.length < 3) return null;
  const x = Number(position[0]);
  const requestedY = Number(position[1]);
  const z = Number(position[2]);
  if (![x, requestedY, z].every(Number.isFinite)) return null;

  const collision = level?.collision;
  if (!collision) return [x, requestedY, z];

  const exact = { x, y: requestedY, z };
  if (collision.isValidPosition?.(exact)) return [x, requestedY, z];

  const ground = collision.surfaceAt?.(x, z, requestedY + 0.75);
  if (!ground) return null;
  const grounded = { x, y: Number(ground.height) || 0, z };
  return collision.isValidPosition?.(grounded)
    ? [grounded.x, grounded.y, grounded.z]
    : null;
}

export function resolveDirectEntryLanding(game, entry) {
  if (!game?.scenes || !entry?.sceneId || !entry?.anchorId) return null;
  const level = game.scenes.get(entry.sceneId);
  const anchor = level?.definition?.anchors?.[entry.anchorId];
  if (!level || !anchor?.position) return null;

  const exact = validLanding(level, anchor.position);
  if (exact) return { ...entry, position: exact };

  const [targetX, targetY, targetZ] = anchor.position;
  const radius = Math.max(0.8, Math.min(2.4, Number(anchor.radius) || 1.25));
  for (const distance of [radius * 0.45, radius * 0.7, 1.25, 1.75, 2.25]) {
    for (let step = 0; step < 12; step += 1) {
      const angle = (step / 12) * Math.PI * 2;
      const candidate = [
        targetX + Math.cos(angle) * distance,
        targetY,
        targetZ + Math.sin(angle) * distance,
      ];
      const landing = validLanding(level, candidate);
      if (landing) return { ...entry, position: landing };
    }
  }
  return null;
}
