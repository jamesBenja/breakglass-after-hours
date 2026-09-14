// Pending URLs intentionally do not trigger requests. Source archives stay in Drive.
// Paths are relative to Vite's public/base URL, e.g. assets/models/below.glb.
export const assetManifest = {
  'upstairs-building': {
    type: 'model',
    url: null,
    includesFixtures: false,
    source: 'Breakglass Studios - FULL FLOOR PLANS PACKAGE.pdf',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 1,
  },
  'below-building': {
    type: 'model',
    url: null,
    includesFixtures: false,
    source: 'Below Breakglass 2025.skp + technical diagram',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 1,
  },
  'night-bus': { type: 'audio', url: null, source: 'Synthesized V2.1 placeholder' },
  'glass-floor': { type: 'audio', url: null, source: 'Synthesized V2.1 placeholder' },
  '3am-tool': { type: 'audio', url: null, source: 'Synthesized V2.1 placeholder' },
};
