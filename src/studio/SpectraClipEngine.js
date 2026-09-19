function clipType(stem, session) {
  if (session?.recordings?.has?.(stem.id)) return 'audio';
  if (stem.assetId) return 'sample';
  if (stem.performance?.events?.some?.((event) => event.drum)) return 'step';
  if (stem.performance?.events?.length) return 'performance';
  return 'pattern';
}

/**
 * Quantized clip launcher layered on top of the existing Spectra stems.
 *
 * A clip's active state is independent from mixer mute/solo. Launch/stop changes are committed
 * on bar boundaries from SpectraTransport, while all audio continues through StudioPlayback's
 * existing studio channel strips and source bus.
 */
export class SpectraClipEngine {
  constructor(game) {
    this.game = game;
    this.pending = new Map();
    this.unsubscribe =
      game.spectraTransport?.subscribe?.('spectra-clip-engine', (event) => this.onStep(event)) ??
      null;
  }

  stem(stemId) {
    return this.game.studio?.stems?.find?.((stem) => stem.id === stemId) ?? null;
  }

  describe(stem) {
    return {
      id: stem.id,
      label: stem.label,
      kind: stem.kind,
      type: clipType(stem, this.game.studio),
      active: stem.clipActive !== false,
      queued: this.pending.get(stem.id) ?? null,
    };
  }

  clips() {
    return (this.game.studio?.stems ?? []).map((stem) => this.describe(stem));
  }

  apply(stemId, active) {
    const stem = this.stem(stemId);
    if (!stem) return false;
    stem.clipActive = active !== false;
    this.pending.delete(stemId);
    this.game.studioPlayback?.updateMix?.(this.game.studio);
    this.game.save?.();
    return stem.clipActive;
  }

  queue(stemId, active) {
    const stem = this.stem(stemId);
    if (!stem) return false;
    const next = active !== false;
    if (!this.game.spectraTransport?.running) return this.apply(stemId, next);
    this.pending.set(stemId, next);
    return next;
  }

  toggle(stemId) {
    const stem = this.stem(stemId);
    if (!stem) return false;
    const queued = this.pending.get(stemId);
    const current = queued == null ? stem.clipActive !== false : queued;
    return this.queue(stemId, !current);
  }

  queueAll(active) {
    for (const stem of this.game.studio?.stems ?? []) this.queue(stem.id, active);
  }

  onStep(event) {
    if (!this.pending.size || event.loopStep % 16 !== 0) return;
    const changes = [...this.pending.entries()];
    for (const [stemId, active] of changes) this.apply(stemId, active);
  }

  dispose() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.pending.clear();
  }
}
