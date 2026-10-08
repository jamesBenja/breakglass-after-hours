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
  'public/assets/audio/catalog/dance-beyond-genre/team-break.mp3',
  'public/assets/audio/catalog/dance-beyond-genre/ancillary-things.mp3',
  'public/assets/audio/catalog/james-benjamin/gairage.mp3',
  'public/assets/audio/catalog/james-benjamin/hit-the-floor.mp3',
  'public/assets/audio/catalog/james-benjamin/chi-town-drop.mp3',
  'public/assets/audio/catalog/james-benjamin/guestlist-andy-s.mp3',
  'public/assets/audio/catalog/got-you-dancin/drop-in.mp3',
  'public/assets/audio/catalog/got-you-dancin/body-check.mp3',
  'public/assets/audio/catalog/got-you-dancin/play-ball-people.mp3',
  'public/assets/audio/catalog/got-you-dancin/etcetera.mp3',
  'public/assets/audio/catalog/got-you-dancin/airtime-express.mp3',
  'public/assets/audio/catalog/boogieman/rotations/the-roll.mp3',
  'public/assets/audio/catalog/boogieman/rotations/den-naben.mp3',
  'public/assets/audio/catalog/boogieman/rotations/water-is-boiling.mp3',
  'public/assets/audio/catalog/boogieman/rotations/adjust.mp3',
  'public/assets/audio/catalog/boogieman/rotations/she.mp3',
  'public/assets/audio/catalog/boogieman/rotations/devils-mountain.mp3',
  'public/assets/audio/catalog/boogieman/rotations/fences.mp3',
  'public/assets/audio/catalog/boogieman/rotations/water-is-boiling-outro.mp3',
  'public/assets/audio/ambient/mfteot/nature/waterfall-rebirth.mp3',
  'public/assets/audio/ambient/mfteot/nature/birds-at-the-sinks.mp3',
  'public/assets/audio/ambient/mfteot/nature/zona.mp3',
  'public/assets/audio/ambient/mfteot/nature/cellular-imaginings.mp3',
  'public/assets/audio/ambient/mfteot/nature/to-philly.mp3',
  'public/assets/audio/ambient/mfteot/man/to-dream.mp3',
  'public/assets/audio/ambient/mfteot/man/phaser.mp3',
  'public/assets/audio/ambient/mfteot/man/dead-mans.mp3',
  'public/assets/audio/ambient/mfteot/man/decisions.mp3',
  'public/assets/audio/ambient/mfteot/man/deeper-b.mp3',
  'public/assets/audio/ambient/mfteot/man/nick-cave-esque.mp3',
  'public/assets/audio/studio/gairage/drums.mp3',
  'public/assets/audio/studio/gairage/bass.mp3',
  'public/assets/audio/studio/gairage/synths.mp3',
  'public/assets/audio/studio/gairage/fx.mp3',
  'public/assets/audio/studio/gairage/vocal-chop.mp3',
  'public/assets/audio/studio/in-an-instant/keys.mp3',
  'public/assets/audio/studio/in-an-instant/jx3p.mp3',
  'public/assets/audio/studio/in-an-instant/syncussion.mp3',
  'public/assets/audio/studio/in-an-instant/modular-drums.mp3',
  'public/assets/audio/studio/in-an-instant/low-pulse.mp3',
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
