import './ui/styles.css';
import './ui/mobilePerformance.css';
import './ui/mobileMixing.css';
import './ui/arcade.css';
import './ui/mobileMixerEnhancements.js';
import { Game } from './core/Game.js';
import { Hud } from './ui/Hud.js';

const ui = new Hud(document);
let game;
try {
  game = new Game(ui, {
    spatialPass: new URLSearchParams(location.search).get('pass') ?? undefined,
  });
  await game.initialize();
} catch (error) {
  console.error('Breakglass startup failed', error);
  await game?.dispose();
  ui.fatal(error);
}

if (import.meta.hot) {
  // Full reload preserves a single renderer/audio/input owner during development.
  import.meta.hot.dispose(() => {
    void game?.dispose();
  });
}
