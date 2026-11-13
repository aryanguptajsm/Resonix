import { getSavedTrackAnalysis, saveTrackAnalysis } from './libraryStore.js';
import { ANALYSIS_SAMPLE_RATE } from './analyzeAudioData.js';

const MAX_DECODED_BYTES = 192 * 1024 * 1024;
const analysisQueue = [];
let isAnalyzing = false;

function hashEncodedAudio(encodedAudio) {
  if (!window.crypto?.subtle) return Promise.resolve(null);
  return window.crypto.subtle.digest('SHA-256', encodedAudio).then((digest) => (
    Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  ));
}

function downmixAndResample(audioBuffer) {
  const sampleCount = Math.floor(audioBuffer.duration * ANALYSIS_SAMPLE_RATE);
  const monoSamples = new Float32Array(sampleCount);
  const sourceChannels = Array.from(
    { length: audioBuffer.numberOfChannels },
    (_, channel) => audioBuffer.getChannelData(channel),
  );
  const sourceSamplesPerOutput = audioBuffer.sampleRate / ANALYSIS_SAMPLE_RATE;

  for (let outputIndex = 0; outputIndex < sampleCount; outputIndex += 1) {
    const sourceStart = Math.floor(outputIndex * sourceSamplesPerOutput);
    const sourceEnd = Math.min(
      audioBuffer.length,
      Math.max(sourceStart + 1, Math.floor((outputIndex + 1) * sourceSamplesPerOutput)),
    );
    let total = 0;
    let sampleCountInWindow = 0;
    for (const channel of sourceChannels) {
      for (let sourceIndex = sourceStart; sourceIndex < sourceEnd; sourceIndex += 1) {
        total += channel[sourceIndex];
        sampleCountInWindow += 1;
      }
    }
    monoSamples[outputIndex] = total / Math.max(1, sampleCountInWindow);
  }
  return monoSamples;
}

function runWorkerAnalysis(samples, duration) {
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL('./analysis.worker.js', import.meta.url), { type: 'module' });
    } catch (error) {
      reject(new Error(`Could not start the audio analysis worker: ${error.message}`));
      return;
    }

    const requestId = crypto.randomUUID();
    worker.onmessage = (event) => {
      if (event.data.id !== requestId) return;
      worker.terminate();
      if (event.data.error) {
        reject(new Error(event.data.error));
        return;
      }
      resolve(event.data.analysis);
    };
    worker.onerror = (error) => {
      worker.terminate();
      reject(new Error(`Audio analysis worker failed: ${error.message || 'unknown worker error.'}`));
    };
    worker.postMessage({ id: requestId, samples: samples.buffer, duration }, [samples.buffer]);
  });
}

async function analyzeFile(file, duration) {
  const estimatedDecodedBytes = duration * 48_000 * 2 * Float32Array.BYTES_PER_ELEMENT;
  if (estimatedDecodedBytes > MAX_DECODED_BYTES) {
    throw new Error('This track is too long for waveform analysis. Playback and seeking are still available.');
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Web Audio API is not available for local waveform analysis in this browser.');
  }

  const encodedAudio = await file.arrayBuffer();
  const cacheKey = await hashEncodedAudio(encodedAudio);
  if (cacheKey) {
    const cached = await getSavedTrackAnalysis(cacheKey);
    if (cached?.version === 1) {
      return { ...cached, peaks: new Float32Array(cached.peaks) };
    }
  }

  const context = new AudioContextClass();
  let audioBuffer;
  try {
    audioBuffer = await context.decodeAudioData(encodedAudio.slice(0));
  } finally {
    await context.close();
  }

  const analysis = await runWorkerAnalysis(downmixAndResample(audioBuffer), duration);
  if (cacheKey) {
    try {
      await saveTrackAnalysis(cacheKey, { ...analysis, version: 1 });
    } catch (error) {
      analysis.cacheError = error.message || 'Could not save this audio analysis.';
    }
  }
  return analysis;
}

function processNextAnalysis() {
  if (isAnalyzing || analysisQueue.length === 0) return;
  isAnalyzing = true;
  const { file, duration, resolve, reject } = analysisQueue.shift();
  analyzeFile(file, duration).then(resolve, reject).finally(() => {
    isAnalyzing = false;
    processNextAnalysis();
  });
}

export function analyzeAudioFile(file, duration) {
  return new Promise((resolve, reject) => {
    analysisQueue.push({ file, duration, resolve, reject });
    processNextAnalysis();
  });
}
