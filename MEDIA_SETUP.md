# Breakglass After Hours — runtime audio

The game intentionally serves Breakglass catalogue and studio playback from **same-origin public web copies** under `public/assets/audio`.

Google Drive remains the source archive, but Drive download URLs are not used at runtime: redirects, confirmation pages and CORS behavior made them unreliable for WebAudio on mobile. The public playback copies are now committed with the game so iPhone/Safari, desktop browsers, the DJ decks and the Spectra console all resolve the same stable media URLs.

The deployed folders are:

```text
public/assets/audio/catalog/
  got-you-dancin.mp3
  in-flux/
    just-be.mp3
    breath.mp3
    break.mp3
    gingele.mp3
  jashim/
    atrakar.mp3
    atrakar-instrumental.mp3
    atrakar-vocal.mp3
  boogaloo/
    dubki.mp3
    paharpur.mp3
    fakir.mp3
    bhab.mp3

public/assets/audio/dance-shoes/
  drums.mp3
  bass.mp3
  synths-fx.mp3
  vox.mp3
```

Run:

```bash
pnpm media:check
pnpm test
pnpm build
```

`pnpm media:check` fails if any required runtime audio file is absent or implausibly small.

## Audio source policy

Source WAVs / masters remain in the Breakglass Drive archive. The repository contains public playback copies only. Existing MP3 masters are preserved as supplied; WAV-only ATRAKAR and Dance Shoes material is represented by 48 kHz / 192 kbps MP3 web copies. The four Dance Shoes stems use identical codec settings and matching source lengths so they can launch together on separate Spectra console channels.

If catalogue media changes, update the optimized playback copy and keep the runtime path in `src/assets/manifest.js` same-origin. Do not replace these paths with Drive `uc?export=download` links.
