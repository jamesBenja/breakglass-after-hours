import test from 'node:test';
import assert from 'node:assert/strict';
import { crowdEngagementScore, formatSetDuration } from '../src/gameplay/GameStatsSystem.js';
import { validateSave } from '../src/state/GameState.js';
import { normalizeStudioSession } from '../src/studio/StudioSession.js';
import { levels } from '../src/world/levels.js';

test('bar scoreboard and Take A Break song player are discoverable interactions', () => {
  assert.equal(levels.downstairs.anchors.scoreboard.action, 'scoreboard');
  assert.ok(levels.downstairs.anchors.scoreboard.position[0] < -6);
  assert.equal(levels.downstairs.anchors.studioSongPlayer.action, 'studioSongPlayer');
  assert.ok(levels.downstairs.anchors.studioSongPlayer.position[0] > 6);
});

test('studio kitchen has an interactive espresso machine', () => {
  assert.equal(levels.upstairs.anchors.coffeeMachine.action, 'coffee');
});

test('crowd engagement rewards a dancing, high-vibe, well-mixed room', () => {
  const strong = crowdEngagementScore({
    attendance: 100,
    danceFloor: 86,
    vibe: 0.9,
    mixQuality: 0.92,
  });
  const weak = crowdEngagementScore({
    attendance: 100,
    danceFloor: 18,
    vibe: 0.25,
    mixQuality: 0.4,
  });
  assert.ok(strong > weak);
  assert.ok(strong <= 100);
  assert.equal(formatSetDuration(125), '2:05');
});

test('game records and saved loop songs survive save validation', () => {
  const saved = validateSave({
    version: 1,
    sceneId: 'downstairs',
    gameStats: {
      walkingMeters: 740,
      peakCrowdEngagement: 91,
      peakDanceFloorCount: 72,
      djLongestByName: {
        'house:hydra': { label: 'Hydra', seconds: 845 },
      },
    },
    studioSongs: [
      {
        id: 'song-1',
        name: 'Night loop',
        savedAt: 1234,
        session: {
          name: 'Night loop',
          bpm: 124,
          loopEnabled: true,
          loopBars: 8,
          quantize: '1/8',
          swing: 0.12,
        },
      },
    ],
  });
  assert.equal(saved.gameStats.walkingMeters, 740);
  assert.equal(saved.gameStats.djLongestByName['house:hydra'].seconds, 845);
  assert.equal(saved.studioSongs.length, 1);
  assert.equal(saved.studioSongs[0].session.loopBars, 8);
  assert.equal(saved.studioSongs[0].session.loopEnabled, true);
});

test('studio session normalization preserves loop-builder settings', () => {
  const session = normalizeStudioSession({
    bpm: 126,
    loopEnabled: true,
    loopBars: 16,
    quantize: '1/4',
    swing: 0.24,
  });
  assert.equal(session.loopEnabled, true);
  assert.equal(session.loopBars, 16);
  assert.equal(session.quantize, '1/4');
  assert.equal(session.swing, 0.24);
});
