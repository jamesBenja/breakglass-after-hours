export const GUITARS = [
  { id: 'jazzmaster', label: 'Offset electric', voice: 'bright' },
  { id: 'semi-hollow', label: 'Semi-hollow electric', voice: 'warm' },
  { id: 'solidbody', label: 'Solidbody electric', voice: 'focused' },
  { id: 'acoustic', label: 'Acoustic guitar', voice: 'acoustic' },
];

export const BASSES = [
  { id: 'p-bass', label: 'P-style bass', voice: 'round' },
  { id: 'j-bass', label: 'J-style bass', voice: 'defined' },
  { id: 'short-scale', label: 'Short-scale bass', voice: 'woody' },
];

export const AMPS = [
  { id: 'tweed-combo', label: 'Small tweed combo', character: 'mid-forward' },
  { id: 'clean-combo', label: 'Large clean combo', character: 'wide-clean' },
  { id: 'brit-stack', label: 'British stack', character: 'crunch' },
  { id: 'bass-stack', label: 'Bass head + cabinet', character: 'deep' },
];

export const MICS = [
  { id: 'dynamic-57', label: 'Dynamic 57-style', character: 'forward' },
  { id: 'ribbon', label: 'Ribbon', character: 'smooth' },
  { id: 'fet-condenser', label: 'FET condenser', character: 'detailed' },
  { id: 'tube-condenser', label: 'Tube condenser', character: 'large' },
  { id: 'dynamic-7b', label: 'Broadcast dynamic', character: 'controlled' },
];

export const SYNTHS = [
  { id: 'poly-analog', label: 'Poly analog', wave: 'sawtooth' },
  { id: 'fm-digital', label: 'FM digital', wave: 'sine' },
  { id: 'mono-bass', label: 'Mono bass synth', wave: 'square' },
  { id: 'organ', label: 'Tonewheel organ', wave: 'triangle' },
  { id: 'electric-piano', label: 'Electric piano', wave: 'triangle' },
];

export const DRUM_KITS = [
  { id: 'dry-kit', label: 'Dry studio kit', character: 'tight' },
  { id: 'big-kit', label: 'Big live-room kit', character: 'open' },
  { id: 'electronic-kit', label: 'Electronic / hybrid kit', character: 'electronic' },
  { id: 'muted-kit', label: 'Muted / damped kit', character: 'short' },
];

export const PROCESSORS = {
  eq: [
    { id: 'spectra-eq', label: 'Spectra channel EQ' },
    { id: 'clean-parametric', label: 'Clean parametric EQ' },
    { id: 'broad-musical', label: 'Broad musical EQ' },
  ],
  compressor: [
    { id: 'fet-comp', label: 'Fast FET compressor' },
    { id: 'opto-comp', label: 'Slow optical compressor' },
    { id: 'vca-comp', label: 'VCA compressor' },
    { id: 'none', label: 'No compressor' },
  ],
};

export const gearById = (collection, id) => collection.find((item) => item.id === id) ?? collection[0];
