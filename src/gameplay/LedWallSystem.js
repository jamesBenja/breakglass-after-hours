import { CanvasTexture, Color, LinearFilter, SRGBColorSpace } from 'three';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const EFFECTS = ['static', 'crawl', 'pulse', 'wave', 'strobe'];
const PALETTES = [
  { name: 'PINK / BLACK', foreground: '#ff4fb8', background: '#09030c' },
  { name: 'ACID', foreground: '#d8ff3e', background: '#08130a' },
  { name: 'CYAN', foreground: '#45f5ff', background: '#031016' },
  { name: 'RED', foreground: '#ff3d45', background: '#150205' },
  { name: 'WHITE', foreground: '#ffffff', background: '#050505' },
];

function normalizeState(value = {}) {
  return {
    text: typeof value.text === 'string' ? value.text.slice(0, 80) : 'BREAKGLASS',
    foreground: /^#[0-9a-f]{6}$/i.test(value.foreground) ? value.foreground : '#ff4fb8',
    background: /^#[0-9a-f]{6}$/i.test(value.background) ? value.background : '#09030c',
    effect: EFFECTS.includes(value.effect) ? value.effect : 'crawl',
    speed: clamp(value.speed ?? 0.45, 0.05, 2),
    brightness: clamp(value.brightness ?? 0.88, 0.1, 1),
    graphic: ['text', 'bars', 'rings', 'checker', 'image'].includes(value.graphic)
      ? value.graphic
      : 'text',
    imageData:
      typeof value.imageData === 'string' && /^data:image\/(?:png|jpeg|webp);base64,/i.test(value.imageData)
        ? value.imageData.slice(0, 140000)
        : null,
  };
}

function makeButton(document, label, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.onclick = () => Promise.resolve(action()).catch((error) => console.warn(error));
  return button;
}

export class LedWallSystem {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.document = ui.document;
    this.state = normalizeState();
    this.canvas = this.document.createElement('canvas');
    this.canvas.width = 768;
    this.canvas.height = 192;
    this.context = this.canvas.getContext('2d');
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.minFilter = LinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.needsUpdate = true;
    this.image = null;
    this.imageLoading = null;
    this.mesh = null;
    this.elapsed = 0;
    this.dirty = true;
    this.lastBroadcastState = '';
  }

  ensureMesh() {
    if (this.mesh?.parent) return this.mesh;
    const level = this.game.scenes.get('downstairs');
    const mesh = level?.scene?.getObjectByName?.('dj-led-wall');
    if (!mesh) return null;
    this.mesh = mesh;
    mesh.material.map = this.texture;
    mesh.material.emissiveMap = this.texture;
    mesh.material.emissive = new Color(0xffffff);
    mesh.material.emissiveIntensity = 1.7;
    mesh.material.roughness = 0.45;
    mesh.material.needsUpdate = true;
    return mesh;
  }

  snapshot() {
    return { ...this.state };
  }

  async loadImage(data) {
    if (!data) {
      this.image = null;
      return;
    }
    if (this.imageLoading === data) return;
    this.imageLoading = data;
    await new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        if (this.imageLoading === data) this.image = image;
        resolve();
      };
      image.onerror = resolve;
      image.src = data;
    });
    this.imageLoading = null;
    this.dirty = true;
  }

  apply(value, { remote = false } = {}) {
    const next = normalizeState({ ...this.state, ...value });
    const imageChanged = next.imageData !== this.state.imageData;
    this.state = next;
    if (imageChanged) void this.loadImage(next.imageData);
    this.dirty = true;
    if (!remote) this.publish();
    return this.snapshot();
  }

  publish() {
    const world = this.game.multiplayer?.world;
    const snapshot = this.snapshot();
    const signature = JSON.stringify(snapshot);
    if (signature === this.lastBroadcastState) return;
    this.lastBroadcastState = signature;
    if (this.game.multiplayer?.joined) {
      this.game.multiplayer.send({ type: 'object_update', objectId: 'dj-led-wall', data: snapshot });
    } else if (world?.objects) world.objects.set('dj-led-wall', snapshot);
  }

  drawGraphic(ctx, width, height, time) {
    const { graphic, foreground, background, text, effect, speed } = this.state;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = foreground;

    if (graphic === 'image' && this.image) {
      const scale = Math.max(width / this.image.width, height / this.image.height);
      const w = this.image.width * scale;
      const h = this.image.height * scale;
      ctx.drawImage(this.image, (width - w) / 2, (height - h) / 2, w, h);
      return;
    }

    if (graphic === 'bars') {
      const count = 28;
      for (let i = 0; i < count; i += 1) {
        const phase = time * speed * 4 + i * 0.63;
        const value = 0.18 + Math.abs(Math.sin(phase)) * 0.82;
        const barWidth = width / count - 4;
        const barHeight = height * value;
        ctx.fillRect(i * (width / count) + 2, height - barHeight, barWidth, barHeight);
      }
      return;
    }

    if (graphic === 'rings') {
      ctx.strokeStyle = foreground;
      ctx.lineWidth = 7;
      const travel = modulo(time * speed * 90, 120);
      for (let radius = 18 + travel; radius < width; radius += 90) {
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      return;
    }

    if (graphic === 'checker') {
      const size = 32;
      const offset = Math.floor(time * speed * 48) % (size * 2);
      for (let y = -size; y < height + size; y += size) {
        for (let x = -size; x < width + size; x += size) {
          if (((x / size + y / size) & 1) === 0) ctx.fillRect(x + offset, y, size, size);
        }
      }
      return;
    }

    const label = text || 'BREAKGLASS';
    ctx.font = '900 92px Arial Black, Arial, sans-serif';
    ctx.textBaseline = 'middle';
    const measured = ctx.measureText(label).width;
    if (effect === 'crawl') {
      const span = measured + width + 90;
      const x = width - modulo(time * speed * 150, span);
      ctx.fillText(label, x, height / 2);
      ctx.fillText(label, x + span, height / 2);
    } else if (effect === 'wave') {
      const letters = [...label];
      let x = 24;
      for (let i = 0; i < letters.length; i += 1) {
        const letter = letters[i];
        const y = height / 2 + Math.sin(time * speed * 5 + i * 0.62) * 28;
        ctx.fillText(letter, x, y);
        x += ctx.measureText(letter).width + 3;
      }
    } else {
      ctx.textAlign = 'center';
      ctx.fillText(label, width / 2, height / 2);
      ctx.textAlign = 'start';
    }
  }

  update(dt) {
    this.elapsed += dt;
    const mesh = this.ensureMesh();
    if (!mesh || !this.context) return;
    const animated = this.state.effect !== 'static' || ['bars', 'rings', 'checker'].includes(this.state.graphic);
    if (!this.dirty && !animated) return;
    this.dirty = false;

    const pulse = this.state.effect === 'pulse' ? 0.5 + Math.sin(this.elapsed * this.state.speed * 5) * 0.5 : 1;
    const strobe = this.state.effect === 'strobe' ? (Math.sin(this.elapsed * this.state.speed * 18) > 0 ? 1 : 0.08) : 1;
    mesh.material.emissiveIntensity = 0.35 + this.state.brightness * 2.3 * pulse * strobe;
    this.drawGraphic(this.context, this.canvas.width, this.canvas.height, this.elapsed);
    this.texture.needsUpdate = true;
  }

  async chooseImage() {
    const input = this.document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.hidden = true;
    this.document.body.appendChild(input);
    await new Promise((resolve) => {
      input.onchange = resolve;
      input.oncancel = resolve;
      input.click();
    });
    const file = input.files?.[0];
    input.remove();
    if (!file) return false;
    const bitmap = await createImageBitmap(file);
    const canvas = this.document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    const scale = Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height);
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;
    ctx.drawImage(bitmap, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    bitmap.close?.();
    const imageData = canvas.toDataURL('image/webp', 0.68);
    if (imageData.length > 120000) {
      this.ui.warning?.('That image is still too large for the shared LED wall. Try a simpler image.');
      return false;
    }
    await this.loadImage(imageData);
    this.apply({ graphic: 'image', imageData });
    return true;
  }

  showControls() {
    const state = this.state;
    const actions = [];
    const customText = () => {
      const value = globalThis.prompt?.('LED wall text', state.text);
      if (value != null) this.apply({ text: value, graphic: 'text' });
      this.showControls();
    };
    actions.push(['Edit text', customText]);
    for (const effect of EFFECTS) {
      actions.push([
        `${state.effect === effect ? '✓ ' : ''}${effect.toUpperCase()}`,
        () => {
          this.apply({ effect });
          this.showControls();
        },
      ]);
    }
    this.ui.panel(
      'DJ LED WALL',
      `${state.graphic.toUpperCase()} · ${state.effect.toUpperCase()} · speed ${state.speed.toFixed(2)} · brightness ${Math.round(state.brightness * 100)}%. Changes are shared with everyone in the live room.`,
      actions,
    );

    const row = this.document.createElement('div');
    row.className = 'row led-wall-controls';
    for (const graphic of ['text', 'bars', 'rings', 'checker']) {
      row.appendChild(
        makeButton(this.document, graphic.toUpperCase(), () => {
          this.apply({ graphic, imageData: graphic === 'text' ? state.imageData : null });
          this.showControls();
        }),
      );
    }
    row.appendChild(makeButton(this.document, 'UPLOAD IMAGE', async () => {
      await this.chooseImage();
      this.showControls();
    }));
    this.ui.buttons.appendChild(row);

    const palette = this.document.createElement('div');
    palette.className = 'row led-wall-controls';
    for (const entry of PALETTES) {
      palette.appendChild(
        makeButton(this.document, entry.name, () => {
          this.apply(entry);
          this.showControls();
        }),
      );
    }
    this.ui.buttons.appendChild(palette);

    const utility = this.document.createElement('div');
    utility.className = 'row led-wall-controls';
    utility.append(
      makeButton(this.document, 'SPEED −', () => {
        this.apply({ speed: state.speed - 0.1 });
        this.showControls();
      }),
      makeButton(this.document, 'SPEED +', () => {
        this.apply({ speed: state.speed + 0.1 });
        this.showControls();
      }),
      makeButton(this.document, 'DIM', () => {
        this.apply({ brightness: state.brightness - 0.12 });
        this.showControls();
      }),
      makeButton(this.document, 'BRIGHT', () => {
        this.apply({ brightness: state.brightness + 0.12 });
        this.showControls();
      }),
    );
    this.ui.buttons.appendChild(utility);
  }

  dispose() {
    this.texture.dispose();
    this.mesh = null;
    this.image = null;
  }
}
