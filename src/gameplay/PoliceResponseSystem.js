import { Vector3 } from 'three';
import { poseLightweightHuman } from '../avatar/LightweightHuman.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

export class PoliceResponseSystem {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.elapsed = 0;
    this.jamesJourney = null;
    this.jamesHome = null;
    this.crowdDefaults = new Map();
  }

  alley() {
    return this.game.scenes.get('alley')?.alley ?? null;
  }

  alleyJames() {
    return this.game.scenes.get('alley')?.npcs?.get?.('james') ?? null;
  }

  save() {
    this.game.save?.();
  }

  rememberJamesHome(james) {
    if (this.jamesHome || !james) return;
    this.jamesHome = {
      route: james.route.map((point) => point.clone()),
      speed: james.speed,
    };
  }

  publishJamesResponse(data) {
    const multiplayer = this.game.multiplayer;
    if (!multiplayer?.joined) return false;
    return multiplayer.send({
      type: 'object_update',
      objectId: 'police-james-response',
      data,
    });
  }

  beginJamesJourney({ controllerId = null, visit = null, publish = true } = {}) {
    const alley = this.alley();
    const james = this.alleyJames();
    if (!alley?.policePresent || !james) return false;
    const policeVisit = Math.max(1, Number(visit) || alley.policeVisits || 1);
    if (this.jamesJourney?.visit === policeVisit && !this.jamesJourney.done) return true;

    this.rememberJamesHome(james);
    james.route = [];
    james.speed = 1.45;
    this.game.scenes.get('alley')?.npcs?.resetNavigation?.(james);
    const downstairsJames = this.game.scenes.get('downstairs')?.npcs?.get?.('james');
    if (downstairsJames?.group) downstairsJames.group.visible = false;

    const policePosition = alley.policePosition ?? [-22.5, 0, 0.1];
    this.jamesJourney = {
      visit: policeVisit,
      controllerId,
      phase: 'walking',
      talkRemaining: 2.6,
      done: false,
      target: new Vector3(policePosition[0] + 3.15, 0, policePosition[2] + 0.35),
    };
    this.game.state.data.policeDecisionPending = false;
    this.game.state.data.policePlan = 'james';
    this.save();

    if (publish) {
      const multiplayer = this.game.multiplayer;
      const localId = multiplayer?.localId ?? null;
      this.jamesJourney.controllerId = localId;
      this.publishJamesResponse({
        active: true,
        visit: policeVisit,
        controllerId: localId,
        startedAt: multiplayer?.serverNow?.() ?? Date.now(),
      });
    }
    return true;
  }

  tellJames() {
    const started = this.beginJamesJourney({ publish: true });
    if (!started) {
      this.ui.warning?.('The police are no longer outside.');
      return false;
    }
    this.ui.panel(
      'JAMES · THE POLICE ARE HERE',
      '“Yeah. I’ve got it.” James leaves the club and heads into the alley to speak with the officers.',
      [],
    );
    return true;
  }

  applySharedJamesResponse(data = {}) {
    if (data.active === true) {
      this.beginJamesJourney({
        controllerId: typeof data.controllerId === 'string' ? data.controllerId : null,
        visit: data.visit,
        publish: false,
      });
      return;
    }
    if (
      data.active === false &&
      this.jamesJourney &&
      (!data.visit || Number(data.visit) === this.jamesJourney.visit)
    ) {
      this.jamesJourney.done = true;
    }
  }

  localControlsJourney() {
    const multiplayer = this.game.multiplayer;
    if (!multiplayer?.joined) return true;
    return this.jamesJourney?.controllerId === multiplayer.localId;
  }

  resolveJamesConversation() {
    const journey = this.jamesJourney;
    const alley = this.alley();
    if (!journey || journey.done || !alley?.policePresent) return;
    journey.done = true;

    if (this.localControlsJourney()) {
      const repeatVisit = Math.max(alley.policeVisits || 0, journey.visit || 0) >= 2;
      const outcome = alley.resolvePolice?.(repeatVisit ? 'ticket' : 'cooperate');
      this.publishJamesResponse({
        active: false,
        visit: journey.visit,
        controllerId: journey.controllerId,
        resolvedAt: this.game.multiplayer?.serverNow?.() ?? Date.now(),
      });
      if (repeatVisit) {
        this.ui.warning?.(
          'James talks to the officers. This time they are shutting the party down.',
        );
      } else {
        this.ui.warning?.('James talks to the officers. They leave after the first warning.');
      }
      if (outcome && !this.game.multiplayer?.joined) this.ui.warning?.(outcome);
    }
  }

  restoreJames() {
    const james = this.alleyJames();
    if (james && this.jamesHome) {
      james.route = this.jamesHome.route.map((point) => point.clone());
      james.speed = this.jamesHome.speed;
      this.game.scenes.get('alley')?.npcs?.resetNavigation?.(james);
    }
    const downstairsJames = this.game.scenes.get('downstairs')?.npcs?.get?.('james');
    if (downstairsJames?.group) downstairsJames.group.visible = true;
    this.jamesJourney = null;
  }

  captureCrowdDefaults() {
    for (const level of this.game.scenes.values()) {
      if (!level.crowd || this.crowdDefaults.has(level.definition.id)) continue;
      this.crowdDefaults.set(level.definition.id, {
        min: level.crowd.min,
        idle: level.crowd.idle,
        targetAttendance: level.crowd.targetAttendance,
        danceShare: level.crowd.danceShare,
      });
    }
  }

  moveCrowdOutside() {
    this.captureCrowdDefaults();
    for (const level of this.game.scenes.values()) {
      const crowd = level.crowd;
      if (!crowd) continue;
      if (level.definition.id === 'downstairs') {
        crowd.min = Math.min(2, crowd.max);
        crowd.idle = Math.min(3, crowd.max);
        crowd.targetAttendance = Math.min(3, crowd.max);
      } else {
        crowd.min = 0;
        crowd.idle = 0;
        crowd.targetAttendance = 0;
      }
      crowd.danceShare = 0;
    }
  }

  restoreCrowds() {
    for (const [sceneId, defaults] of this.crowdDefaults.entries()) {
      const crowd = this.game.scenes.get(sceneId)?.crowd;
      if (!crowd) continue;
      crowd.min = defaults.min;
      crowd.idle = defaults.idle;
      crowd.targetAttendance = Math.max(defaults.min, defaults.targetAttendance);
      crowd.danceShare = defaults.danceShare;
    }
  }

  beginShutdown() {
    if (this.game.evacuationStarted) return;
    const alley = this.alley();
    const state = this.game.state.data;
    state.policeShutdowns = Math.min(99, (state.policeShutdowns || 0) + 1);
    const repeat =
      (alley?.policeVisits || 0) >= 2 ||
      state.policeShutdowns >= 2 ||
      alley?.lastPoliceOutcome === 'ticket';
    state.policeTicketReceived = state.policeTicketReceived === true || repeat;

    this.game.evacuationStarted = true;
    this.game.partyLife?.houseDj?.stopHouseAudio?.(0.08);
    this.game.stopAll();
    alley?.beginEvacuation?.();
    this.moveCrowdOutside();
    this.save();

    this.ui.warning?.(
      repeat
        ? 'Police have shut the party down again. A noise complaint ticket has been issued.'
        : 'Police have shut the party down. The music is off and the crowd is moving outside.',
    );
    if (repeat) {
      this.ui.panel(
        'POLICE · NOISE COMPLAINT TICKET',
        'You’ve received a noise complaint ticket. The music is off, the crowd has moved into the alley, and the party is over for tonight.',
        [['Call it a night', () => this.callItANight()]],
      );
      return;
    }

    this.ui.panel(
      'POLICE · PARTY SHUTDOWN',
      'The music stops and almost everyone files outside into the alley. A few stragglers remain inside while the officers clear the party.',
      [
        ['Start the party up again (risk a ticket)', () => void this.startPartyAgain()],
        ['Call it a night', () => this.callItANight()],
      ],
    );
  }

  resetLocalPartyAfterShutdown() {
    const alley = this.alley();
    if (!alley) return;
    alley.evacuationRequired = false;
    alley.evacuationStarted = false;
    alley.policePresent = false;
    alley.policeResponseTime = 0;
    alley.highNoiseTime = 0;
    alley.policeCooldown = 10;
    alley.lastPoliceOutcome = 'party-restarted';
    alley.occupancy = clamp(alley.occupancy, 5, 12);
    alley.setPoliceVisible?.(false);
  }

  async startPartyAgain() {
    if (!this.game.evacuationStarted) return;
    this.resetLocalPartyAfterShutdown();
    this.restoreCrowds();
    this.game.evacuationStarted = false;
    this.game.state.data.policeDecisionPending = false;
    this.save();

    const multiplayer = this.game.multiplayer;
    if (multiplayer?.joined) {
      multiplayer.send({ type: 'party_action', action: 'restart-party' });
      // SharedWorld's legacy raid reset detector must not replace this restart with a full reset,
      // because policeVisits needs to survive so the next shutdown becomes the ticket event.
      if (multiplayer.world) {
        multiplayer.world.lastLocalEvacuationStarted = false;
        multiplayer.world.partyResetPending = true;
      }
    }

    const houseDj = this.game.partyLife?.houseDj;
    houseDj?.holdForPlayer?.(0);
    houseDj?.setSharedFollower?.(false);
    await houseDj?.start?.();
    if (multiplayer?.joined) multiplayer.sharedMedia?.publishHouseDj?.(true);
    this.ui.panel(
      'PARTY BACK ON',
      'You take the risk. A house DJ brings the music back in and the party starts rebuilding. Another police shutdown will end the night with a noise complaint ticket.',
      [],
    );
  }

  callItANight() {
    const multiplayer = this.game.multiplayer;
    if (multiplayer?.joined) multiplayer.send({ type: 'party_action', action: 'reset-party' });

    const entryScene = this.game.invitation?.entry?.sceneId ?? 'alley';
    this.game.state.data.sceneId = entryScene;
    this.game.state.data.position = null;
    this.game.state.data.policeDecisionPending = false;
    this.game.state.data.policeShutdowns = 0;
    this.game.state.data.policeTicketReceived = false;
    this.game.state.save?.();
    globalThis.location?.reload?.();
  }

  updateJames(dt) {
    const journey = this.jamesJourney;
    if (!journey) return;
    const alley = this.alley();
    const james = this.alleyJames();
    const npcSystem = this.game.scenes.get('alley')?.npcs;
    if (!alley || !james || !npcSystem) return;

    if (!alley.policePresent && !alley.evacuationStarted) {
      this.restoreJames();
      return;
    }

    if (journey.phase === 'walking') {
      npcSystem.followNavigation(james, journey.target, dt, { speedMultiplier: 1.28 });
      poseLightweightHuman(james, {
        time: this.elapsed,
        phase: 0.4,
        moving: true,
        energy: 0.58,
      });
      const distance = Math.hypot(
        james.group.position.x - journey.target.x,
        james.group.position.z - journey.target.z,
      );
      if (distance <= 0.72) {
        journey.phase = 'talking';
        npcSystem.resetNavigation(james);
      }
      return;
    }

    if (journey.phase === 'talking') {
      const policePosition = alley.policePosition ?? [-22.5, 0, 0.1];
      james.group.rotation.y = Math.atan2(
        policePosition[0] - james.group.position.x,
        policePosition[2] - james.group.position.z,
      );
      poseLightweightHuman(james, {
        time: this.elapsed,
        phase: 0.2,
        moving: false,
        energy: 0.35,
      });
      const gesture = (Math.sin(this.elapsed * 2.2) + 1) * 0.5;
      james.rightArm.rotation.x = -0.3 - gesture * 0.52;
      james.rightForearm.rotation.x = -0.38 - gesture * 0.48;
      james.head.rotation.y += Math.sin(this.elapsed * 1.1) * 0.05;
      journey.talkRemaining -= dt;
      if (journey.talkRemaining <= 0) this.resolveJamesConversation();
    }

    if (journey.done && !alley.policePresent && !alley.evacuationStarted) this.restoreJames();
  }

  update(dt) {
    this.elapsed += Math.max(0, Number(dt) || 0);
    this.updateJames(dt);
  }

  dispose() {
    this.restoreJames();
  }
}

export function installPoliceResponseSystem(game, ui) {
  if (!game || game.policeResponse) return game?.policeResponse ?? null;
  const system = new PoliceResponseSystem(game, ui);
  game.policeResponse = system;

  game.beginEvacuation = () => system.beginShutdown();

  let lastNow = null;
  const baseUpdate = game.update.bind(game);
  game.update = (now, movementOverride = null) => {
    const result = baseUpdate(now, movementOverride);
    const dt = lastNow == null ? 0 : Math.max(0, Math.min(0.06, (now - lastNow) / 1000));
    lastNow = now;
    if (game.started && !document.hidden) system.update(dt);
    return result;
  };

  const baseDispose = game.dispose.bind(game);
  game.dispose = async () => {
    system.dispose();
    return baseDispose();
  };
  return system;
}
