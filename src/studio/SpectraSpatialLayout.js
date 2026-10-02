// Speaker order intentionally mirrors Take A Break channels 1–8 clockwise around the room.
export const SPECTRA_SPATIAL_SPEAKERS = Object.freeze([
  { id: 'spk-1', label: '1', grid: [0.12, 0.12], world: [-15.25, 1.3, -5.0] },
  { id: 'spk-2', label: '2', grid: [0.5, 0.05], world: [-12.25, 2.35, -6.0] },
  { id: 'spk-3', label: '3', grid: [0.88, 0.12], world: [-9.25, 1.3, -5.0] },
  { id: 'spk-4', label: '4', grid: [0.96, 0.5], world: [-8.85, 2.3, -1.5] },
  { id: 'spk-5', label: '5', grid: [0.88, 0.88], world: [-9.5, 1.3, 3.25] },
  { id: 'spk-6', label: '6', grid: [0.5, 0.96], world: [-12.25, 2.35, 4.5] },
  { id: 'spk-7', label: '7', grid: [0.12, 0.88], world: [-15.25, 1.3, 3.25] },
  { id: 'spk-8', label: '8', grid: [0.04, 0.5], world: [-16.0, 2.3, -1.5] },
]);

export const DEFAULT_SPATIAL_POSITION = Object.freeze({
  enabled: true,
  x: 0.5,
  y: 0.5,
  spread: 0.16,
});

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));

export function normalizeSpatialPosition(value = {}) {
  return {
    enabled: value.enabled !== false,
    x: clamp(value.x ?? 0.5),
    y: clamp(value.y ?? 0.5),
    spread: clamp(value.spread ?? 0.16),
  };
}

export function spatialSpeakerGains(value = {}) {
  const spatial = normalizeSpatialPosition(value);
  const sigma = 0.085 + spatial.spread * 0.62;
  const weights = SPECTRA_SPATIAL_SPEAKERS.map(({ grid }) => {
    const dx = spatial.x - grid[0];
    const dy = spatial.y - grid[1];
    const distanceSquared = dx * dx + dy * dy;
    return Math.exp(-distanceSquared / (2 * sigma * sigma)) + spatial.spread * 0.055;
  });
  const power = Math.sqrt(weights.reduce((sum, weight) => sum + weight * weight, 0)) || 1;
  return weights.map((weight) => weight / power);
}

export function spatialPositionFromPointer(rect, clientX, clientY) {
  if (!rect?.width || !rect?.height) return { x: 0.5, y: 0.5 };
  return {
    x: clamp((Number(clientX) - rect.left) / rect.width),
    y: clamp((Number(clientY) - rect.top) / rect.height),
  };
}
