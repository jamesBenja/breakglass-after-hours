export const SPECTRA_INPUT_KEYS = ['drum-machine', 'drum-kit', 'synth', 'modular', 'guitar', 'piano'];

export function spectraInputKey(config = {}, resourceId = '') {
  const explicit = String(config.inputKey || '').toLowerCase();
  if (SPECTRA_INPUT_KEYS.includes(explicit)) return explicit;
  const resource = String(resourceId || '').toLowerCase();
  const label = String(config.label || '').toLowerCase();
  const mode = String(config.mode || config.stemKind || '').toLowerCase();

  if (resource.includes('drummachine') || label.includes('drum machine')) return 'drum-machine';
  if (resource.includes('modularsynth') || label.includes('modular')) return 'modular';
  if (mode === 'piano' || mode === 'keys' || label === 'piano') return 'piano';
  if (mode === 'guitar' || mode === 'bass') return 'guitar';
  if (mode === 'synth') return 'synth';
  if (mode === 'drums') return 'drum-kit';
  return mode || 'synth';
}

export function spectraInputStems(
  session,
  config = {},
  resourceId = '',
  { armedOnly = false, monitoredOnly = false } = {},
) {
  const key = spectraInputKey(config, resourceId);
  const stems = session?.stems ?? [];
  const eligible = stems.filter(
    (stem) => (!armedOnly || stem.recordArm === true) && (!monitoredOnly || stem.monitor !== false),
  );
  const exact = eligible.filter((stem) => stem.inputKey === key);
  if (exact.length) return exact;
  return eligible.filter((stem) => stem.kind === config.stemKind || stem.kind === config.mode);
}

export function spectraInputStem(session, config = {}, resourceId = '', options = {}) {
  return spectraInputStems(session, config, resourceId, options)[0] ?? null;
}
