import { LIGHTING_PALETTES } from '../lighting/LightingRig.js';

/** A compact booth-side lighting desk for color, haze and laser control. */
export class LightingControlSystem {
  constructor({ ui, sceneManager }) {
    this.ui = ui;
    this.sceneManager = sceneManager;
  }

  handle(target) {
    if (target?.action !== 'clubLighting') return false;
    this.open();
    return true;
  }

  rig() {
    return this.sceneManager.current?.lighting ?? null;
  }

  open() {
    const rig = this.rig();
    if (!rig) return;
    const snapshot = rig.snapshot();
    const palette = LIGHTING_PALETTES[snapshot.palette] ?? LIGHTING_PALETTES.breakglass;
    this.ui.panel(
      'BELOW · LIGHTING DESK',
      `${palette.label} colors · ${snapshot.preset} intensity · haze ${Math.round(snapshot.haze * 100)}% · lasers ${snapshot.lasers ? 'on' : 'off'}.`,
      [
        ...Object.entries(LIGHTING_PALETTES).map(([id, option]) => [
          `${id === snapshot.palette ? '✓ ' : ''}${option.label}`,
          () => {
            rig.applyPalette(id);
            this.open();
          },
        ]),
        ['Warmup intensity', () => { rig.applyPreset('warmup'); this.open(); }],
        ['Party intensity', () => { rig.applyPreset('party'); this.open(); }],
        ['Peak intensity', () => { rig.applyPreset('peak'); this.open(); }],
        [snapshot.lasers ? 'Lasers off' : 'Lasers on', () => { rig.toggleLasers(); this.open(); }],
        ['More haze', () => { rig.adjustHaze(0.15); this.open(); }],
        ['Less haze', () => { rig.adjustHaze(-0.15); this.open(); }],
      ],
    );
  }
}
