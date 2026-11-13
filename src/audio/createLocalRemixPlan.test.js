import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLocalRemixPlan,
  findTempoMatch,
  getTransitionStartTime,
  isCamelotCompatible,
  toCamelot,
} from './createLocalRemixPlan.js';

test('Camelot conversion and compatibility include adjacent and relative keys', () => {
  assert.deepEqual(toCamelot('C major'), { number: 8, mode: 'B' });
  assert.deepEqual(toCamelot('A minor'), { number: 8, mode: 'A' });
  assert.equal(isCamelotCompatible('C major', 'A minor'), true);
  assert.equal(isCamelotCompatible('C major', 'G major'), true);
  assert.equal(isCamelotCompatible('C major', 'D major'), false);
});

test('tempo matching accounts for half-time and double-time counts', () => {
  assert.equal(findTempoMatch(80, 160)?.difference, 0);
  assert.equal(findTempoMatch(80, 120), null);
});

test('transition planning shortens tempos that cannot be matched safely', () => {
  const plan = createLocalRemixPlan({
    trackA: { id: 'a', title: 'A', bpm: '80', key: 'C major' },
    trackB: { id: 'b', title: 'B', bpm: '120', key: 'D major' },
    style: 'festival',
  });
  assert.equal(plan.transitionBars, 8);
  assert.equal(plan.targetBpm, null);
});

test('transition timing uses the next available phrase boundary', () => {
  const track = { analysis: { phraseBoundaries: [0, 32, 64, 96] } };
  assert.equal(getTransitionStartTime(track, 30, 60), 32);
  assert.equal(getTransitionStartTime(track, 34, 60), 34);
});
