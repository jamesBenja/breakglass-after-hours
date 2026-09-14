# Breakglass After Hours — local audio setup

The game intentionally does **not** stream catalogue masters from Google Drive at runtime.

Google Drive download URLs can return redirects / confirmation pages and generally do not behave like a stable CORS-enabled media CDN. That made real tracks fail to decode or start consistently in the DJ booth and Spectra console. The runtime manifest now points to same-origin files under `public/assets/audio`, which gives WebAudio reliable fetch/decode access and keeps the mixer, EQ, room filtering and spatial systems on one audio graph.

## Install the supplied audio pack

The downloadable pack is structured from the repository root. Unzip it directly into `breakglass-after-hours/` so the first directory you see is `public/`.

After installation, these folders should exist:

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

Source WAVs / masters remain in the Breakglass Drive archive. The repository receives playback copies only. The current pack preserves existing MP3 catalogue files where available and makes 48 kHz / 192 kbps MP3 web copies for the large WAV-only material. The four Dance Shoes stems were exported with identical codec settings and matching lengths so they can launch together on separate Spectra console channels.

Do not replace the local runtime paths in `src/assets/manifest.js` with Drive `uc?export=download` links. If the catalogue changes, make a new optimized web copy and update the manifest path instead.
