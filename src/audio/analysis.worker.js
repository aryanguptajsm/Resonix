import { analyzePcm } from './analyzeAudioData.js';

self.onmessage = (event) => {
  const { id, samples, duration } = event.data;
  try {
    const analysis = analyzePcm(new Float32Array(samples), duration);
    self.postMessage({ id, analysis }, [analysis.peaks.buffer]);
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : 'Audio analysis failed.',
    });
  }
};
