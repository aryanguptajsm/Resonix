const ANALYSIS_SAMPLE_RATE = 11_025;
const BPM_FRAME_RATE = 100;
const BPM_MAX_SECONDS = 120;
const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function calculateRmsFrames(samples) {
  const frameSize = Math.max(1, Math.round(ANALYSIS_SAMPLE_RATE / BPM_FRAME_RATE));
  const frameCount = Math.min(
    Math.floor(samples.length / frameSize),
    BPM_MAX_SECONDS * BPM_FRAME_RATE,
  );
  const rms = new Float32Array(frameCount);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * frameSize;
    const end = Math.min(samples.length, start + frameSize);
    let sum = 0;
    for (let sample = start; sample < end; sample += 1) {
      sum += samples[sample] * samples[sample];
    }
    rms[frame] = Math.sqrt(sum / Math.max(1, end - start));
  }
  return rms;
}

function calculateOnsetStrength(rms) {
  const onset = new Float32Array(rms.length);
  for (let frame = 1; frame < rms.length; frame += 1) {
    onset[frame] = Math.max(0, rms[frame] - rms[frame - 1]);
  }
  return onset;
}

function findBestPeriod(onset) {
  if (onset.length < BPM_FRAME_RATE * 5) return null;

  const minimumLag = Math.floor((60 * BPM_FRAME_RATE) / 180);
  const maximumLag = Math.ceil((60 * BPM_FRAME_RATE) / 70);
  const scores = new Float64Array(maximumLag + 1);
  let bestLag = 0;
  let bestScore = 0;
  let scoreTotal = 0;
  let scoreCount = 0;

  for (let lag = minimumLag; lag <= maximumLag; lag += 1) {
    let dotProduct = 0;
    let currentEnergy = 0;
    let delayedEnergy = 0;
    for (let frame = lag; frame < onset.length; frame += 1) {
      const current = onset[frame];
      const delayed = onset[frame - lag];
      dotProduct += current * delayed;
      currentEnergy += current * current;
      delayedEnergy += delayed * delayed;
    }

    const denominator = Math.sqrt(currentEnergy * delayedEnergy);
    const score = denominator ? dotProduct / denominator : 0;
    scores[lag] = score;
    scoreTotal += score;
    scoreCount += 1;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  if (!bestLag || bestScore < 0.08) return null;

  const before = scores[bestLag - 1] || 0;
  const after = scores[bestLag + 1] || 0;
  const curvature = before - (2 * bestScore) + after;
  const correction = curvature
    ? Math.max(-0.5, Math.min(0.5, 0.5 * (before - after) / curvature))
    : 0;
  const period = bestLag + correction;
  const meanScore = scoreTotal / Math.max(1, scoreCount);
  const confidence = Math.max(0, Math.min(1, (bestScore - meanScore) / (1 - meanScore)));

  let phase = 0;
  let phaseScore = -1;
  for (let offset = 0; offset < bestLag; offset += 1) {
    let score = 0;
    for (let frame = offset; frame < onset.length; frame += bestLag) {
      score += onset[frame];
    }
    if (score > phaseScore) {
      phaseScore = score;
      phase = offset;
    }
  }

  return { period, confidence, phase: phase / BPM_FRAME_RATE };
}

function goertzelPower(samples, start, window, frequency) {
  const coefficient = 2 * Math.cos((2 * Math.PI * frequency) / ANALYSIS_SAMPLE_RATE);
  let previous = 0;
  let previousPrevious = 0;
  for (let index = 0; index < window.length; index += 1) {
    const current = (samples[start + index] || 0) * window[index]
      + (coefficient * previous)
      - previousPrevious;
    previousPrevious = previous;
    previous = current;
  }
  return Math.max(0, previous * previous + previousPrevious * previousPrevious
    - (coefficient * previous * previousPrevious));
}

function correlation(first, second) {
  const firstMean = first.reduce((sum, value) => sum + value, 0) / first.length;
  const secondMean = second.reduce((sum, value) => sum + value, 0) / second.length;
  let numerator = 0;
  let firstVariance = 0;
  let secondVariance = 0;
  for (let index = 0; index < first.length; index += 1) {
    const firstDelta = first[index] - firstMean;
    const secondDelta = second[index] - secondMean;
    numerator += firstDelta * secondDelta;
    firstVariance += firstDelta * firstDelta;
    secondVariance += secondDelta * secondDelta;
  }
  const denominator = Math.sqrt(firstVariance * secondVariance);
  return denominator ? numerator / denominator : 0;
}

function detectKey(samples) {
  const windowSize = 2048;
  const hannWindow = new Float32Array(windowSize);
  for (let index = 0; index < windowSize; index += 1) {
    hannWindow[index] = 0.5 - (0.5 * Math.cos((2 * Math.PI * index) / (windowSize - 1)));
  }
  const windowStride = Math.round(ANALYSIS_SAMPLE_RATE * 0.8);
  const maximumStart = Math.min(samples.length - windowSize, ANALYSIS_SAMPLE_RATE * 45);
  if (maximumStart < 0) return { key: null, confidence: 0 };

  const chroma = new Array(12).fill(0);
  let windowCount = 0;
  for (let start = 0; start <= maximumStart; start += windowStride) {
    for (let midi = 36; midi <= 84; midi += 1) {
      const frequency = 440 * (2 ** ((midi - 69) / 12));
      if (frequency >= ANALYSIS_SAMPLE_RATE / 2) continue;
      chroma[midi % 12] += Math.sqrt(goertzelPower(samples, start, hannWindow, frequency));
    }
    windowCount += 1;
  }
  if (!windowCount) return { key: null, confidence: 0 };
  if (chroma.every((value) => value === 0)) return { key: null, confidence: 0 };

  let best = { score: -Infinity, key: null };
  let secondBest = -Infinity;
  for (let root = 0; root < 12; root += 1) {
    for (const [mode, profile] of [['major', MAJOR_PROFILE], ['minor', MINOR_PROFILE]]) {
      const rotatedProfile = profile.map((_, pitchClass) => profile[(pitchClass - root + 12) % 12]);
      const score = correlation(chroma, rotatedProfile);
      if (score > best.score) {
        secondBest = best.score;
        best = { score, key: `${KEY_NAMES[root]} ${mode}` };
      } else if (score > secondBest) {
        secondBest = score;
      }
    }
  }

  return {
    key: best.key,
    confidence: Math.max(0, Math.round((best.score - secondBest) * 100)),
  };
}

function makeBeatGrid(period, phase, duration) {
  if (!period || !Number.isFinite(duration) || duration <= 0) {
    return { beatTimes: [], downbeats: [], phraseBoundaries: [] };
  }

  const beatDuration = period / BPM_FRAME_RATE;
  const beatTimes = [];
  for (let time = phase; time < duration; time += beatDuration) {
    beatTimes.push(Number(time.toFixed(4)));
  }
  return {
    beatTimes,
    downbeats: beatTimes.filter((_, index) => index % 4 === 0),
    phraseBoundaries: beatTimes.filter((_, index) => index % 16 === 0),
  };
}

function makeEnergySummary(rms, beatPeriod, duration) {
  if (!rms.length || !beatPeriod) {
    return { energyCurve: [], introEnd: null, outroStart: null, dropTime: null };
  }

  const framesPerBar = Math.max(1, Math.round(beatPeriod * 4));
  const energyCurve = [];
  for (let start = 0; start < rms.length; start += framesPerBar) {
    const end = Math.min(rms.length, start + framesPerBar);
    let total = 0;
    for (let frame = start; frame < end; frame += 1) total += rms[frame];
    energyCurve.push(total / Math.max(1, end - start));
  }

  const sortedEnergy = [...energyCurve].sort((a, b) => a - b);
  const median = sortedEnergy[Math.floor(sortedEnergy.length / 2)] || 0;
  const threshold = median * 0.65;
  let introBars = 0;
  while (introBars < energyCurve.length && energyCurve[introBars] < threshold) introBars += 1;
  let outroBars = 0;
  while (
    outroBars < energyCurve.length
    && energyCurve[energyCurve.length - 1 - outroBars] < threshold
  ) outroBars += 1;

  let peakBar = 0;
  energyCurve.forEach((value, index) => {
    if (value > energyCurve[peakBar]) peakBar = index;
  });
  const secondsPerBar = (beatPeriod / BPM_FRAME_RATE) * 4;
  const analysisLength = rms.length / BPM_FRAME_RATE;
  return {
    energyCurve,
    introEnd: introBars ? Math.min(duration, introBars * secondsPerBar) : null,
    outroStart: outroBars ? Math.max(0, analysisLength - (outroBars * secondsPerBar)) : null,
    dropTime: peakBar * secondsPerBar,
  };
}

export function analyzePcm(samples, duration) {
  const peakSamples = Math.max(1, Math.round(ANALYSIS_SAMPLE_RATE / 20));
  const peaks = new Float32Array(Math.ceil(samples.length / peakSamples));
  for (let window = 0; window < peaks.length; window += 1) {
    const start = window * peakSamples;
    const end = Math.min(samples.length, start + peakSamples);
    let peak = 0;
    for (let sample = start; sample < end; sample += 1) {
      peak = Math.max(peak, Math.abs(samples[sample]));
    }
    peaks[window] = peak;
  }

  const rms = calculateRmsFrames(samples);
  const onset = calculateOnsetStrength(rms);
  const tempo = findBestPeriod(onset);
  const bpm = tempo ? Math.round((60 * BPM_FRAME_RATE * 10) / tempo.period) / 10 : null;
  const beatGrid = makeBeatGrid(tempo?.period, tempo?.phase || 0, duration);
  const key = detectKey(samples);
  return {
    peaks,
    bpm,
    bpmConfidence: tempo ? Math.round(tempo.confidence * 100) : 0,
    beatTimes: beatGrid.beatTimes,
    downbeats: beatGrid.downbeats,
    phraseBoundaries: beatGrid.phraseBoundaries,
    ...key,
    ...makeEnergySummary(rms, tempo?.period, duration),
  };
}

export { ANALYSIS_SAMPLE_RATE };
