import { LedWallSystem } from './LedWallSystem.js';
import { PerformancePropSystem } from './PerformancePropSystem.js';

export function installPerformanceRealismSystems(game, ui) {
  if (!game || game._performanceRealismSystemsInstalled) return;
  game._performanceRealismSystemsInstalled = true;

  const ledWall = new LedWallSystem(game, ui);
  const props = new PerformancePropSystem(game);
  game.ledWall = ledWall;
  game.performanceProps = props;

  const baseDispatch = game.interactions.dispatch;
  game.interactions.dispatch = (target) => {
    if (target?.action === 'ledWall') {
      ledWall.showControls();
      return;
    }
    baseDispatch(target);
  };

  const baseAnimate = game.player.animate.bind(game.player);
  game.player.animate = (dt) => {
    baseAnimate(dt);
    props.update(dt);
  };

  const baseDjUpdate = game.dj.update.bind(game.dj);
  game.dj.update = (dt) => {
    const result = baseDjUpdate(dt);
    ledWall.update(dt);
    return result;
  };

  const baseDispose = game.dispose.bind(game);
  game.dispose = async () => {
    props.dispose();
    ledWall.dispose();
    return baseDispose();
  };
}
