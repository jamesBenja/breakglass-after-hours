export class Hud {
  constructor(document) {
    this.document = document;
    this.status = document.getElementById('status');
    this.title = document.getElementById('pTitle');
    this.text = document.getElementById('pText');
    this.buttons = document.getElementById('buttons');
    this.floorTag = document.getElementById('floorTag');
    this.transition = document.getElementById('transition');
    this.gate = document.getElementById('gate');
    this.enter = document.getElementById('enter');
    this.debug = document.getElementById('debug');
    this.notice = document.getElementById('notice');
  }

  ready(start) {
    this.enter.disabled = false;
    this.enter.onclick = async () => {
      this.enter.disabled = true;
      try {
        await start();
        this.gate.hidden = true;
      } catch (error) {
        this.warning(`Could not start: ${error.message}`);
        this.enter.disabled = false;
      }
    };
  }

  panel(title, text, actions = []) {
    this.title.textContent = title;
    this.text.textContent = text;
    this.buttons.replaceChildren();
    for (const [label, action] of actions) {
      const button = this.document.createElement('button');
      button.textContent = label;
      button.onclick = (event) => {
        Promise.resolve()
          .then(action)
          .catch((error) => this.warning(error.message));
        if (event.detail > 0) this.document.querySelector('canvas')?.focus();
      };
      this.buttons.appendChild(button);
    }
  }

  warning(message) {
    this.notice.textContent = message;
    this.notice.hidden = false;
  }

  fade(active) {
    this.transition.classList.toggle('on', active);
    this.transition.setAttribute('aria-hidden', String(!active));
  }

  update({ level, player, target, audio, state, transitionPhase, fps, camera }) {
    const ground = level.collision.surfaceAt(
      player.position.x,
      player.position.z,
      player.position.y + 0.25,
    );
    const room = ground?.surface.name ?? level.definition.id;
    const status =
      room + (target ? ` · E: ${target.name}` : '') + (audio.label ? ` · ${audio.label}` : '');
    if (this.status.textContent !== status) this.status.textContent = status;
    this.debug.hidden = !state.debug;
    if (!state.debug) return;
    this.debug.textContent = [
      `Scene: ${level.definition.id}${level.definition.pass ? ` / Pass ${level.definition.pass}` : ''} | transition: ${transitionPhase}`,
      `Position: ${player.position
        .toArray()
        .map((v) => v.toFixed(2))
        .join(', ')}`,
      `Collision region: ${ground?.surface.id ?? 'none'} | grounded: ${player.grounded}`,
      `Collision target: ${player.collisionTarget ?? 'none'} | ground: ${player.groundTarget ?? 'none'}`,
      `Camera target: ${camera?.collisionTarget ?? 'clear'} | boom: ${camera?.clearance.toFixed(2)} units`,
      `Interaction: ${target?.id ?? 'none'}`,
      `Geometry: ${level.geometrySource} (${level.definition.provenance.status})`,
      `Audio: ${audio.trackId ?? 'stopped'} | ${audio.context?.state ?? 'not started'} | voices: ${audio.voices.size}`,
      `Contacts: ${state.contacts.join(', ') || 'none'} | last track: ${state.lastTrack ?? 'none'}`,
      `Visited: ${state.visited.join(', ')} | ${fps.toFixed(0)} fps`,
    ].join('\n');
  }

  fatal(error) {
    this.gate.hidden = false;
    this.gate.querySelector('.card p').textContent =
      `The game could not load: ${error.message}. Reload to try again.`;
    this.enter.disabled = true;
  }

  dispose() {
    this.enter.onclick = null;
    this.buttons.replaceChildren();
  }
}
