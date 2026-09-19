#!/usr/bin/env python3
import json
import math
import sys
from pathlib import Path

import librosa
import numpy as np


def circular_phase(times, period):
    if not len(times) or period <= 0:
        return 0.0
    angles = (times % period) / period * (2 * np.pi)
    mean = np.mean(np.exp(1j * angles))
    if abs(mean) < 1e-8:
        return 0.0
    angle = np.angle(mean)
    if angle < 0:
        angle += 2 * np.pi
    return float(angle / (2 * np.pi) * period)


def normalize_candidate(raw_bpm, nominal):
    candidates = []
    for factor in (0.5, 1.0, 2.0, 4.0):
        bpm = raw_bpm * factor
        if 70 <= bpm <= 190:
            candidates.append(bpm)
    if not candidates:
        return raw_bpm

    def score(bpm):
        nominal_penalty = abs(math.log(max(bpm, 1e-6) / max(nominal, 1e-6), 2)) * 3.5
        integer_penalty = min(abs(bpm - round(bpm)), abs(bpm * 2 - round(bpm * 2)) / 2) * 0.8
        club_penalty = 0 if 85 <= bpm <= 165 else 0.35
        return nominal_penalty + integer_penalty + club_penalty

    return min(candidates, key=score)


def snap_musical_bpm(value):
    nearest_int = round(value)
    if abs(value - nearest_int) <= 0.45:
        return float(nearest_int)
    nearest_half = round(value * 2) / 2
    if abs(value - nearest_half) <= 0.18:
        return float(nearest_half)
    return round(float(value), 2)


def analyze(track):
    path = Path(track['path'])
    # Fixed-tempo club masters only need a dense representative window. Skip sparse intros / encoder
    # padding, then measure enough bars to distinguish true tempo from half/double-time aliases.
    source_offset = 10.0
    y, sr = librosa.load(path, sr=22050, mono=True, offset=source_offset, duration=90.0)
    if y.size == 0:
        raise RuntimeError('empty audio')
    hop = 512
    onset = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop, aggregate=np.median)
    tempo_raw, beat_frames = librosa.beat.beat_track(
        onset_envelope=onset,
        sr=sr,
        hop_length=hop,
        units='frames',
        sparse=True,
    )
    tempo_raw = float(np.asarray(tempo_raw).reshape(-1)[0])
    beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop) + source_offset
    selected = normalize_candidate(tempo_raw, float(track['bpm']))

    refined = selected
    stability = 0.0
    if len(beat_times) >= 16:
        intervals = np.diff(beat_times)
        expected = 60.0 / max(selected, 1e-6)
        normalized = []
        for interval in intervals:
            if interval <= 0:
                continue
            multiples = max(1, round(interval / expected))
            normalized.append(interval / multiples)
        if normalized:
            normalized = np.asarray(normalized)
            median_period = float(np.median(normalized))
            good = normalized[np.abs(normalized - median_period) <= median_period * 0.12]
            if len(good) >= 8:
                refined = 60.0 / float(np.median(good))
                mad = float(np.median(np.abs(good - np.median(good))))
                stability = max(0.0, 1.0 - mad / max(median_period * 0.04, 1e-9))

    bpm = snap_musical_bpm(refined)
    period = 60.0 / max(bpm, 1e-6)
    offset = circular_phase(np.asarray(beat_times, dtype=float), period)

    local = librosa.feature.tempo(
        onset_envelope=onset,
        sr=sr,
        hop_length=hop,
        aggregate=None,
    )
    local = np.asarray(local, dtype=float)
    local = local[np.isfinite(local) & (local > 0)]
    spread = float(np.std(local) / np.mean(local)) if local.size else 1.0
    agreement = abs(bpm - float(track['bpm'])) / max(bpm, 1.0)
    confidence = max(
        0.0,
        min(
            1.0,
            0.55 * stability
            + 0.3 * (1 - min(1, spread * 5))
            + 0.15 * (1 - min(1, agreement * 8)),
        ),
    )

    return {
        'id': track['id'],
        'label': track['label'],
        'path': track['path'],
        'previousBpm': float(track['bpm']),
        'rawEstimatorBpm': round(tempo_raw, 4),
        'refinedBpm': round(refined, 4),
        'auditedBpm': bpm,
        'beatOffset': round(offset, 6),
        'detectedBeats': int(len(beat_times)),
        'confidence': round(confidence, 3),
        'changed': abs(float(track['bpm']) - bpm) > 0.05,
    }


def main():
    if len(sys.argv) != 2:
        raise SystemExit('usage: audit-dj-bpm.py tracks.json')
    tracks = json.loads(Path(sys.argv[1]).read_text())
    results = []
    for track in tracks:
        try:
            result = analyze(track)
            results.append(result)
            print(
                f"{result['id']:34} previous={result['previousBpm']:7.2f} "
                f"audited={result['auditedBpm']:7.2f} offset={result['beatOffset']:.4f}s "
                f"confidence={result['confidence']:.3f} beats={result['detectedBeats']}"
            )
        except Exception as exc:
            results.append(
                {'id': track['id'], 'label': track['label'], 'path': track['path'], 'error': str(exc)}
            )
            print(f"{track['id']:34} ERROR {exc}")
    Path('dj-bpm-audit.json').write_text(json.dumps(results, indent=2) + '\n')
    changed = [r for r in results if r.get('changed')]
    low = [r for r in results if 'confidence' in r and r['confidence'] < 0.72]
    print(f"\nAudited {len(results)} real DJ tracks; {len(changed)} BPM changes; {len(low)} low-confidence items.")


if __name__ == '__main__':
    main()
