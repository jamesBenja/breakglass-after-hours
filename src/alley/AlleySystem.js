const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

/** Small serializable-feeling simulation for the Breakglass alley spill-out. */
export class AlleySystem {
  constructor(config = {}) {
    this.occupancy = Math.max(0, Math.floor(config.startOccupancy ?? 6));
    this.conversationLevel = clamp(config.conversationLevel ?? 0.24);
    this.disturbance = clamp(config.disturbance ?? 0.12);
    this.staffWarningLevel = 0;
    this.lastWarningAt = -Infinity;
    this.neighborTolerance = clamp(config.neighborTolerance ?? 0.55, 0.15, 0.95);
    this.elapsed = 0;
  }

  chat(amount = 0.08) {
    this.conversationLevel = clamp(this.conversationLevel + amount);
    this.disturbance = clamp(this.disturbance + amount * 0.45);
  }

  quiet(amount = 0.18) {
    this.conversationLevel = clamp(this.conversationLevel - amount);
    this.disturbance = clamp(this.disturbance - amount * 0.7);
  }

  update(dt) {
    this.elapsed += dt;
    const occupancyPressure = clamp(this.occupancy / 16);
    const target = clamp(
      occupancyPressure * 0.22 + this.conversationLevel * 0.72 - this.neighborTolerance * 0.16,
    );
    this.disturbance += (target - this.disturbance) * (1 - Math.exp(-0.22 * dt));
    this.conversationLevel = Math.max(0.12, this.conversationLevel - dt * 0.006);

    const previous = this.staffWarningLevel;
    this.staffWarningLevel = this.disturbance > 0.72 ? 2 : this.disturbance > 0.43 ? 1 : 0;
    if (this.staffWarningLevel > previous) this.lastWarningAt = this.elapsed;

    if (this.staffWarningLevel === 2) {
      this.occupancy = Math.max(2, this.occupancy - dt * 0.12);
      this.conversationLevel = Math.max(0.18, this.conversationLevel - dt * 0.02);
    }
  }

  warningText() {
    if (this.staffWarningLevel >= 2)
      return 'Keep it down out here. Neighbours are sleeping. Bring the energy back inside.';
    if (this.staffWarningLevel === 1) return 'Quiet in the alley, please. Voices carry.';
    return 'It is calm outside. Club bass is bleeding through the door, but the alley is mostly conversation.';
  }

  snapshot() {
    return {
      occupancy: Math.round(this.occupancy),
      conversationLevel: this.conversationLevel,
      disturbance: this.disturbance,
      staffWarningLevel: this.staffWarningLevel,
      lastWarningAt: this.lastWarningAt,
      neighborTolerance: this.neighborTolerance,
      warning: this.warningText(),
    };
  }
}
