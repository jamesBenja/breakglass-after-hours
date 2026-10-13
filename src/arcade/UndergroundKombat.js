import { commandFight, createFightState, stepFight } from './UndergroundFight.js';
import { KOMBAT_FIGHTERS, chooseCpuFighter, fighterById, specialVisualForHit } from './fighters.js';

const KEYMAP = {
  KeyA: ['player', 'left'],
  ArrowLeft: ['player', 'left'],
  KeyD: ['player', 'right'],
  ArrowRight: ['player', 'right'],
  KeyW: ['player', 'jump'],
  ArrowUp: ['player', 'jump'],
  KeyJ: ['player', 'light'],
  KeyK: ['player', 'heavy'],
  KeyL: ['player', 'special'],
  KeyI: ['player', 'block'],
  ArrowDown: ['player', 'block'],
};

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.roundRect?.(x, y, width, height, r);
  if (!ctx.roundRect) ctx.rect(x, y, width, height);
}

function button(document, label, className = '') {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.className = className;
  return element;
}

export class UndergroundKombat {
  constructor(document, audio, { onActive = () => {}, onWin = () => {} } = {}) {
    this.document = document;
    this.audio = audio;
    this.onActive = onActive;
    this.onWin = onWin;
    this.active = false;
    this.state = null;
    this.playerFighter = null;
    this.opponentFighter = null;
    this.lastTime = 0;
    this.raf = null;
    this.overlay = null;
    this.canvas = null;
    this.ctx = null;
    this.status = null;
    this.controls = [];
    this.selection = null;
    this.rosterButton = null;
    this.vanish = null;
    this.onKeyDown = (event) => this.key(event, true);
    this.onKeyUp = (event) => this.key(event, false);
    this.resize = () => this.fitCanvas();
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.onActive(true);
    this.mount();
    this.audio?.init?.().catch?.(() => {});
    this.showRoster();
  }

  beginFight(playerId) {
    this.playerFighter = fighterById(playerId);
    this.opponentFighter = chooseCpuFighter(this.playerFighter.id);
    this.state = createFightState({ mode: 'cpu', roundTime: 60 });
    this.vanish = null;
    this.selection.hidden = true;
    this.canvas.hidden = false;
    this.status.hidden = false;
    this.controlsElement.hidden = false;
    this.rosterButton.hidden = false;
    this.updateControlLabels();
    this.status.textContent = `${this.playerFighter.name} vs ${this.opponentFighter.name} · J / K / L attack · I block`;
    this.lastTime = performance.now();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame((now) => this.frame(now));
    this.fitCanvas();
  }

  rematch() {
    if (!this.playerFighter || !this.opponentFighter) return this.showRoster();
    this.state = createFightState({ mode: 'cpu', roundTime: 60 });
    this.vanish = null;
    this.lastTime = performance.now();
    this.status.textContent = `${this.playerFighter.name} vs ${this.opponentFighter.name} · FIGHT`;
    if (!this.raf) this.raf = requestAnimationFrame((now) => this.frame(now));
  }

  showRoster() {
    if (!this.active) return;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.state = null;
    this.vanish = null;
    this.canvas.hidden = true;
    this.status.hidden = true;
    this.controlsElement.hidden = true;
    this.rosterButton.hidden = true;
    this.selection.hidden = false;
    this.renderRoster();
  }

  renderRoster() {
    this.selection.replaceChildren();
    const intro = this.document.createElement('div');
    intro.className = 'kombat-roster-intro';
    intro.innerHTML =
      '<strong>CHOOSE YOUR FIGHTER</strong><span>Breakglass scene archetypes · one round · sixty seconds</span>';
    const roster = this.document.createElement('div');
    roster.className = 'kombat-roster';
    for (const fighter of KOMBAT_FIGHTERS) {
      const card = button(this.document, '', 'kombat-fighter-card');
      card.dataset.fighter = fighter.id;
      const name = this.document.createElement('strong');
      name.textContent = fighter.name;
      const tagline = this.document.createElement('span');
      tagline.textContent = fighter.tagline;
      const moves = this.document.createElement('small');
      moves.textContent = `${fighter.moves.light} · ${fighter.moves.heavy} · ${fighter.moves.special}`;
      const swatch = this.document.createElement('i');
      swatch.style.background = `linear-gradient(135deg, ${fighter.palette.join(', ')})`;
      card.append(swatch, name, tagline, moves);
      card.onclick = () => this.beginFight(fighter.id);
      roster.appendChild(card);
    }
    this.selection.append(intro, roster);
  }

  mount() {
    const overlay = this.document.createElement('div');
    overlay.className = 'underground-kombat';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Breakglass Underground Kombat arcade game');

    const top = this.document.createElement('div');
    top.className = 'kombat-topbar';
    const brand = this.document.createElement('div');
    brand.innerHTML =
      '<strong>BREAKGLASS UNDERGROUND KOMBAT</strong><span>scene wars · cabinet edition</span>';
    const topActions = this.document.createElement('div');
    topActions.className = 'kombat-top-actions';
    const rosterButton = button(this.document, 'ROSTER', 'kombat-roster-button');
    rosterButton.onclick = () => this.showRoster();
    const exit = button(this.document, 'EXIT CABINET', 'kombat-exit');
    exit.onclick = () => this.stop();
    topActions.append(rosterButton, exit);
    top.append(brand, topActions);

    const stage = this.document.createElement('div');
    stage.className = 'kombat-stage';
    const canvas = this.document.createElement('canvas');
    canvas.className = 'kombat-canvas';
    canvas.setAttribute('aria-label', 'Underground music scene fighting game');
    const selection = this.document.createElement('div');
    selection.className = 'kombat-selection';
    stage.append(canvas, selection);

    const status = this.document.createElement('div');
    status.className = 'kombat-status';

    const controls = this.document.createElement('div');
    controls.className = 'kombat-controls';
    for (const [label, action, hold] of [
      ['◀', 'left', true],
      ['▶', 'right', true],
      ['JUMP', 'jump', false],
      ['LIGHT', 'light', false],
      ['HEAVY', 'heavy', false],
      ['SPECIAL', 'special', false],
      ['BLOCK', 'block', true],
    ]) {
      const control = button(this.document, label);
      control.dataset.action = action;
      const down = (event) => {
        event.preventDefault();
        if (!this.state) return;
        control.classList.add('pressed');
        commandFight(this.state, 'player', action, true);
        this.sfx('input', action);
      };
      const up = (event) => {
        event.preventDefault();
        control.classList.remove('pressed');
        if (hold && this.state) commandFight(this.state, 'player', action, false);
      };
      control.addEventListener('pointerdown', down);
      control.addEventListener('pointerup', up);
      control.addEventListener('pointercancel', up);
      control.addEventListener('pointerleave', (event) => {
        if (hold && control.classList.contains('pressed')) up(event);
      });
      controls.appendChild(control);
      this.controls.push({ button: control, down, up, action });
    }

    overlay.append(top, stage, status, controls);
    this.document.body.appendChild(overlay);
    this.overlay = overlay;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.status = status;
    this.selection = selection;
    this.controlsElement = controls;
    this.rosterButton = rosterButton;
    window.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('keyup', this.onKeyUp, true);
    window.addEventListener('resize', this.resize);
    this.fitCanvas();
  }

  updateControlLabels() {
    if (!this.playerFighter) return;
    for (const control of this.controls) {
      if (control.action === 'light') control.button.textContent = this.playerFighter.buttons.light;
      else if (control.action === 'heavy')
        control.button.textContent = this.playerFighter.buttons.heavy;
      else if (control.action === 'special')
        control.button.textContent = this.playerFighter.buttons.special;
    }
  }

  key(event, pressed) {
    if (!this.active) return;
    if (event.code === 'Escape' && pressed) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.stop();
      return;
    }
    if (!this.state) return;
    if (event.code === 'Enter' && pressed && this.state.status === 'finished') {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.rematch();
      return;
    }
    const mapped = KEYMAP[event.code];
    if (!mapped) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    commandFight(this.state, mapped[0], mapped[1], pressed);
    if (pressed && !['left', 'right', 'block'].includes(mapped[1])) this.sfx('input', mapped[1]);
  }

  fitCanvas() {
    if (!this.canvas || this.canvas.hidden) return;
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
    const width = Math.max(320, Math.floor(rect.width * ratio));
    const height = Math.max(240, Math.floor(rect.height * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  frame(now) {
    if (!this.active || !this.state) {
      this.raf = null;
      return;
    }
    const dt = Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    const events = stepFight(this.state, dt);
    for (const event of events) this.handleEvent(event, now);
    this.draw(now);
    this.raf = requestAnimationFrame((time) => this.frame(time));
  }

  fighterForSide(side) {
    return side === 'player' ? this.playerFighter : this.opponentFighter;
  }

  handleEvent(event, now = performance.now()) {
    if (event.type === 'hit') {
      const attacker = this.fighterForSide(event.side);
      this.sfx('hit', event.attack, event.guarded);
      const move = attacker?.moves?.[event.attack] ?? event.attack.toUpperCase();
      this.status.textContent = `${attacker?.name ?? 'FIGHTER'}: ${move}${event.guarded ? ' · BLOCKED' : ''}`;
      const special = specialVisualForHit(attacker, event, now);
      if (special) this.vanish = special;
      return;
    }
    if (event.type === 'round-end') {
      this.sfx('finish', event.winner);
      if (event.winner === 'player') {
        this.status.textContent = `${this.playerFighter.name} WINS · ENTER / REMATCH`;
        this.onWin();
      } else if (event.winner === 'draw') {
        this.status.textContent = 'DOUBLE BOOKING · DRAW · ENTER / REMATCH';
      } else {
        this.status.textContent = `${this.opponentFighter.name} WINS · ENTER / REMATCH`;
      }
    }
  }

  sfx(kind, detail, guarded = false) {
    if (!this.audio?.context) return;
    if (kind === 'hit') {
      this.audio.kick?.();
      this.audio.tone?.(
        guarded ? 880 : detail === 'special' ? 52 : 110,
        0.12,
        'sawtooth',
        guarded ? 0.035 : 0.07,
      );
    } else if (kind === 'finish') {
      const root = detail === 'player' ? 110 : 73.4;
      [1, 1.25, 1.5, 2].forEach((ratio, index) =>
        this.audio.tone?.(root * ratio, 0.28, 'square', 0.045, index * 0.07),
      );
    } else if (detail === 'special') {
      this.audio.tone?.(65.4, 0.18, 'sawtooth', 0.05);
    } else if (detail === 'heavy') {
      this.audio.tone?.(98, 0.1, 'square', 0.035);
    }
  }

  drawSpeaker(ctx, x, y, scale = 1) {
    ctx.fillStyle = '#111218';
    ctx.fillRect(x, y, 70 * scale, 142 * scale);
    ctx.strokeStyle = '#41414b';
    ctx.lineWidth = 2 * scale;
    ctx.strokeRect(x, y, 70 * scale, 142 * scale);
    for (const offset of [42, 103]) {
      ctx.beginPath();
      ctx.arc(
        x + 35 * scale,
        y + offset * scale,
        (offset === 42 ? 22 : 28) * scale,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = '#242631';
      ctx.fill();
      ctx.strokeStyle = '#666a78';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 35 * scale, y + offset * scale, 6 * scale, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0d';
      ctx.fill();
    }
  }

  drawProp(ctx, fighter, reach, y, attacking) {
    const style = fighter.style;
    if (style === 'promoter') {
      const count = attacking === 'special' ? 3 : 1;
      for (let i = 0; i < count; i++) {
        ctx.save();
        ctx.translate(reach + 7 + i * 13, y - i * 8);
        ctx.rotate(-0.18 + i * 0.13);
        ctx.fillStyle = '#f1eee3';
        ctx.fillRect(-2, -12, 24, 17);
        ctx.strokeStyle = '#8f314b';
        ctx.strokeRect(-2, -12, 24, 17);
        ctx.fillStyle = '#242124';
        ctx.font = '700 6px system-ui';
        ctx.fillText('BOOKING', 1, -2);
        ctx.restore();
      }
      return;
    }
    if (style === 'vinyl') {
      ctx.beginPath();
      ctx.arc(reach + 10, y, attacking === 'special' ? 23 : 15, 0, Math.PI * 2);
      ctx.fillStyle = '#111216';
      ctx.fill();
      ctx.strokeStyle = fighter.palette[1];
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(reach + 10, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#eee';
      ctx.fill();
      return;
    }
    if (style === 'phone') {
      ctx.fillStyle = '#11151b';
      roundedRect(ctx, reach + 2, y - 17, 22, 34, 4);
      ctx.fill();
      ctx.fillStyle = attacking ? '#5ef2db' : '#ff5ca8';
      ctx.fillRect(reach + 6, y - 12, 14, 23);
      return;
    }
    if (style === 'producer') {
      ctx.fillStyle = '#aeb6be';
      ctx.fillRect(reach + 1, y - 14, 32, 20);
      ctx.fillStyle = '#20242a';
      ctx.fillRect(reach + 5, y - 10, 24, 12);
      return;
    }
    if (style === 'lighting') {
      ctx.strokeStyle = attacking ? '#f4e75f' : '#5df0ff';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(reach, y);
      ctx.lineTo(reach + (attacking === 'special' ? 70 : 34), y - 24);
      ctx.stroke();
      return;
    }
    if (style === 'prism') {
      ctx.fillStyle = fighter.palette[1];
      ctx.beginPath();
      ctx.moveTo(reach + 4, y + 13);
      ctx.lineTo(reach + 18, y - 14);
      ctx.lineTo(reach + 32, y + 13);
      ctx.closePath();
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.arc(reach + 10, y, attacking === 'special' ? 20 : 12, 0, Math.PI * 2);
    ctx.fillStyle = fighter.palette[1];
    ctx.fill();
  }

  drawFighter(ctx, actor, width, floorY, fighter) {
    const x = actor.x * width;
    const jump = actor.y * 180;
    const y = floorY - jump;
    const facing = actor.facing;
    const attacking = actor.attack;
    const torsoWidth = fighter.style === 'muscle' ? 66 : fighter.style === 'heads' ? 48 : 54;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);

    if (fighter.style === 'duo') {
      ctx.globalAlpha = 0.78;
      ctx.fillStyle = fighter.palette[1];
      roundedRect(ctx, -47, -79, 36, 58, 9);
      ctx.fill();
      ctx.fillStyle = '#c99578';
      ctx.beginPath();
      ctx.arc(-29, -97, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (actor.hitFlash > 0) {
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = '#fff';
      ctx.fillRect(-36, -126, 72, 126);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = fighter.palette[0];
    roundedRect(ctx, -torsoWidth / 2, -88, torsoWidth, 70, fighter.style === 'muscle' ? 18 : 11);
    ctx.fill();
    ctx.fillStyle = fighter.palette[1];
    ctx.beginPath();
    ctx.arc(0, -108, 19, 0, Math.PI * 2);
    ctx.fill();

    if (fighter.style === 'heads') {
      ctx.fillStyle = '#111';
      ctx.fillRect(-17, -113, 14, 6);
      ctx.fillRect(3, -113, 14, 6);
      ctx.fillStyle = '#8d8270';
      ctx.fillRect(-29, -72, 58, 8);
    } else if (fighter.style === 'veteran') {
      ctx.fillStyle = '#d7c96a';
      ctx.fillRect(-20, -119, 40, 4);
    } else {
      ctx.fillStyle = fighter.palette[2];
      ctx.fillRect(-17, -125, 34, 10);
    }

    ctx.fillStyle = fighter.palette[2];
    ctx.fillRect(-23, -19, 17, 48);
    ctx.fillRect(6, -19, 17, 48);

    const reach = attacking ? (attacking === 'special' ? 68 : attacking === 'heavy' ? 55 : 43) : 30;
    ctx.strokeStyle = fighter.palette[1];
    ctx.lineWidth = fighter.style === 'muscle' ? 14 : 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(18, -70);
    ctx.lineTo(reach, attacking ? -57 : -48);
    ctx.stroke();
    this.drawProp(ctx, fighter, reach, attacking ? -57 : -48, attacking);

    if (actor.blocking) {
      ctx.strokeStyle = '#79e4ff';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(28, -68, 31, -1.3, 1.3);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawHealth(ctx, x, y, width, hp, reverse, label) {
    ctx.fillStyle = '#15161b';
    ctx.fillRect(x, y, width, 18);
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, 18);
    const amount = (width * Math.max(0, hp)) / 100;
    ctx.fillStyle = hp > 45 ? '#79e48f' : hp > 20 ? '#f0c85a' : '#ed5d68';
    ctx.fillRect(reverse ? x + width - amount : x, y, amount, 18);
    ctx.fillStyle = '#fff';
    ctx.font = '700 12px system-ui';
    ctx.textAlign = reverse ? 'right' : 'left';
    ctx.fillText(label, reverse ? x + width : x, y - 8);
  }

  draw(now = performance.now()) {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas || !this.state || !this.playerFighter || !this.opponentFighter) return;
    if (this.vanish && now >= this.vanish.until) this.vanish = null;
    const width = canvas.width;
    const ratio = width / Math.max(1, canvas.clientWidth);
    ctx.save();
    ctx.scale(ratio, ratio);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#190d27');
    gradient.addColorStop(0.58, '#090910');
    gradient.addColorStop(1, '#030305');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(221, 65, 178, .12)';
    ctx.fillRect(0, h * 0.31, w, 3);
    ctx.fillStyle = 'rgba(75, 220, 255, .09)';
    ctx.fillRect(0, h * 0.52, w, 2);
    this.drawSpeaker(ctx, 18, Math.max(88, h - 190), 0.82);
    this.drawSpeaker(ctx, w - 76, Math.max(88, h - 190), 0.82);

    const floorY = h - 64;
    ctx.fillStyle = '#17151a';
    ctx.fillRect(0, floorY + 28, w, h - floorY);
    ctx.strokeStyle = '#38313e';
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, floorY + 28);
      ctx.lineTo(x + 25, h);
      ctx.stroke();
    }

    const barWidth = Math.max(110, Math.min(240, w * 0.34));
    this.drawHealth(ctx, 20, 34, barWidth, this.state.player.hp, false, this.playerFighter.name);
    this.drawHealth(
      ctx,
      w - 20 - barWidth,
      34,
      barWidth,
      this.state.opponent.hp,
      true,
      this.opponentFighter.name,
    );
    ctx.fillStyle = '#fff';
    ctx.font = '800 23px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.ceil(this.state.time)).padStart(2, '0'), w / 2, 51);

    if (this.vanish?.side !== 'player')
      this.drawFighter(ctx, this.state.player, w, floorY, this.playerFighter);
    if (this.vanish?.side !== 'opponent')
      this.drawFighter(ctx, this.state.opponent, w, floorY, this.opponentFighter);

    if (this.vanish) {
      ctx.textAlign = 'center';
      ctx.font = `900 ${Math.max(18, Math.min(36, w * 0.052))}px system-ui`;
      ctx.fillStyle = '#ffd469';
      ctx.fillText(this.vanish.label, w / 2, h * 0.25);
    }

    if (this.state.status === 'finished') {
      ctx.fillStyle = 'rgba(0,0,0,.72)';
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = `900 ${Math.max(23, Math.min(44, w * 0.062))}px system-ui`;
      const headline =
        this.state.winner === 'player'
          ? `${this.playerFighter.name} WINS`
          : this.state.winner === 'draw'
            ? 'DOUBLE BOOKING'
            : `${this.opponentFighter.name} WINS`;
      ctx.fillText(headline, w / 2, h * 0.46);
      ctx.font = '700 15px system-ui';
      ctx.fillStyle = '#f4b1db';
      ctx.fillText('press ENTER or tap REMATCH', w / 2, h * 0.54);
      const buttonW = 132;
      const buttonH = 42;
      roundedRect(ctx, w / 2 - buttonW / 2, h * 0.6, buttonW, buttonH, 8);
      ctx.fillStyle = '#2e1b38';
      ctx.fill();
      ctx.strokeStyle = '#f05ab4';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '800 13px system-ui';
      ctx.fillText('REMATCH', w / 2, h * 0.6 + 27);
      this.canvas.onclick = (event) => {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        if (
          x >= w / 2 - buttonW / 2 &&
          x <= w / 2 + buttonW / 2 &&
          y >= h * 0.6 &&
          y <= h * 0.6 + buttonH
        )
          this.rematch();
      };
    } else this.canvas.onclick = null;
    ctx.restore();
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    window.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('keyup', this.onKeyUp, true);
    window.removeEventListener('resize', this.resize);
    for (const { button: control, down, up } of this.controls) {
      control.removeEventListener('pointerdown', down);
      control.removeEventListener('pointerup', up);
      control.removeEventListener('pointercancel', up);
    }
    this.controls = [];
    this.overlay?.remove();
    this.overlay = null;
    this.canvas = null;
    this.ctx = null;
    this.status = null;
    this.selection = null;
    this.controlsElement = null;
    this.rosterButton = null;
    this.state = null;
    this.playerFighter = null;
    this.opponentFighter = null;
    this.vanish = null;
    this.onActive(false);
  }

  dispose() {
    this.stop();
  }
}
