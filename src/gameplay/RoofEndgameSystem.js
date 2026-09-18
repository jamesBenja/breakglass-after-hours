const ROOF_AC_POSITION = Object.freeze([5.35, 0.72, -2.55]);

export const ROOF_STORY_IDS = [
  'jace-built',
  'jace-sessions',
  'jace-building',
  'dave-loadins',
  'dave-roof',
  'dave-neighbourhood',
  'james-records',
  'james-below',
  'james-future',
];

export const ROOF_STORIES = {
  jace: [
    {
      id: 'jace-built',
      title: 'Building a studio one problem at a time',
      text: 'Jace remembers the early Breakglass years as less of a grand opening than a long sequence of rooms becoming useful: wiring, patching, moving gear, rebuilding things and learning the building by solving whatever broke next. The place accumulated character because people kept making it work.',
    },
    {
      id: 'jace-sessions',
      title: 'The nights that turned into mornings',
      text: 'Jace talks about the long studio nights: somebody arrives to track one thing, another person drops in, a session expands, and suddenly the sun is coming up. The memory is less one famous night than years of musicians overlapping in the same rooms.',
    },
    {
      id: 'jace-building',
      title: 'The building is part of the instrument',
      text: 'Jace points out that a twenty-year studio history is also a history of repairs, leaks, strange noises, improvised solutions and learning what every wall and room can do. Breakglass never existed separately from the stubborn old building around it.',
    },
  ],
  dave: [
    {
      id: 'dave-loadins',
      title: "Sandor's white tape",
      text: 'Dave remembers the big old freight elevator: a slow grey manual cage where you had to pull the gate shut and keep holding UP or DOWN the entire trip. The floor never stopped itself in quite the right place, so Sandor, the wonderfully eccentric old superintendent from two landlords back, put pieces of white electrical tape on the elevator and the doorway. You stopped only when the two tape marks lined up. That was how amps, drums, consoles, cases and half the history of Breakglass actually travelled through the building.',
    },
    {
      id: 'dave-roof',
      title: 'Roof breaks',
      text: 'Dave says the roof was the pressure valve. Sessions, construction, parties and long days could all stop for ten minutes up here. You could look over the neighbourhood, smoke, complain about whatever was broken and then go back downstairs.',
    },
    {
      id: 'dave-neighbourhood',
      title: 'Watching the blocks change',
      text: 'Dave remembers that the view never stayed completely the same. Businesses vanished, new buildings arrived and the neighbourhood slowly started speaking a different visual language. The roof made those changes unusually easy to notice.',
    },
  ],
  james: [
    {
      id: 'james-records',
      title: 'A place people kept bringing music to',
      text: 'James remembers the studio less as a list of credits than as a stream of people bringing unfinished music through the door. Records, rehearsals, mixes, experiments and strange one-off ideas all passed through the same building and left a little residue behind.',
    },
    {
      id: 'james-below',
      title: 'When the building became more than a studio',
      text: 'James talks about Breakglass gradually becoming a place where recording, DJ culture, live broadcasts, parties and community started overlapping. Below changed what the whole building could be: the music could move from a session to a room full of people and back again.',
    },
    {
      id: 'james-future',
      title: 'The end of one address is not the end of the idea',
      text: 'James looks across the roof and says the useful question was never how to freeze Breakglass exactly as it was. The interesting part is what survives when the rooms change: the records, the relationships, the knowledge, the stories and whatever gets built next.',
    },
  ],
};

const hasModularTake = (data = {}) =>
  (data.studio?.stems ?? []).some((stem) => stem?.source === 'modular-synth');

export function roofStoryComplete(data = {}) {
  const heard = new Set(data.roofStoriesHeard ?? []);
  return ROOF_STORY_IDS.every((id) => heard.has(id));
}

export function endgameChecklist(data = {}, context = {}) {
  return [
    {
      id: 'dj',
      label: 'Pass the DJ lesson / proficiency check',
      complete: data.djLessonCompleted === true || context.djLessonCompleted === true,
    },
    {
      id: 'mixing',
      label: 'Pass every Spectra mixing challenge',
      complete: data.mixingRewardKey === true,
    },
    {
      id: 'arcade',
      label: 'Win Underground Kombat',
      complete: Number(data.arcadeWins) > 0,
    },
    {
      id: 'bathroom',
      label: 'Clear the flooding-toilet plunger game',
      complete: Number(data.bathroomPlungeWins) > 0,
    },
    {
      id: 'modular',
      label: 'Record a modular sequence into Spectra',
      complete: hasModularTake(data),
    },
    {
      id: 'studio-song',
      label: 'Save a studio loop/song',
      complete: (data.studioSongs?.length ?? 0) > 0,
    },
    {
      id: 'maddox',
      label: 'Earn Maddox’s trust and discover the roof',
      complete: data.roofSecretUnlocked === true,
    },
    {
      id: 'dead-room',
      label: 'Unlock the Dead Room',
      complete: data.deadRoomAccessGranted === true,
    },
    {
      id: 'archive',
      label: 'Open the tape archive and thread an archive reel',
      complete: data.tapeArchiveAccessGranted === true && !!data.threadedTape,
    },
    {
      id: 'roof-stories',
      label: 'Hear every founder roof story',
      complete: roofStoryComplete(data),
    },
    {
      id: 'roof-ac',
      label: 'Fix the roof air conditioner',
      complete: data.roofAcFixed === true,
    },
    {
      id: 'gentrification',
      label: 'Use the golden condo key on the roof skyline',
      complete: data.gentrificationTransformed === true,
    },
  ];
}

export function fullGameComplete(data = {}, context = {}) {
  return endgameChecklist(data, context).every((item) => item.complete);
}

export class RoofEndgameSystem {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.acAlignment = 2;
    this.acStage = 0;
    this.acAudioSignature = '';
    this.syncVisuals();
  }

  data() {
    return this.game.state.data;
  }

  context() {
    return { djLessonCompleted: this.game.djLesson?.completed === true };
  }

  save() {
    if (this.game.djLesson?.completed) this.data().djLessonCompleted = true;
    this.game.save?.();
    this.syncVisuals();
  }

  sceneObject(sceneId, name) {
    return this.game.scenes?.get?.(sceneId)?.scene?.getObjectByName?.(name) ?? null;
  }

  acPointTone(options = {}) {
    return this.game.spatialAudio?.pointTone?.(ROOF_AC_POSITION, {
      refDistance: 1.15,
      maxDistance: 17,
      rolloffFactor: 1.18,
      ...options,
    });
  }

  syncAcAudio(force = false) {
    const spatial = this.game.spatialAudio;
    if (!spatial) return;
    const onRoof = this.game.sceneManager?.current?.definition?.id === 'roof';
    if (!onRoof || !this.game.audio?.context) {
      if (this.acAudioSignature) spatial.stopPointMachine?.('roof-ac', 0.16);
      this.acAudioSignature = '';
      return;
    }

    const fixed = this.data().roofAcFixed === true;
    const offset = Math.abs(Number(this.acAlignment) || 0);
    let settings;
    let signature;

    if (fixed) {
      signature = 'fixed';
      settings = {
        position: ROOF_AC_POSITION,
        baseFrequency: 106,
        secondaryFrequency: 212,
        volume: 0.016,
        pulseRate: 0.48,
        pulseDepth: 0.00045,
        wave: 'triangle',
        refDistance: 1.35,
        maxDistance: 19,
        rolloffFactor: 1.05,
      };
    } else if (this.acStage === 2) {
      signature = 'test-ready';
      settings = {
        position: ROOF_AC_POSITION,
        baseFrequency: 99,
        secondaryFrequency: 198,
        volume: 0.019,
        pulseRate: 1.1,
        pulseDepth: 0.001,
        wave: 'triangle',
        refDistance: 1.3,
        maxDistance: 18,
        rolloffFactor: 1.08,
      };
    } else if (this.acStage === 1) {
      signature = `alignment:${offset}`;
      settings = {
        position: ROOF_AC_POSITION,
        baseFrequency: 92 + offset * 2.5,
        secondaryFrequency: 146 + offset * 5,
        volume: 0.022 + offset * 0.0025,
        pulseRate: 3.2 + offset * 2.25,
        pulseDepth: 0.0015 + offset * 0.0018,
        wave: 'triangle',
        refDistance: 1.25,
        maxDistance: 18,
        rolloffFactor: 1.1,
      };
    } else {
      signature = 'broken';
      settings = {
        position: ROOF_AC_POSITION,
        baseFrequency: 91,
        secondaryFrequency: 143,
        volume: 0.027,
        pulseRate: 7.8,
        pulseDepth: 0.0065,
        wave: 'triangle',
        refDistance: 1.25,
        maxDistance: 18,
        rolloffFactor: 1.12,
      };
    }

    if (!force && signature === this.acAudioSignature) return;
    spatial.setPointMachine?.('roof-ac', settings);
    this.acAudioSignature = signature;
  }

  syncVisuals() {
    const data = this.data();
    const key = this.sceneObject('upstairs', 'gentrification-key');
    if (key) key.visible = data.gentrificationKey === true ? false : true;

    const roof = this.game.scenes?.get?.('roof');
    roof?.roof?.syncGentrification?.(data.gentrificationTransformed === true);

    for (const id of data.roofThrownItems ?? []) {
      const object = this.sceneObject('roof', `roof-throw-${id}`);
      if (object) object.visible = false;
    }

    const freightUnlocked =
      this.game.godMode === true ||
      data.roofEscapeUnlocked === true ||
      fullGameComplete(data, this.context());
    const freightPosition = Number.isFinite(Number(data.freightElevatorPosition))
      ? Number(data.freightElevatorPosition)
      : 0;
    const freight = this.sceneObject('roof', 'roof-freight-elevator');
    if (freight) freight.visible = freightUnlocked && Math.abs(freightPosition) <= 2.2;
    const freightCover = this.sceneObject('roof', 'roof-freight-hatch-cover');
    if (freightCover) freightCover.visible = !freightUnlocked;
    const shaftMouth = this.sceneObject('roof', 'roof-freight-shaft-mouth');
    if (shaftMouth) shaftMouth.visible = freightUnlocked;
  }

  collectGentrificationKey() {
    if (this.data().gentrificationKey) {
      this.ui.panel('GENTRIFICATION KEY', 'The little gold condominium is already in your pocket.');
      return;
    }
    this.data().gentrificationKey = true;
    this.save();
    this.ui.panel(
      'THE GENTRIFICATION KEY',
      'You pick up a glowing gold key shaped like a tiny condominium tower. It is absurdly heavy for its size. Somewhere above the studio, there must be a lock stupid enough to fit it.',
    );
  }

  throwItem(target) {
    const id = target.throwId ?? target.throwKind ?? 'box';
    const thrown = new Set(this.data().roofThrownItems ?? []);
    if (thrown.has(id)) {
      this.ui.panel('ROOF EDGE', 'That item is already somewhere near the alley dumpster.');
      return;
    }
    const object = this.sceneObject('roof', target.objectName ?? `roof-throw-${id}`);
    if (object) object.visible = false;
    thrown.add(id);
    this.data().roofThrownItems = [...thrown];
    this.game.scenes
      ?.get?.('roof')
      ?.roof?.throwInteractive?.(target.throwKind ?? id, target.throwSource ?? target.position);
    this.save();
    const labels = { chair: 'folding chair', box: 'cardboard box', lumber: 'bundle of lumber' };
    this.ui.panel(
      'ROOF THROW',
      `You heave the ${labels[id] ?? 'roof junk'} over the parapet. It pinwheels toward the alley dumpster. This is unquestionably more satisfying than carrying it back downstairs.`,
    );
  }

  acPanel() {
    this.syncAcAudio(true);
    const fixed = this.data().roofAcFixed === true;
    this.ui.panel(
      'ROOF · AIR CONDITIONER',
      fixed
        ? 'The old rooftop unit is running with a surprisingly steady hum. You fixed the rattle.'
        : 'The old unit shudders, rattles and occasionally makes a sound that suggests it resents the entire building.',
      fixed
        ? [['Kick it anyway', () => this.kickAc()]]
        : [
            ['Kick it', () => this.kickAc()],
            ['Try to actually fix it', () => this.startAcRepair()],
          ],
    );
  }

  kickAc() {
    this.data().roofAcKicks = Math.min(999, (this.data().roofAcKicks ?? 0) + 1);
    this.game.scenes?.get?.('roof')?.roof?.kickAc?.();
    this.acPointTone({
      frequency: 74,
      endFrequency: 48,
      duration: 0.16,
      volume: 0.13,
      wave: 'square',
    });
    this.acPointTone({
      frequency: 168,
      endFrequency: 105,
      duration: 0.09,
      volume: 0.055,
      wave: 'triangle',
      when: 0.012,
    });
    this.save();
    this.ui.panel(
      'THUNK',
      this.data().roofAcFixed
        ? 'The repaired unit barely notices. Probably for the best.'
        : 'The rattle stops for about one second, then comes back with a slightly different rhythm.',
      [['Back to the AC', () => this.acPanel()]],
    );
  }

  startAcRepair() {
    this.acStage = 0;
    this.acAlignment = 2;
    this.acPointTone({
      frequency: 128,
      endFrequency: 92,
      duration: 0.18,
      volume: 0.055,
      wave: 'square',
    });
    this.syncAcAudio(true);
    this.acRepairPanel();
  }

  acRepairPanel() {
    if (this.acStage === 0) {
      this.ui.panel(
        'AC PUZZLE · FIND THE RATTLE',
        'This is a game abstraction, not real repair instructions. Three panels are vibrating. Which one is actually driving the noise?',
        [
          ['Left panel', () => this.acGuess(false)],
          ['Fan housing', () => this.acGuess(true)],
          ['Right panel', () => this.acGuess(false)],
        ],
      );
      return;
    }
    if (this.acStage === 1) {
      const meter =
        this.acAlignment === 0 ? 'CENTERED' : this.acAlignment < 0 ? '◀ OFF' : 'OFF ▶';
      this.ui.panel(
        'AC PUZZLE · BALANCE THE FAN',
        `Vibration meter: ${meter}. Nudge the virtual mount until the fan sits in the centre zone.`,
        [
          ['Nudge left', () => this.acNudge(-1)],
          ['Nudge right', () => this.acNudge(1)],
          ...(this.acAlignment === 0 ? [['Lock alignment', () => this.acLock()]] : []),
        ],
      );
      return;
    }
    this.ui.panel(
      'AC PUZZLE · TEST CYCLE',
      'The housing is steady and the fan is centred. Run the test cycle without touching anything.',
      [['Run test', () => this.finishAcRepair()]],
    );
  }

  acGuess(correct) {
    if (!correct) {
      this.acPointTone({
        frequency: 232,
        endFrequency: 176,
        duration: 0.1,
        volume: 0.075,
        wave: 'square',
      });
      this.acPointTone({
        frequency: 316,
        duration: 0.07,
        volume: 0.04,
        wave: 'triangle',
        when: 0.055,
      });
      this.ui.panel(
        'WRONG PANEL',
        'That panel is noisy, but it is only reacting to the real vibration. The unit rattles harder.',
        [['Try again', () => this.acRepairPanel()]],
      );
      return;
    }
    this.acStage = 1;
    this.acPointTone({
      frequency: 142,
      endFrequency: 118,
      duration: 0.13,
      volume: 0.06,
      wave: 'triangle',
    });
    this.syncAcAudio(true);
    this.acRepairPanel();
  }

  acNudge(amount) {
    this.acAlignment = Math.max(-3, Math.min(3, this.acAlignment + amount));
    this.acPointTone({
      frequency: amount < 0 ? 186 : 214,
      endFrequency: amount < 0 ? 164 : 190,
      duration: 0.055,
      volume: 0.045,
      wave: 'square',
    });
    this.syncAcAudio(true);
    this.acRepairPanel();
  }

  acLock() {
    if (this.acAlignment !== 0) return;
    this.acStage = 2;
    this.acPointTone({
      frequency: 286,
      endFrequency: 214,
      duration: 0.08,
      volume: 0.06,
      wave: 'square',
    });
    this.acPointTone({
      frequency: 91,
      endFrequency: 74,
      duration: 0.14,
      volume: 0.05,
      wave: 'triangle',
      when: 0.035,
    });
    this.syncAcAudio(true);
    this.acRepairPanel();
  }

  finishAcRepair() {
    this.acPointTone({
      frequency: 68,
      endFrequency: 112,
      duration: 0.62,
      volume: 0.07,
      wave: 'triangle',
    });
    this.acPointTone({
      frequency: 136,
      endFrequency: 224,
      duration: 0.52,
      volume: 0.028,
      wave: 'sine',
      when: 0.08,
    });
    this.data().roofAcFixed = true;
    this.data().roofAcRepairs = Math.min(999, (this.data().roofAcRepairs ?? 0) + 1);
    this.save();
    this.syncAcAudio(true);
    this.ui.panel(
      'AC FIXED',
      'The test cycle settles into a low, even hum. For once, kicking something was not the final repair method.',
    );
  }

  skylinePanel() {
    const data = this.data();
    if (data.gentrificationTransformed) {
      this.ui.panel(
        'THE NEW SKYLINE',
        'The old silhouettes are gone. Condos, cafés, yoga studios, co-working spaces and other immaculate signs of neighbourhood turnover fill the horizon.',
      );
      return;
    }
    if (!data.gentrificationKey) {
      this.ui.panel(
        'A VERY SPECIFIC LOCK',
        'A gold keyhole is mounted at the roof edge. Its outline looks suspiciously like a condominium tower.',
      );
      return;
    }
    this.ui.panel(
      'GENTRIFICATION LOCK',
      'The tiny condominium key fits perfectly. Of course it does.',
      [['Turn the key', () => this.transformSkyline()]],
    );
  }

  transformSkyline() {
    this.data().gentrificationTransformed = true;
    this.game.scenes?.get?.('roof')?.roof?.startGentrification?.();
    this.save();
    this.ui.panel(
      'NEIGHBOURHOOD UPDATE',
      'The distant old buildings tip, slide and tumble out of the horizon. Taller condo towers rise into their places, followed by glowing CAFÉ, YOGA, CO-WORK and DOG SPA signs. The roof stays where it is. Everything around it changes.',
    );
  }

  storyPanel(founderId) {
    const stories = ROOF_STORIES[founderId];
    if (!stories) return false;
    const heard = new Set(this.data().roofStoriesHeard ?? []);
    const name = founderId === 'jace' ? 'JACE' : founderId === 'dave' ? 'DAVE' : 'JAMES';
    this.ui.panel(
      `${name} · ROOF STORIES`,
      'The conversation drifts through different Breakglass eras. These are game-memory stories rather than verbatim quotations.',
      stories.map((story, index) => [
        `${heard.has(story.id) ? '✓ ' : ''}${index + 1}. ${story.title}`,
        () => this.hearStory(founderId, story),
      ]),
    );
    return true;
  }

  hearStory(founderId, story) {
    const heard = new Set(this.data().roofStoriesHeard ?? []);
    heard.add(story.id);
    this.data().roofStoriesHeard = [...heard];
    this.save();
    const stories = ROOF_STORIES[founderId] ?? [];
    const remaining = stories.filter((item) => !heard.has(item.id));
    this.ui.panel(`${founderId.toUpperCase()} · ${story.title.toUpperCase()}`, story.text, [
      ...(remaining.length
        ? [['Tell me another one', () => this.hearStory(founderId, remaining[0])]]
        : []),
      ['Back to the roof stories', () => this.storyPanel(founderId)],
    ]);
  }

  escapePanel() {
    if (this.game.freightElevator?.open) return this.game.freightElevator.open();
    const missing = endgameChecklist(this.data(), this.context()).filter((item) => !item.complete);
    this.ui.panel(
      'SEALED FREIGHT HATCH',
      missing.length
        ? `The old roof freight hatch is still locked. Remaining: ${missing.map((item) => item.label).join(' · ')}.`
        : 'The hatch has released, but the old freight controls have not initialized yet.',
    );
    return true;
  }

  dispose() {
    this.game.spatialAudio?.stopPointMachine?.('roof-ac', 0);
    this.acAudioSignature = '';
  }

  handle(target) {
    if (target?.action === 'gentrificationKey') {
      this.collectGentrificationKey();
      return true;
    }
    if (target?.action === 'roofThrow') {
      this.throwItem(target);
      return true;
    }
    if (target?.action === 'roofAc') {
      this.acPanel();
      return true;
    }
    if (target?.action === 'gentrificationTrigger') {
      this.skylinePanel();
      return true;
    }
    if (target?.action === 'roofEscape') {
      this.escapePanel();
      return true;
    }
    if (
      target?.action === 'dialogue' &&
      this.game.sceneManager.current?.definition?.id === 'roof' &&
      ['jace', 'dave', 'james'].includes(target.npcId ?? target.id)
    ) {
      this.storyPanel(target.npcId ?? target.id);
      return true;
    }
    return false;
  }
}

export function installRoofEndgameSystem(game, ui) {
  if (!game || game._roofEndgameInstalled) return game?.roofEndgame ?? null;
  game._roofEndgameInstalled = true;
  const system = new RoofEndgameSystem(game, ui);
  game.roofEndgame = system;

  const baseDispatch = game.interactions.dispatch.bind(game.interactions);
  game.interactions.dispatch = (target) => {
    if (system.handle(target)) return;
    baseDispatch(target);
  };

  let lastSync = 0;
  const baseUpdate = game.update.bind(game);
  game.update = (now, movementOverride = null) => {
    const result = baseUpdate(now, movementOverride);
    system.syncAcAudio();
    if (now - lastSync > 500) {
      system.syncVisuals();
      lastSync = now;
    }
    return result;
  };

  return system;
}
