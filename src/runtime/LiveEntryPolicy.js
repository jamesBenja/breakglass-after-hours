export const CANONICAL_SPATIAL_PASS = 'B';

export function resolveEntrySpatialPass({ search = '', production = true } = {}) {
  if (production) return CANONICAL_SPATIAL_PASS;
  const requested = new URLSearchParams(search).get('pass');
  return requested === 'A' ? 'A' : CANONICAL_SPATIAL_PASS;
}

export function assertSingleBuildEntryProfile(profile) {
  if (!profile || typeof profile !== 'object') return true;
  for (const key of ['branch', 'build', 'bundle', 'spatialPass', 'versionUrl']) {
    if (Object.hasOwn(profile, key))
      throw new Error(`Entry profile must not select a separate game build: ${key}`);
  }
  return true;
}
