import { commandFight, createFightState, stepFight } from './UndergroundFight.js';

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

const ATTACK_NAMES = {
  player: {
    light: 'VINYL SLAP',
    heavy: 'FADER SMASH',
    special: 'BASS DROP',
  },
  opponent: {
    light: 'MIC CHECK',
    heavy: 'GUITAR SWING',
    special: 'FEEDBACK BLAST',
  },
};

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.roundRect?.(x, y, width, height, r);
  if (!ctx.roundRect) ctx.rect(x, y, width, height);
}

export class UndergroundKombat {
  constructor(document, audio, { onActive = () => {}, onWin = () => {} } = {}) {
    this.document = document;
    this.audio = audio;
    this.onActive = onActive;
    this.onWin = onWin;
    this.active = false;
    this.state = null;
    this.lastTime = 0;
    this.raf = null;
    this.overlay = null;
    this.canvas = null;
    this.ctx = null;
    this.status = null;
    this.controls = [];
    this.onKeyDown = (event) => this.key(event, true);
    this.onKeyUp = (event) => this.key(event, false);
    this.resize = () => this.fitCanvas();
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.state = createFightState({ mode: 'cpu', roundTime: 60 });
    this.onActive(true);
    this.mount();
    this.audio?.init?.().catch?.(() => {});
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame((now) => this.frame(now));
  }

  rematch() {
    this.state = createFightState({ mode: 'cpu', roundTime: 60 });
    this.lastTime = performance.now();
    if (!this.raf) this.raf = requestAnimationFrame((now) => this.frame(now));
  }

  mount() {
    const overlay = this.document.createElement('div');
    overlay.className = 'underground-kombat';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Breakglass Underground Kombat arcade game');

    const top = this.document.createElement('div');
    top.className = 'kombat-topbar';
    const brand = this.document.createElement('div');
    brand.innerHTML = '<strong>BREAKGLASS UNDERGROUND KOMBAT</strong><span>single player · cabinet prototype</span>';
    const exit = this.document.createElement('button');
    exit.className = 'kombat-exit';
    exit.textContent = 'EXIT CABINET';
    exit.onclick = () => this.stop();
    top.append(brand, exit);

    const canvas = this.document.createElement('canvas');
    canvas.className = 'kombat-canvas';
    canvas.setAttribute('aria-label', 'Underground music scene fighting game');

    const status = this.document.createElement('div');
    status.className = 'kombat-status';
    status.textContent = 'A/D move · W jump · J vinyl slap · K fader smash · L bass drop · I block';

    const controls = this.document.createElement('div');
    controls.className = 'kombat-controls';
    for (const [label, action, hold] of [
      ['◀', 'left', true],
      ['▶', 'right', true],
      ['JUMP', 'jump', false],
      ['VINYL', 'light', false],
      ['FADER', 'heavy', false],
      ['BASS DROP', 'special', false],
      ['BLOCK', 'block', true],
    ]) {
      const button = this.document.createElement('button');
      button.textContent = label;
      button.dataset.action = action;
      const down = (event) => {
        event.preventDefault();
        button.classList.add('pressed');
        commandFight(this.state, 'player', action, true);
        this.sfx('input', action);
      };
      const up = (event) => {
        event.preventDefault();
        button.classList.remove('pressed');
        if (hold) commandFight(this.state, 'player', action, false);
      };
      button.addEventListener('pointerdown', down);
      button.addEventListener('pointerup', up);
      button.addEventListener('pointercancel', up);
      button.addEventListener('pointerleave', (event) => {
        if (hold && button.classList.contains('pressed')) up(event);
      });
      controls.appendChild(button);
      this.controls.push({ button, down, up });
    }

    overlay.append(top, canvas, status, controls);
    this.document.body.appendChild(overlay);
    this.overlay = overlay;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.status = status;
    window.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('keyup', this.onKeyUp, true);
    window.addEventListener('resize', this.resize);
    this.fitCanvas();
  }

  key(event, pressed) {
    if (!this.active) return;
    if (event.code === 'Escape' && pressed) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.stop();
      return;
    }
    if (event.code === 'Enter' && pressed && this.state?.status === 'finished') {
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
    if (!this.canvas) return;
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
    if (!this.active) return;
    const dt = Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    const events = stepFight(this.state, dt);
    for (const event of events) this.handleEvent(event);
    this.draw();
    this.raf = requestAnimationFrame((time) => this.frame(time));
  }

  handleEvent(event) {
    if (event.type === 'hit') {
      this.sfx('hit', event.attack, event.guarded);
      const attacker = event.side === 'player' ? 'FADER FURY' : 'FEEDBACK FIEND';
      const move = ATTACK_NAMES[event.side]?.[event.attack] ?? event.attack.toUpperCase();
      this.status.textContent = `${attacker}: ${move}${event.guarded ? ' · BLOCKED' : ''}`;
      return;
    }
    if (event.type === 'round-end') {
      this.sfx('finish', event.winner);
      if (event.winner === 'player') {
        this.status.textContent = 'FADER FURY WINS · ENTER / REMATCH to run it back';
        this.onWin();
      } else if (event.winner === 'draw') {
        this.status.textContent = 'DOUBLE BOOKING · DRAW · ENTER / REMATCH';
      } else {
        this.status.textContent = 'FEEDBACK FIEND WINS · ENTER / REMATCH to run it back';
      }
    }
  }

  sfx(kind, detail, guarded = false) {
    if (!this.audio?.context) return;
    if (kind === 'hit') {
      this.audio.kick?.();
      this.audio.tone?.(guarded ? 880 : detail === 'special' ? 52 : 110, 0.12, 'sawtooth', guarded ? 0.035 : 0.07);
    } else if (kind === 'finish') {
      const root = detail === 'player' ? 110 : 73.4;
      [1, 1.25, 1.5, 2].forEach((ratio, index) => this.audio.tone?.(root * ratio, 0.28, 'square', 0.045, index * 0.07));
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
      ctx.arc(x + 35 * scale, y + offset * scale, (offset === 42 ? 22 : 28) * scale, 0, Math.PI * 2);
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

  drawFighter(ctx, actor, width, floorY, isPlayer) {
    const x = actor.x * width;
    const jump = actor.y * 180;
    const y = floorY - jump;
    const facing = actor.facing;
    const attacking = actor.attack;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);

    if (actor.hitFlash > 0) {
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = '#fff';
      ctx.fillRect(-31, -122, 62, 122);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = isPlayer ? '#492c71' : '#74303f';
    roundedRect(ctx, -26, -86, 52, 68, 11);
    ctx.fill();
    ctx.fillStyle = '#c89473';
    ctx.beginPath();
    ctx.arc(0, -106, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#17171c';
    ctx.fillRect(-17, -123, 34, 10);
    ctx.fillStyle = '#15161b';
    ctx.fillRect(-23, -19, 17, 48);
    ctx.fillRect(6, -19, 17, 48);

    const reach = attacking ? (attacking === 'special' ? 68 : attacking === 'heavy' ? 55 : 43) : 30;
    ctx.strokeStyle = '#c89473';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(18, -70);
    ctx.lineTo(reach, attacking ? -57 : -48);
    ctx.stroke();

    if (isPlayer) {
      ctx.beginPath();
      ctx.arc(reach + 10, attacking ? -57 : -48, attacking === 'special' ? 22 : 15, 0, Math.PI * 2);
      ctx.fillStyle = attacking === 'special' ? '#ffcf55' : '#16171c';
      ctx.fill();
      ctx.strokeStyle = '#f05ab4';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(reach + 10, attacking ? -57 : -48, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#eee';
      ctx.fill();
    } else {
      ctx.save();
      ctx.translate(reach + 6, attacking ? -57 : -48);
      ctx.rotate(attacking ? -0.65 : -0.2);
      ctx.fillStyle = '#2a2325';
      ctx.fillRect(-4, -4, 45, 8);
      ctx.fillStyle = '#d04e74';
      ctx.beginPath();
      ctx.moveTo(-12, -17);
      ctx.lineTo(18, -11);
      ctx.lineTo(22, 12);
      ctx.lineTo(-13, 18);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

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
    const amount = width * Math.max(0, hp) / 100;
    ctx.fillStyle = hp > 45 ? '#79e48f' : hp > 20 ? '#f0c85a' : '#ed5d68';
    ctx.fillRect(reverse ? x + width - amount : x, y, amount, 18);
    ctx.fillStyle = '#fff';
    ctx.font = '700 12px system-ui';
    ctx.textAlign = reverse ? 'right' : 'left';
    ctx.fillText(label, reverse ? x + width : x, y - 8);
  }

  draw() {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas || !this.state) return;
    const width = canvas.width;
    const height = canvas.height;
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
    this.drawHealth(ctx, 20, 34, barWidth, this.state.player.hp, false, 'FADER FURY');
    this.drawHealth(ctx, w - 20 - barWidth, 34, barWidth, this.state.opponent.hp, true, 'FEEDBACK FIEND');
    ctx.fillStyle = '#fff';
    ctx.font = '800 23px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.ceil(this.state.time)).padStart(2, '0'), w / 2, 51);

    this.drawFighter(ctx, this.state.player, w, floorY, true);
    this.drawFighter(ctx, this.state.opponent, w, floorY, false);

    if (this.state.status === 'finished') {
      ctx.fillStyle = 'rgba(0,0,0,.72)';
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = `900 ${Math.max(25, Math.min(46, w * 0.07))}px system-ui`;
      const headline = this.state.winner === 'player' ? 'FADER FURY WINS' : this.state.winner === 'draw' ? 'DOUBLE BOOKING' : 'FEEDBACK FIEND WINS';
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
        if (x >= w / 2 - buttonW / 2 && x <= w / 2 + buttonW / 2 && y >= h * 0.6 && y <= h * 0.6 + buttonH) this.rematch();
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
    for (const { button, down, up } of this.controls) {
      button.removeEventListener('pointerdown', down);
      button.removeEventListener('pointerup', up);
      button.removeEventListener('pointercancel', up);
    }
    this.controls = [];
    this.overlay?.remove();
    this.overlay = null;
    this.canvas = null;
    this.ctx = null;
    this.status = null;
    this.state = null;
    this.onActive(false);
  }

  dispose() {
    this.stop();
  }
}
