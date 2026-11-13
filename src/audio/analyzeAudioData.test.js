import test from 'node:test';
import assert from 'node:assert/strict';
import { ANALYSIS_SAMPLE_RATE, analyzePcm } from './analyzeAudioData.js';

test('analysis estimates the tempo and returns a phase-aligned beat grid', () => {
  const duration = 20;
  const samples = new Float32Array(ANALYSIS_SAMPLE_RATE * duration);
  const samplesPerBeat = ANALYSIS_SAMPLE_RATE * 0.5;
  for (let beat = 0; beat * 0.5 < duration; beat += 1) {
    const start = Math.round(beat * samplesPerBeat);
    for (let offset = 0; offset < ANALYSIS_SAMPLE_RATE * 0.04; offset += 1) {
      samples[start + offset] = Math.sin((2 * Math.PI * 880 * offset) / ANALYSIS_SAMPLE_RATE);
    }
  }

  const analysis = analyzePcm(samples, duration);
  assert.equal(analysis.bpm, 120);
  assert.ok(analysis.bpmConfidence > 0);
  assert.ok(analysis.beatTimes.length >= 38);
  assert.ok(Math.abs((analysis.beatTimes[1] - analysis.beatTimes[0]) - 0.5) < 0.02);
  assert.ok(analysis.phraseBoundaries.length > 0);
  assert.equal(analysis.peaks.length, 400);
});

test('analysis reports missing tempo for silence rather than inventing a beat grid', () => {
  const analysis = analyzePcm(new Float32Array(ANALYSIS_SAMPLE_RATE * 8), 8);
  assert.equal(analysis.bpm, null);
  assert.equal(analysis.beatTimes.length, 0);
  assert.equal(analysis.phraseBoundaries.length, 0);
});
