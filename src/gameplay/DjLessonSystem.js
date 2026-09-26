import { DJ_TRACKS } from '../dj/DjMixer.js';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const trackById = (id) => DJ_TRACKS.find((track) => track.id === id) ?? DJ_TRACKS[0];
const modulo = (value, divisor) => ((value % divisor) + divisor) % divisor;

export const DJ_LESSON_STAGES = [
  'one-deck',
  'second-deck',
  'tempo',
  'phase',
  'bass',
  'selection',
  'floor',
];

function crossGain(crossfader, deckId) {
  const x = (clamp(crossfader, -1, 1) + 1) / 2;
  return deckId === 'A' ? Math.cos(x * Math.PI * 0.5) : Math.sin(x * Math.PI * 0.5);
}

function beatPhase(mixer, deck) {
  if (!deck?.playing) return 0;
  if (typeof mixer.phase === 'function') return modulo(mixer.phase(deck), 1);
  const track = trackById(deck.trackId);
  const position = mixer.deckPosition?.(deck.id) ?? 0;
  const beat = 60 / Math.max(1, track.bpm);
  return modulo(position / beat, 1);
}

function phrasePosition(mixer, deck) {
  if (!deck?.playing) return 0;
  const track = trackById(deck.trackId);
  const position = mixer.deckPosition?.(deck.id) ?? 0;
  const sourceBeat = 60 / Math.max(1, track.bpm);
  const offset = Number.isFinite(deck.beatOffset) ? deck.beatOffset : 0;
  return modulo((position - offset) / sourceBeat, 16);
}

/**
 * Adds DJ-specific diagnostics without replacing the existing audio engine. The result is used by
 * the normal crowd system, so the same mistakes taught in the lesson remain meaningful afterward.
 */
export function analyzeDjMix(mixer, baseMetrics = {}) {
  const a = mixer.decks?.A;
  const b = mixer.decks?.B;
  const activeA = !!a?.playing;
  const activeB = !!b?.playing;
  const activeCount = Number(activeA) + Number(activeB);
  const gainA = activeA ? crossGain(mixer.crossfader ?? -1, 'A') * clamp(a.level) : 0;
  const gainB = activeB ? crossGain(mixer.crossfader ?? -1, 'B') * clamp(b.level) : 0;
  const audibleTotal = gainA + gainB;
  const overlap = activeCount === 2 ? clamp(Math.min(gainA, gainB) * 2.15) : 0;

  let beatAlignment = 1;
  let phraseAlignment = 1;
  let tempoMatch = 1;
  let bpmDistance = 0;
  if (activeA && activeB) {
    const phaseA = beatPhase(mixer, a);
    const phaseB = beatPhase(mixer, b);
    const beatDistance = Math.min(Math.abs(phaseA - phaseB), 1 - Math.abs(phaseA - phaseB));
    beatAlignment = clamp(1 - beatDistance * 2.7);

    const phraseA = phrasePosition(mixer, a);
    const phraseB = phrasePosition(mixer, b);
    const phraseDistance = Math.min(Math.abs(phraseA - phraseB), 16 - Math.abs(phraseA - phraseB));
    phraseAlignment = clamp(1 - phraseDistance / 8);

    bpmDistance = Math.abs((a.bpm ?? 0) - (b.bpm ?? 0));
    tempoMatch = clamp(1 - bpmDistance / 4);
  }

  const lowA = a ? clamp((Number(a.low) + 1) / 1, 0, 1) : 0;
  const lowB = b ? clamp((Number(b.low) + 1) / 1, 0, 1) : 0;
  const bassClash = activeCount === 2 ? overlap * Math.min(lowA, lowB) : 0;
  const overload = activeCount === 2 ? clamp((audibleTotal - 1.05) / 0.48) : 0;
  const deadAir = activeCount > 0 && audibleTotal < 0.075;

  const timingFailure = activeCount === 2 ? (1 - beatAlignment) * overlap : 0;
  const tempoFailure = activeCount === 2 ? (1 - tempoMatch) * overlap : 0;
  const failureLoad =
    timingFailure * 0.56 + tempoFailure * 0.34 + bassClash * 0.36 + overload * 0.24;
  const trainwreck = deadAir ? 1 : clamp((failureLoad - 0.24) / 0.72);

  const originalQuality = clamp(baseMetrics.mixQuality ?? (activeCount ? 0.82 : 0));
  const mixQuality = deadAir
    ? 0.03
    : clamp(
        originalQuality -
          timingFailure * 0.24 -
          tempoFailure * 0.18 -
          bassClash * 0.2 -
          overload * 0.16,
      );
  const energy = clamp(baseMetrics.energy ?? 0);
  const vibe = deadAir
    ? 0.02
    : clamp(energy * (0.3 + mixQuality * 0.76) * (1 - trainwreck * 0.78) * (1 - bassClash * 0.14));

  let floorState = 'quiet';
  if (deadAir || trainwreck >= 0.72) floorState = 'trainwreck';
  else if (trainwreck >= 0.34 || mixQuality < 0.48) floorState = 'slipping';
  else if (vibe >= 0.76 && mixQuality >= 0.78) floorState = 'filling';
  else if (activeCount) floorState = 'holding';

  return {
    ...baseMetrics,
    playing: activeCount > 0,
    energy,
    vibe,
    mixQuality,
    beatAlignment,
    phraseAlignment,
    tempoMatch,
    bpmDistance,
    overlap,
    bassClash,
    overload,
    deadAir,
    trainwreck,
    floorState,
  };
}

function coachCopy(stage, metrics) {
  const phase = Math.round((metrics.beatAlignment ?? 0) * 100);
  const vibe = Math.round((metrics.vibe ?? 0) * 100);
  const wreck = Math.round((metrics.trainwreck ?? 0) * 100);
  switch (stage) {
    case 'one-deck':
      return {
        title: '1 · START WITH ONE RECORD',
        text: 'Deck A is your room. Start it first. A DJ needs to hear what is actually happening before adding anything else.',
        tip: 'Play Deck A. Leave Deck B stopped for now.',
      };
    case 'second-deck':
      return {
        title: '2 · PREPARE THE NEXT RECORD',
        text: 'Start Deck B while the crossfader is still on A. In a real booth this is the idea of cueing: prepare the next record without dumping it onto the floor.',
        tip: 'Play Deck B. The crowd should still mainly hear A.',
      };
    case 'tempo':
      return {
        title: '3 · MATCH THE TEMPO',
        text: 'Two records can only sit together comfortably if their tempos agree. Match B to A manually or use SYNC, then notice what the BPM controls are actually doing.',
        tip: `Tempo difference: ${(metrics.bpmDistance ?? 0).toFixed(1)} BPM. Get it under 0.3 BPM.`,
      };
    case 'phase':
      return {
        title: '4 · PUT THE BEATS IN THE SAME PLACE',
        text: 'Matching BPM is not the same as matching beats. Use the phase meter and JOG controls. Near zero means the kicks are landing together. Think in phrases too: good DJs usually make changes at musical boundaries, not random moments.',
        tip: `Beat alignment: ${phase}%. Get above 90%.`,
      };
    case 'bass':
      return {
        title: '5 · MAKE SPACE FOR THE BLEND',
        text: 'Now bring the crossfader toward the middle. Two full low ends fighting each other gets muddy fast. Cut the LOW on one deck before exposing both records.',
        tip: `Bass clash: ${Math.round((metrics.bassClash ?? 0) * 100)}%. Expose both decks, but keep clash below 18%.`,
      };
    case 'selection':
      return {
        title: '6 · READ THE ROOM, NOT JUST THE WAVEFORM',
        text: 'Track choice matters as much as technique. The room is warm, not at peak. Change one deck to a record that holds or nudges the energy instead of automatically choosing the hardest option.',
        tip: 'Choose a different track with moderate energy. The lesson will react to the choice.',
      };
    case 'floor':
      return {
        title: '7 · HOLD THE FLOOR',
        text: 'Now all the pieces are live. A clean transition should sound coherent and keep people moving. A trainwreck is recoverable, but the room will leave faster than it returns.',
        tip: `Floor ${vibe}% · trainwreck risk ${wreck}%. Get floor ≥ 65%, mix ≥ 70%, wreck < 20%, then check the floor.`,
      };
    default:
      return { title: 'DJ LESSON', text: '', tip: '' };
  }
}

function ensureStyle(document) {
  if (!document || document.getElementById('dj-lesson-style')) return;
  const style = document.createElement('style');
  style.id = 'dj-lesson-style';
  style.textContent = `
    .dj-lesson-coach { border: 1px solid rgba(126,255,168,.45); padding: 12px; margin: 10px 0; background: rgba(5,18,13,.86); border-radius: 8px; }
    .dj-lesson-coach strong { display:block; margin-bottom:6px; letter-spacing:.04em; }
    .dj-lesson-coach p { margin: 0 0 6px; line-height:1.35; }
    .dj-lesson-coach small { display:block; opacity:.82; margin-bottom:8px; }
    .dj-lesson-coach .row { display:flex; gap:6px; flex-wrap:wrap; }
    .dj-floor-state { font-weight:700; text-transform:uppercase; }
    .dj-floor-state.trainwreck { color:#ff8d8d; }
    .dj-floor-state.filling { color:#9dffb6; }
  `;
  document.head?.appendChild(style);
}

class DjLessonController {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.mixer = game.dj;
    this.mode = null;
    this.stageIndex = 0;
    this.currentTarget = null;
    this.baseDispatch = null;
    this.feedback = '';
    this.selectionStart = null;
    this.storageKey = `${game.state?.saveKey ?? 'breakglass.after-hours.v1'}.dj-lesson.v1`;
    this.completed = this.loadCompleted();
  }

  loadCompleted() {
    try {
      return this.game.state?.storage?.getItem?.(this.storageKey) === 'complete';
    } catch {
      return false;
    }
  }

  saveCompleted() {
    this.completed = true;
    this.game.state.data.djLessonCompleted = true;
    try {
      this.game.state?.storage?.setItem?.(this.storageKey, 'complete');
    } catch {
      // The main GameState already surfaces storage warnings; the lesson can still complete locally.
    }
    this.game.save?.();
  }

  resetMixerForLesson() {
    this.mixer.stop();
    this.mixer.load('A', 'in-flux-just-be');
    this.mixer.load('B', 'got-you-dancin');
    this.mixer.setBpm('A', 126);
    this.mixer.setBpm('B', 130);
    this.mixer.setLevel('A', 0.82);
    this.mixer.setLevel('B', 0.82);
    this.mixer.setEq('A', 'low', 0);
    this.mixer.setEq('B', 'low', 0);
    this.mixer.setEq('A', 'high', 0);
    this.mixer.setEq('B', 'high', 0);
    this.mixer.setCrossfader(-1);
  }

  handleBooth(target, baseDispatch) {
    this.currentTarget = target;
    this.baseDispatch = baseDispatch;
    if (this.completed) return false;
    this.showIntro();
    return true;
  }

  showIntro() {
    this.mode = null;
    this.ui.panel(
      'DJ BOOTH · FIRST SET',
      'The booth can teach you how DJing actually works. The crowd reacts to tempo, beat alignment, low-end clashes, levels and track energy. Passing the lesson unlocks the booth as a normal instrument on future visits.',
      [
        ['Learn the booth', () => this.startLesson()],
        ['I already DJ · proficiency check', () => this.startProficiency()],
        ['Free mix for now', () => this.openRegularBooth()],
      ],
    );
  }

  startLesson() {
    this.mode = 'lesson';
    this.stageIndex = 0;
    this.feedback = '';
    this.selectionStart = null;
    this.resetMixerForLesson();
    this.openRegularBooth();
  }

  startProficiency() {
    this.mode = 'proficiency';
    this.feedback = '';
    this.openRegularBooth();
  }

  openRegularBooth() {
    if (typeof this.baseDispatch === 'function' && this.currentTarget) {
      this.baseDispatch(this.currentTarget);
    }
    this.decorate();
  }

  onMixerChange() {
    if (this.mode !== 'lesson') {
      this.decorate();
      return;
    }
    const stage = DJ_LESSON_STAGES[this.stageIndex];
    const snapshot = this.mixer.snapshot();
    const metrics = snapshot.metrics ?? {};
    const a = snapshot.decks?.A;
    const b = snapshot.decks?.B;
    let pass = false;

    if (stage === 'one-deck') pass = !!a?.playing && !b?.playing;
    else if (stage === 'second-deck')
      pass = !!a?.playing && !!b?.playing && this.mixer.crossfader < -0.45;
    else if (stage === 'tempo')
      pass = !!a?.playing && !!b?.playing && (metrics.bpmDistance ?? 99) <= 0.3;
    else if (stage === 'phase') pass = (metrics.beatAlignment ?? 0) >= 0.9;
    else if (stage === 'bass') {
      pass =
        (metrics.overlap ?? 0) >= 0.28 &&
        (metrics.bassClash ?? 1) <= 0.18 &&
        (a?.low <= -0.55 || b?.low <= -0.55);
    } else if (stage === 'selection') {
      this.selectionStart ??= { A: a?.trackId, B: b?.trackId };
      const changedDeck =
        a?.trackId !== this.selectionStart.A ? a : b?.trackId !== this.selectionStart.B ? b : null;
      if (changedDeck) {
        const energy = trackById(changedDeck.trackId).energy;
        if (energy >= 0.64 && energy <= 0.8) {
          this.feedback = `Good choice: ${trackById(changedDeck.trackId).label} changes the room without jumping straight to peak.`;
          pass = true;
        } else if (energy > 0.8) {
          this.feedback =
            'That is a big peak-energy jump. It can be right later, but for this warm floor choose something a little less aggressive.';
        } else {
          this.feedback =
            'That drops the energy sharply. Try something that holds the groove or nudges it upward.';
        }
      }
    }

    if (pass && stage !== 'floor') {
      this.stageIndex = Math.min(DJ_LESSON_STAGES.length - 1, this.stageIndex + 1);
      if (DJ_LESSON_STAGES[this.stageIndex] === 'selection') {
        const next = this.mixer.snapshot().decks;
        this.selectionStart = { A: next.A?.trackId, B: next.B?.trackId };
      }
      this.feedback ||= 'Got it. Keep going.';
    }
    this.decorate();
  }

  checkFloor() {
    const metrics = this.mixer.snapshot().metrics ?? {};
    const pass =
      (metrics.vibe ?? 0) >= 0.65 &&
      (metrics.mixQuality ?? 0) >= 0.7 &&
      (metrics.trainwreck ?? 1) < 0.2;
    if (!pass) {
      const problems = [];
      if ((metrics.vibe ?? 0) < 0.65) problems.push('the floor needs more coherent energy');
      if ((metrics.mixQuality ?? 0) < 0.7) problems.push('the blend is still rough');
      if ((metrics.trainwreck ?? 0) >= 0.2) problems.push('the trainwreck risk is still audible');
      this.feedback = `Not yet: ${problems.join('; ')}. Recover the mix and try again.`;
      this.decorate();
      return false;
    }
    this.completeLesson('lesson');
    return true;
  }

  checkProficiency() {
    const snapshot = this.mixer.snapshot();
    const metrics = snapshot.metrics ?? {};
    const twoDecks = snapshot.decks?.A?.playing && snapshot.decks?.B?.playing;
    const oneBassCut = snapshot.decks?.A?.low <= -0.4 || snapshot.decks?.B?.low <= -0.4;
    const pass =
      twoDecks &&
      (metrics.bpmDistance ?? 99) <= 0.5 &&
      (metrics.beatAlignment ?? 0) >= 0.82 &&
      (metrics.mixQuality ?? 0) >= 0.68 &&
      (metrics.vibe ?? 0) >= 0.62 &&
      (metrics.trainwreck ?? 1) < 0.24 &&
      ((metrics.overlap ?? 0) < 0.22 || oneBassCut);
    if (pass) {
      this.completeLesson('proficiency');
      return true;
    }
    this.feedback =
      'Not quite. Make one clean two-deck transition: match tempo, line up the phase, manage the low end and keep the floor above 62%.';
    this.decorate();
    return false;
  }

  completeLesson(route) {
    this.saveCompleted();
    this.mode = null;
    this.ui.panel(
      route === 'proficiency' ? 'BOOTH UNLOCKED' : 'DJ LESSON PASSED',
      route === 'proficiency'
        ? 'You clearly know your way around a booth. Normal DJ mode is unlocked.'
        : 'You kept the floor together. From now on the booth opens directly into normal DJ mode. The same rules still apply: bad timing, clashing low end, overload and dead-air-style cuts can clear the room, and you can recover by fixing the mix.',
      [['Back to the booth', () => this.openRegularBooth()]],
    );
  }

  decorate() {
    if (!this.mode || !this.ui.buttons || !this.ui.document) return;
    this.ui.buttons.querySelector?.('.dj-lesson-coach')?.remove();
    const metrics = this.mixer.snapshot().metrics ?? {};
    const host = this.ui.document.createElement('section');
    host.className = 'dj-lesson-coach';
    const floorClass = metrics.floorState ?? 'quiet';

    if (this.mode === 'proficiency') {
      const title = this.ui.document.createElement('strong');
      title.textContent = 'EXPERIENCED DJ · PROFICIENCY CHECK';
      const copy = this.ui.document.createElement('p');
      copy.textContent =
        'Make one clean transition using the real booth. Two decks, matched tempo, phase under control, sensible low end and a floor that stays alive.';
      const readout = this.ui.document.createElement('small');
      readout.innerHTML = `<span class="dj-floor-state ${floorClass}">${floorClass}</span> · floor ${Math.round((metrics.vibe ?? 0) * 100)}% · mix ${Math.round((metrics.mixQuality ?? 0) * 100)}% · wreck ${Math.round((metrics.trainwreck ?? 0) * 100)}%`;
      host.append(title, copy, readout);
      if (this.feedback) {
        const feedback = this.ui.document.createElement('p');
        feedback.textContent = this.feedback;
        host.appendChild(feedback);
      }
      const row = this.ui.document.createElement('div');
      row.className = 'row';
      const prove = this.ui.document.createElement('button');
      prove.textContent = 'Check transition';
      prove.onclick = () => this.checkProficiency();
      const learn = this.ui.document.createElement('button');
      learn.textContent = 'Show me the lesson';
      learn.onclick = () => this.startLesson();
      const free = this.ui.document.createElement('button');
      free.textContent = 'Free mix for now';
      free.onclick = () => {
        this.mode = null;
        this.openRegularBooth();
      };
      row.append(prove, learn, free);
      host.appendChild(row);
    } else {
      const stage = DJ_LESSON_STAGES[this.stageIndex];
      const copy = coachCopy(stage, metrics);
      const title = this.ui.document.createElement('strong');
      title.textContent = copy.title;
      const body = this.ui.document.createElement('p');
      body.textContent = copy.text;
      const tip = this.ui.document.createElement('small');
      tip.textContent = copy.tip;
      const readout = this.ui.document.createElement('small');
      readout.innerHTML = `<span class="dj-floor-state ${floorClass}">${floorClass}</span> · floor ${Math.round((metrics.vibe ?? 0) * 100)}% · mix ${Math.round((metrics.mixQuality ?? 0) * 100)}% · wreck ${Math.round((metrics.trainwreck ?? 0) * 100)}%`;
      host.append(title, body, tip, readout);
      if (this.feedback) {
        const feedback = this.ui.document.createElement('p');
        feedback.textContent = this.feedback;
        host.appendChild(feedback);
        this.feedback = '';
      }
      const row = this.ui.document.createElement('div');
      row.className = 'row';
      if (stage === 'floor') {
        const check = this.ui.document.createElement('button');
        check.textContent = 'Check the floor';
        check.onclick = () => this.checkFloor();
        row.appendChild(check);
      }
      const exit = this.ui.document.createElement('button');
      exit.textContent = 'Free mix for now';
      exit.onclick = () => {
        this.mode = null;
        this.openRegularBooth();
      };
      row.appendChild(exit);
      host.appendChild(row);
    }
    this.ui.buttons.prepend(host);
  }
}

export function installDjLessonSystem(game, ui) {
  const mixer = game?.dj;
  if (!mixer || mixer._djLessonInstalled) return null;
  mixer._djLessonInstalled = true;
  ensureStyle(ui?.document);

  const baseMetrics = mixer.metrics.bind(mixer);
  mixer.metrics = () => analyzeDjMix(mixer, baseMetrics());

  const controller = new DjLessonController(game, ui);
  game.djLesson = controller;

  const baseDjMixer = ui.djMixer.bind(ui);
  ui.djMixer = (activeMixer, tracks, options = {}) => {
    const callerChange = options.onChange ?? (() => {});
    const result = baseDjMixer(activeMixer, tracks, {
      ...options,
      onChange: (...args) => {
        callerChange(...args);
        controller.onMixerChange();
      },
    });
    controller.decorate();
    return result;
  };

  const baseDispatch = game.interactions.dispatch;
  game.interactions.dispatch = (target) => {
    if (target?.action === 'dj' && controller.handleBooth(target, baseDispatch)) return;
    return baseDispatch(target);
  };

  return controller;
}
