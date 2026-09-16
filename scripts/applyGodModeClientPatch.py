from pathlib import Path

# GameState: keep God Mode progress completely separate from normal play.
p = Path('src/state/GameState.js')
s = p.read_text()
s = s.replace(
    '  constructor(storage, onWarning = () => {}) {\n    this.storage = storage;',
    "  constructor(storage, onWarning = () => {}, saveKey = SAVE_KEY) {\n    this.storage = storage;\n    this.saveKey = saveKey || SAVE_KEY;",
    1,
)
s = s.replace("storage?.getItem(SAVE_KEY)", "storage?.getItem(this.saveKey)", 1)
s = s.replace("this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));", "this.storage.setItem(this.saveKey, JSON.stringify(this.data));", 1)
p.write_text(s)

# Game: allow the composition root to choose the save namespace.
p = Path('src/core/Game.js')
s = p.read_text()
s = s.replace(
    'this.state = new GameState(storage, (message) => ui.warning(message));',
    'this.state = new GameState(storage, (message) => ui.warning(message), options.saveKey);',
    1,
)
p.write_text(s)

# Main: resolve access before constructing the game, use isolated save, then unlock runtime state.
p = Path('src/main.js')
s = p.read_text()
s = s.replace(
    "import { installAudioReliabilityEnhancements } from './gameplay/audioReliabilityEnhancements.js';",
    "import { installAudioReliabilityEnhancements } from './gameplay/audioReliabilityEnhancements.js';\nimport { applyGodMode, GOD_MODE_SAVE_KEY, resolveGodModeAccess } from './gameplay/GodMode.js';",
    1,
)
s = s.replace(
    'const ui = new Hud(document);\nlet game;\ntry {\n  game = new Game(ui, {\n    spatialPass: new URLSearchParams(location.search).get(\'pass\') ?? undefined,\n  });',
    "const godMode = await resolveGodModeAccess();\nconst ui = new Hud(document);\nlet game;\ntry {\n  game = new Game(ui, {\n    spatialPass: new URLSearchParams(location.search).get('pass') ?? undefined,\n    saveKey: godMode.enabled ? GOD_MODE_SAVE_KEY : undefined,\n  });\n  if (godMode.enabled) applyGodMode(game, ui);",
    1,
)
p.write_text(s)
