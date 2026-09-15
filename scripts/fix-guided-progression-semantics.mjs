import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, before, after) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(before)) {
    throw new Error(`Could not find semantic patch anchor in ${path}: ${before.slice(0, 120)}`);
  }
  writeFileSync(path, source.replace(before, after));
}

function replaceAll(path, before, after) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(before)) {
    throw new Error(`Could not find semantic patch token in ${path}: ${before}`);
  }
  writeFileSync(path, source.split(before).join(after));
}

// `storageAccessGranted` already belongs to David's disguised downstairs furniture-storage passage.
// Keep that save contract intact and give Jace's upstairs tape archive its own progression state so
// old saves and David's interaction cannot bypass the new studio-floor gate.
replaceOnce(
  'src/state/GameState.js',
  `  storageAccessGranted: false,\n  deadRoomAccessGranted: false,`,
  `  storageAccessGranted: false,\n  tapeArchiveAccessGranted: false,\n  deadRoomAccessGranted: false,`,
);
replaceOnce(
  'src/state/GameState.js',
  `  state.storageAccessGranted = value.storageAccessGranted === true;\n  state.deadRoomAccessGranted = value.deadRoomAccessGranted === true;`,
  `  state.storageAccessGranted = value.storageAccessGranted === true;\n  state.tapeArchiveAccessGranted = value.tapeArchiveAccessGranted === true;\n  state.deadRoomAccessGranted = value.deadRoomAccessGranted === true;`,
);

// These two files did not use the old David flag before this feature, so every occurrence here is
// part of the newly generated upstairs archive path and can be cleanly renamed.
replaceAll('src/world/upstairs/definition.js', 'storageAccessGranted', 'tapeArchiveAccessGranted');
replaceAll('src/interactions/createActions.js', 'storageAccessGranted', 'tapeArchiveAccessGranted');

console.log('Separated David storage access from Jace tape-archive access.');
