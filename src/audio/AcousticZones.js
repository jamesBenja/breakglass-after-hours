const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));

export const SPATIAL_TRANSPORT_OWNERS = Object.freeze(['dj', 'studio', 'archive']);

const environment = (gain, lowpassHz, label, portal = false) => ({
  gain: clamp(gain, 0, 1.2),
  lowpassHz: clamp(lowpassHz, 280, 22000),
  label,
  portal,
});

const SILENT = Object.freeze(environment(0, 350, 'acoustically isolated'));

function upstairsArchive(surfaceId) {
  if (surfaceId === 'neve-suite')
    return environment(1, 19000, 'Neve tape playback');
  if (surfaceId === 'live-room')
    return environment(0.28, 3200, 'tape through studio walls');
  if (surfaceId === 'mixing-suite')
    return environment(0.22, 2700, 'tape through control-room walls');
  if (surfaceId === 'circulation' || surfaceId === 'east-hall' || surfaceId === 'emergency-hall')
    return environment(0.075, 1500, 'tape through doorway / hall');
  if (surfaceId === 'storage' || surfaceId === 'bar-kitchen')
    return environment(0.035, 900, 'distant tape through walls');
  if (surfaceId === 'below-stair' || String(surfaceId).startsWith('below-step-'))
    return environment(0.018, 650, 'tape at studio stair portal', true);
  return environment(0.025, 760, 'distant tape through studio walls');
}

function upstairsStudio(surfaceId) {
  if (surfaceId === 'mixing-suite')
    return environment(1, 20000, 'Spectra control room');
  if (surfaceId === 'live-room')
    return environment(0.74, 12000, 'live room monitor bleed');
  if (surfaceId === 'dead-room')
    return environment(0.46, 6800, 'dead room');
  if (surfaceId === 'neve-suite')
    return environment(0.28, 3600, 'studio playback through walls');
  if (surfaceId === 'circulation' || surfaceId === 'east-hall' || surfaceId === 'emergency-hall')
    return environment(0.15, 2200, 'studio playback in hallway');
  if (surfaceId === 'storage' || surfaceId === 'bar-kitchen')
    return environment(0.06, 1200, 'studio playback through walls');
  if (surfaceId === 'below-stair' || String(surfaceId).startsWith('below-step-'))
    return environment(0.025, 700, 'studio playback at stair portal', true);
  return environment(0.07, 1300, 'distant studio playback');
}

function downstairsDj(surfaceId, installationFocus = false) {
  if (surfaceId === 'club') return environment(1, 20000, 'club floor');
  if (surfaceId === 'lounge' || surfaceId === 'lounge-door') {
    if (installationFocus)
      return environment(0.018, 480, 'Take A Break immersive installation focus · club through wall');
    return environment(0.045, 780, 'Take A Break immersive installation · club through wall');
  }
  if (surfaceId === 'service' || surfaceId === 'bar-door')
    return environment(0.62, 5600, 'bar / service room');
  if (surfaceId === 'storage')
    return environment(0.42, 3100, 'downstairs storage');
  if (surfaceId === 'coat-check')
    return environment(0.46, 3300, 'coat check / alley stair');
  if (
    surfaceId === 'stair-landing' ||
    surfaceId === 'studio-stair-top' ||
    surfaceId === 'studio-stairs' ||
    surfaceId === 'alley-stairs' ||
    surfaceId === 'alley-stair-bottom' ||
    surfaceId === 'clark-emergency-stairs'
  )
    return environment(0.34, 2200, 'club at stair portal', true);
  return environment(0.68, 7800, 'Below circulation');
}

function upstairsDj(surfaceId) {
  if (surfaceId === 'below-stair' || String(surfaceId).startsWith('below-step-'))
    return environment(0.105, 820, 'club through studio stair portal', true);
  if (surfaceId === 'circulation' || surfaceId === 'east-hall')
    return environment(0.018, 460, 'very distant club through floor');
  return environment(0.006, 350, 'club isolated by studio floor');
}

/**
 * Local acoustic model for long-running shared transports.
 *
 * Multiplayer synchronizes source state/timeline separately. Every client calls this model for
 * its own listener, so a tape can be running in the Neve room without becoming global audio.
 * Cross-floor sound is silent by default; the few intentional stair/exterior paths are explicit.
 */
export function acousticEnvironmentFor(
  owner,
  sceneId,
  surfaceId = '',
  { installationFocus = false } = {},
) {
  if (owner === 'archive') {
    if (sceneId !== 'upstairs') return SILENT;
    return upstairsArchive(surfaceId);
  }

  if (owner === 'studio') {
    if (sceneId !== 'upstairs') return SILENT;
    return upstairsStudio(surfaceId);
  }

  if (owner === 'dj') {
    if (sceneId === 'downstairs') return downstairsDj(surfaceId, installationFocus);
    if (sceneId === 'alley')
      return environment(0.14, 760, 'club through exterior wall / stair door', true);
    if (sceneId === 'upstairs') return upstairsDj(surfaceId);
    return SILENT;
  }

  return environment(1, 20000, 'local source');
}

export function acousticEnvironmentKey(owner, sceneId, surfaceId, options = {}) {
  const env = acousticEnvironmentFor(owner, sceneId, surfaceId, options);
  return [owner, sceneId, surfaceId, env.gain, env.lowpassHz, options.installationFocus ? 1 : 0].join(':');
}

export function sourceIsAudible(environmentValue, threshold = 0.001) {
  return (environmentValue?.gain ?? 0) > threshold;
}
