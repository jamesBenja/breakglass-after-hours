export const ENTRY_SCENE_ID = 'alley';

export function installEntryEnhancements(game, ui) {
  if (!game || game._entryEnhancementsInstalled) return;
  game._entryEnhancementsInstalled = true;

  const bouncer = game.crowdDoor?.bouncer;
  if (bouncer && !bouncer._securityGateInstalled) {
    bouncer._securityGateInstalled = true;
    const baseHandle = bouncer.handle.bind(bouncer);

    // Existing bouncer flows call enter() when security approves someone. Change that semantic
    // from teleporting through the door to granting clearance. The physical door is a separate
    // interaction and cannot be used until this has happened.
    bouncer.enter = () => {
      bouncer.admitted = true;
      bouncer.waitUntil = 0;
      ui.panel(
        'DOOR · CLEARED BY SECURITY',
        'Security gives you the nod. You are cleared to use the club entrance now.',
        [],
      );
      ui.warning?.('Security cleared you. Use the entrance door to go inside.');
    };

    bouncer.handle = (target) => {
      if (game.sceneManager.current?.definition?.id !== ENTRY_SCENE_ID) return false;
      const isDoor = target?.id === 'clubDoor' || target?.target === 'downstairs@alley';
      if (!isDoor) return baseHandle(target);

      if (!bouncer.admitted) {
        const remaining = bouncer.remainingWait?.() ?? 0;
        ui.panel(
          remaining > 0 ? 'DOOR · WAIT IN THE ALLEY' : 'DOOR · SECURITY FIRST',
          remaining > 0
            ? `Security told you to wait. You can try talking to them again in about ${remaining} seconds.`
            : 'The entrance is controlled by security. Talk to the bouncer before trying to go inside.',
          [],
        );
        return true;
      }

      game.sceneManager.request('downstairs@alley');
      return true;
    };
  }

  const baseInitialize = game.initialize.bind(game);
  game.initialize = async (...args) => {
    bouncer?.reset?.();
    const sceneManager = game.sceneManager;
    const originalStart = sceneManager.start.bind(sceneManager);
    sceneManager.start = () => originalStart(ENTRY_SCENE_ID, null);
    try {
      return await baseInitialize(...args);
    } finally {
      sceneManager.start = originalStart;
    }
  };
}
