export const SPECTRA_INPUT_KEYS = [
  'drum-machine',
  'drum-kit',
  'synth',
  'guitar',
  'piano',
];

export function spectraInputKey(config = {}, resourceId = '') {
  const resource = String(resourceId || '').toLowerCase();
  const label = String(config.label || '').toLowerCase();
  const mode = String(config.mode || config.stemKind || '').toLowerCase();

  if (resource.includes('drummachine') || label.includes('drum machine')) return 'drum-machine';
  if (resource.includes('modularsynth') || label.includes('modular')) return 'synth';
  if (mode === 'piano' || mode === 'keys' || label === 'piano') return 'piano';
  if (mode === 'guitar') return 'guitar';
  if (mode === 'synth') return 'synth';
  if (mode === 'drums') return 'drum-kit';
  return mode || 'synth';
}

export function spectraInputStem(session, config = {}, resourceId = '', { armedOnly = false } = {}) {
  const key = spectraInputKey(config, resourceId);
  const stems = session?.stems ?? [];
  const eligible = armedOnly ? stems.filter((stem) => stem.recordArm === true) : stems;
  return (
    eligible.find((stem) => stem.inputKey === key) ??
    eligible.find((stem) => stem.kind === config.stemKind || stem.kind === config.mode) ??
    null
  );
}
