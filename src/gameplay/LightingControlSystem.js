import { LIGHTING_PALETTES } from '../lighting/LightingRig.js';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));

/**
 * Booth-side lighting desk plus Killy's automatic macro lighting pass.
 * The LightingRig still handles beat/energy animation every frame; this system chooses the
 * broader palette, intensity, laser and haze state whenever the player is not on the desk.
 */
export class LightingControlSystem {
  constructor({ ui, sceneManager, audio }) {
    this.ui = ui;
    this.sceneManager = sceneManager;
    this.audio = audio;
    this.manualRemaining = 0;
    this.autoClock = 0;
    this.paletteCountdown = 0;
    this.laserCountdown = 0;
    this.hazeCountdown = 0;
    this.idleApplied = false;
  }

  handle(target) {
    if (target?.action !== 'clubLighting') return false;
    this.claimManualControl();
    this.open();
    return true;
  }

  rig() {
    return this.sceneManager.current?.lighting ?? null;
  }

  claimManualControl(seconds = 45) {
    this.manualRemaining = Math.max(this.manualRemaining, Math.max(1, Number(seconds) || 45));
  }

  releaseToKilly() {
    this.manualRemaining = 0;
    this.paletteCountdown = 0;
    this.laserCountdown = 0;
    this.hazeCountdown = 0;
    this.idleApplied = false;
  }

  manualChange(action) {
    this.claimManualControl();
    action();
    this.open({ claim: false });
  }

  open({ claim = false } = {}) {
    const rig = this.rig();
    if (!rig) return;
    if (claim) this.claimManualControl();
    const snapshot = rig.snapshot();
    const palette = LIGHTING_PALETTES[snapshot.palette] ?? LIGHTING_PALETTES.breakglass;
    this.ui.panel(
      'BELOW · LIGHTING DESK',
      `Manual control · ${palette.label} colors · ${snapshot.preset} intensity · haze ${Math.round(
        snapshot.haze * 100,
      )}% · lasers ${snapshot.lasers ? 'on' : 'off'}. Killy takes the lights back automatically when the desk is left alone.`,
      [
        ...Object.entries(LIGHTING_PALETTES).map(([id, option]) => [
          `${id === snapshot.palette ? '✓ ' : ''}${option.label}`,
          () => this.manualChange(() => rig.applyPalette(id)),
        ]),
        ['Warmup intensity', () => this.manualChange(() => rig.applyPreset('warmup'))],
        ['Party intensity', () => this.manualChange(() => rig.applyPreset('party'))],
        ['Peak intensity', () => this.manualChange(() => rig.applyPreset('peak'))],
        [
          snapshot.lasers ? 'Lasers off' : 'Lasers on',
          () => this.manualChange(() => rig.toggleLasers()),
        ],
        ['More haze', () => this.manualChange(() => rig.adjustHaze(0.15))],
        ['Less haze', () => this.manualChange(() => rig.adjustHaze(-0.15))],
        [
          'Let Killy take over',
          () => {
            this.releaseToKilly();
            this.ui.panel(
              'KILLY · LIGHTING',
              'Killy takes the desk back and starts riding the lights with the party.',
              [],
            );
          },
        ],
      ],
    );
  }

  update(dt) {
    const level = this.sceneManager.current;
    const rig = level?.lighting;
    if (level?.definition?.id !== 'downstairs' || !rig) return;

    const step = Math.max(0, Math.min(0.25, Number(dt) || 0));
    if (this.manualRemaining > 0) {
      this.manualRemaining = Math.max(0, this.manualRemaining - step);
      return;
    }

    this.autoClock += step;
    const metrics = this.audio?.metrics?.() ?? rig.snapshot?.() ?? {};
    if (!metrics.playing) {
      if (!this.idleApplied) {
        rig.applyPreset('warmup');
        rig.setLasers(false);
        rig.setHaze(0.32);
        this.idleApplied = true;
      }
      return;
    }

    this.idleApplied = false;
    const energy = clamp(
      (Number(metrics.energy) || 0) * 0.4 +
        (Number(metrics.vibe) || 0) * 0.4 +
        (Number(metrics.bass) || 0) * 0.12 +
        (Number(metrics.mixQuality) || 0) * 0.08,
    );
    const desiredPreset = energy > 0.76 ? 'peak' : energy > 0.38 ? 'party' : 'warmup';
    if (rig.snapshot?.().preset !== desiredPreset) rig.applyPreset(desiredPreset);

    this.paletteCountdown -= step;
    if (this.paletteCountdown <= 0) {
      rig.cyclePalette(1);
      this.paletteCountdown = Math.max(10, 19 - energy * 8);
    }

    this.laserCountdown -= step;
    if (this.laserCountdown <= 0) {
      const phase = Math.floor(this.autoClock / 8);
      const lasers = energy > 0.4 && phase % 4 !== 0;
      rig.setLasers(lasers);
      this.laserCountdown = Math.max(6.5, 11.5 - energy * 4);
    }

    this.hazeCountdown -= step;
    if (this.hazeCountdown <= 0) {
      const drift = Math.sin(this.autoClock * 0.19) * 0.08;
      rig.setHaze(clamp(0.3 + energy * 0.44 + drift, 0.24, 0.82));
      this.hazeCountdown = Math.max(6, 10.5 - energy * 3);
    }
  }
}
