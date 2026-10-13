const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));

export function crowdEngagementScore(snapshot = {}) {
  const attendance = Math.max(0, Number(snapshot.attendance) || 0);
  const danceFloor = Math.max(0, Number(snapshot.danceFloor) || 0);
  const dancing = attendance > 0 ? clamp(danceFloor / attendance) : clamp(snapshot.danceShare);
  const vibe = clamp(snapshot.vibe);
  const mixQuality = clamp(snapshot.mixQuality);
  return Math.round(clamp(dancing * 0.62 + vibe * 0.23 + mixQuality * 0.15) * 100);
}

export function formatSetDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function normalizeGameStats(value = {}) {
  return {
    walkingMeters: Math.max(0, Number(value.walkingMeters) || 0),
    peakCrowdEngagement: Math.max(
      0,
      Math.min(100, Math.round(Number(value.peakCrowdEngagement) || 0)),
    ),
    peakDanceFloorCount: Math.max(0, Math.floor(Number(value.peakDanceFloorCount) || 0)),
    djLongestByName:
      value.djLongestByName && typeof value.djLongestByName === 'object'
        ? { ...value.djLongestByName }
        : {},
  };
}

function meter(value) {
  const filled = Math.max(0, Math.min(10, Math.round((Number(value) || 0) / 10)));
  return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)}`;
}

export class GameStatsSystem {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    game.state.data.gameStats = normalizeGameStats(game.state.data.gameStats);
    this.lastSceneId = null;
    this.lastPosition = null;
    this.activeDjKey = null;
    this.activeDjLabel = null;
    this.activeDjSeconds = 0;
    this.liveCrowdEngagement = 0;
  }

  stats() {
    return this.game.state.data.gameStats;
  }

  trackWalking() {
    const sceneId = this.game.sceneManager.current?.definition?.id ?? null;
    const position = this.game.player?.position;
    if (!position) return;
    if (this.lastPosition && this.lastSceneId === sceneId) {
      const distance = Math.hypot(
        position.x - this.lastPosition.x,
        position.z - this.lastPosition.z,
      );
      if (distance > 0.001 && distance < 0.9) this.stats().walkingMeters += distance;
    }
    this.lastSceneId = sceneId;
    this.lastPosition = { x: position.x, z: position.z };
  }

  djIdentity() {
    const downstairs = this.game.sceneManager.current?.definition?.id === 'downstairs';
    const playerDj = downstairs && this.game.dj?.metrics?.().playing;
    if (playerDj) {
      const label = this.game.state.data.avatar?.displayName || 'Guest';
      return { key: `player:${label.toLowerCase()}`, label };
    }
    const house = this.game.partyLife?.houseDj;
    if (house?.isHouseAudio?.()) {
      return { key: `house:${house.selected.id}`, label: house.selected.name };
    }
    return null;
  }

  trackDj(dt) {
    const identity = this.djIdentity();
    if (!identity || identity.key !== this.activeDjKey) {
      this.activeDjKey = identity?.key ?? null;
      this.activeDjLabel = identity?.label ?? null;
      this.activeDjSeconds = 0;
    }
    if (!identity || dt <= 0) return;
    this.activeDjSeconds += dt;
    const current = this.stats().djLongestByName[identity.key];
    if (!current || this.activeDjSeconds > Number(current.seconds || 0)) {
      this.stats().djLongestByName[identity.key] = {
        label: identity.label,
        seconds: this.activeDjSeconds,
      };
    }
  }

  trackCrowd() {
    const snapshot = this.game.scenes.get('downstairs')?.crowd?.snapshot?.();
    if (!snapshot) return;
    const score = crowdEngagementScore(snapshot);
    this.liveCrowdEngagement = score;
    this.stats().peakCrowdEngagement = Math.max(this.stats().peakCrowdEngagement, score);
    this.stats().peakDanceFloorCount = Math.max(
      this.stats().peakDanceFloorCount,
      Math.floor(Number(snapshot.danceFloor) || 0),
    );
  }

  update(dt) {
    this.trackWalking();
    this.trackDj(dt);
    this.trackCrowd();
  }

  djLeaders() {
    return Object.values(this.stats().djLongestByName)
      .filter((entry) => entry && Number(entry.seconds) > 0)
      .sort((a, b) => Number(b.seconds) - Number(a.seconds))
      .slice(0, 5);
  }

  addCard(grid, title, value, detail = '') {
    const card = this.ui.document.createElement('div');
    card.className = 'mixer-strip';
    const heading = this.ui.document.createElement('strong');
    heading.textContent = title;
    const number = this.ui.document.createElement('div');
    number.textContent = String(value);
    number.style.fontSize = '1.35rem';
    number.style.margin = '0.3rem 0';
    card.append(heading, number);
    if (detail) {
      const small = this.ui.document.createElement('small');
      small.textContent = detail;
      card.appendChild(small);
    }
    grid.appendChild(card);
  }

  panel() {
    const state = this.game.state.data;
    const stats = this.stats();
    const name = state.avatar?.displayName || 'Guest';
    const leaders = this.djLeaders();
    const steps = Math.floor(stats.walkingMeters / 0.74);
    this.ui.panel(
      'BREAKGLASS SCOREBOARD',
      `House records for ${name}. The FLOOR METER is a 0–100 crowd-engagement score based on how much of the room is dancing, the floor vibe and mix quality — not a literal sound-pressure dB reading.`,
      [['Refresh board', () => this.panel()]],
    );
    const grid = this.ui.document.createElement('div');
    grid.className = 'control-grid';
    this.addCard(
      grid,
      'LONGEST DJ SETS',
      leaders.length ? formatSetDuration(leaders[0].seconds) : '—',
      leaders.length
        ? leaders
            .map(
              (entry, index) => `${index + 1}. ${entry.label} ${formatSetDuration(entry.seconds)}`,
            )
            .join(' · ')
        : 'No completed or active sets yet.',
    );
    this.addCard(
      grid,
      'FLOOR METER',
      `${this.liveCrowdEngagement}/100`,
      `${meter(this.liveCrowdEngagement)} · peak ${stats.peakCrowdEngagement}/100 · ${stats.peakDanceFloorCount} dancers peak`,
    );
    this.addCard(
      grid,
      'CIGARETTES',
      Math.max(0, Math.floor(Number(state.smokesShared) || 0)),
      'smoked in the alley',
    );
    this.addCard(
      grid,
      'MADDOX PETS',
      Math.max(0, Math.floor(Number(state.maddoxPets) || 0)),
      'good dog counter',
    );
    this.addCard(
      grid,
      'DRINKS',
      Math.max(0, Math.floor(Number(state.drinksServed) || 0)),
      'alcoholic drinks consumed',
    );
    this.addCard(
      grid,
      'COFFEES',
      Math.max(0, Math.floor(Number(state.coffeesMade) || 0)),
      'espresso / coffee consumed',
    );
    this.addCard(
      grid,
      'STEPS',
      steps.toLocaleString(),
      `${Math.round(stats.walkingMeters)} m explored`,
    );
    this.ui.buttons.prepend(grid);
  }
}

export function installGameStatsEnhancements(game, ui) {
  const system = new GameStatsSystem(game, ui);
  game.gameStats = system;

  const baseDispatch = game.interactions.dispatch.bind(game.interactions);
  game.interactions.dispatch = (target) => {
    if (target?.action === 'scoreboard') {
      system.panel();
      return;
    }
    baseDispatch(target);
  };

  let lastNow = null;
  const baseUpdate = game.update.bind(game);
  game.update = (now, movementOverride = null) => {
    const dt = lastNow == null ? 0 : Math.max(0, Math.min(0.05, (now - lastNow) / 1000));
    lastNow = now;
    const result = baseUpdate(now, movementOverride);
    if (game.started && !document.hidden) system.update(dt);
    return result;
  };

  return system;
}
