import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const expected = [
  'public/assets/audio/catalog/got-you-dancin.mp3',
  'public/assets/audio/catalog/in-flux/just-be.mp3',
  'public/assets/audio/catalog/in-flux/breath.mp3',
  'public/assets/audio/catalog/in-flux/break.mp3',
  'public/assets/audio/catalog/in-flux/gingele.mp3',
  'public/assets/audio/catalog/jashim/atrakar.mp3',
  'public/assets/audio/catalog/jashim/atrakar-instrumental.mp3',
  'public/assets/audio/catalog/jashim/atrakar-vocal.mp3',
  'public/assets/audio/catalog/boogaloo/dubki.mp3',
  'public/assets/audio/catalog/boogaloo/paharpur.mp3',
  'public/assets/audio/catalog/boogaloo/fakir.mp3',
  'public/assets/audio/catalog/boogaloo/bhab.mp3',
  'public/assets/audio/dance-shoes/drums.mp3',
  'public/assets/audio/dance-shoes/bass.mp3',
  'public/assets/audio/dance-shoes/synths-fx.mp3',
  'public/assets/audio/dance-shoes/vox.mp3',
];

let failed = false;
for (const relative of expected) {
  try {
    const info = await stat(resolve(relative));
    if (!info.isFile() || info.size < 100_000)
      throw new Error('file is empty or implausibly small');
    console.log(`✓ ${relative} (${(info.size / 1024 / 1024).toFixed(1)} MB)`);
  } catch (error) {
    failed = true;
    console.error(`✗ ${relative}: ${error.message}`);
  }
}

if (failed) {
  console.error(
    '\nAudio pack incomplete. Unzip the supplied Breakglass audio pack into the repository root.',
  );
  process.exitCode = 1;
} else {
  console.log(`\nAll ${expected.length} required local audio files are present.`);
}
