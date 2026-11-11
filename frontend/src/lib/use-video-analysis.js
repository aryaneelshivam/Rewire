import { useCallback, useEffect, useRef, useState } from 'react';
import { changePoints } from './timeline-events';

const THUMB_W = 160, THUMB_H = 90;   // filmstrip frame
const GRID_W = 32, GRID_H = 18;      // tiny greyscale frame used to compare neighbours
const MAX_SAMPLES = 120;

const seek = (video, t) => new Promise(resolve => {
  const done = () => { video.removeEventListener('seeked', done); resolve(); };
  video.addEventListener('seeked', done);
  video.currentTime = t;
});

/** Mean absolute difference between two greyscale grids, 0 (same) to 1. */
function frameDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length / 255;
}

async function sampleFrames(url, duration, signal) {
  const video = document.createElement('video');
  // Saved runs stream from the backend's origin; CORS keeps the canvas readable so frames can be sampled.
  video.crossOrigin = 'anonymous';
  video.src = url; video.muted = true; video.playsInline = true; video.preload = 'auto';
  await new Promise((resolve, reject) => { video.onloadeddata = resolve; video.onerror = reject; });
  const length = Math.min(duration, Math.floor(video.duration) || duration);
  const step = Math.max(1, Math.ceil(length / MAX_SAMPLES));
  const thumb = Object.assign(document.createElement('canvas'), { width: THUMB_W, height: THUMB_H }).getContext('2d');
  const grid = Object.assign(document.createElement('canvas'), { width: GRID_W, height: GRID_H }).getContext('2d', { willReadFrequently: true });
  const frames = [], diffs = [];
  let previous = null;
  for (let t = 0; t < length; t += step) {
    if (signal.cancelled) return null;
    await seek(video, Math.min(t + 0.05, video.duration - 0.05));
    thumb.drawImage(video, 0, 0, THUMB_W, THUMB_H);
    frames.push({ t, src: thumb.canvas.toDataURL('image/jpeg', 0.6) });
    grid.drawImage(video, 0, 0, GRID_W, GRID_H);
    const rgba = grid.getImageData(0, 0, GRID_W, GRID_H).data;
    const grey = new Uint8ClampedArray(GRID_W * GRID_H);
    for (let i = 0; i < grey.length; i++) grey[i] = (rgba[i * 4] * 0.299 + rgba[i * 4 + 1] * 0.587 + rgba[i * 4 + 2] * 0.114);
    diffs.push(previous ? frameDistance(grey, previous) : 0);
    previous = grey;
  }
  // A cut is a frame jump well above the clip's usual motion and large in absolute terms.
  // changePoints reads steps between values, so feed it the running total: each step is then one frame difference.
  let total = 0;
  const running = diffs.map(d => (total += d));
  const cuts = changePoints(running, { sigmas: 1.2, minRatio: 0.12, gap: 1, limit: 24 }).map(i => i * step);
  return { frames, cuts, step };
}

async function soundChanges(url, duration, signal) {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return [];
  const buffer = await fetch(url).then(r => r.arrayBuffer());
  if (signal.cancelled) return null;
  const context = new Context();
  try {
    const audio = await context.decodeAudioData(buffer);
    const data = audio.getChannelData(0);
    const per = Math.floor(audio.sampleRate);
    const seconds = Math.min(duration, Math.floor(data.length / per));
    // Loudness per second in decibels, so a change reads the same at any level.
    const db = Array.from({ length: seconds }, (_, s) => {
      let sum = 0;
      for (let i = s * per; i < (s + 1) * per; i++) sum += data[i] * data[i];
      return 20 * Math.log10(Math.sqrt(sum / per) + 1e-5);
    });
    return changePoints(db, { sigmas: 1.5, minRatio: 6, gap: 2, limit: 6 });
  } catch {
    return [];
  } finally {
    context.close?.();
  }
}

const PENDING = { frames: [], cuts: [], sound: [], status: 'working' };
const IDLE = { frames: [], cuts: [], sound: [], status: 'idle' };

/**
 * Filmstrip frames, scene cuts and soundtrack changes for any number of local videos, each analysed once.
 * Everything runs in the browser; the files never leave it. Returns a lookup from a video URL to its result.
 */
export function useVideoAnalyses(urls, duration) {
  const [results, setResults] = useState({});
  const started = useRef(new Set());
  const key = urls.filter(Boolean).join('\n');
  useEffect(() => {
    let mounted = true;
    const signals = [];
    key.split('\n').filter(Boolean).forEach(url => {
      const id = `${url}@${duration}`;
      if (!duration || started.current.has(id)) return;
      started.current.add(id);
      const signal = { cancelled: false };
      signals.push(signal);
      Promise.all([
        sampleFrames(url, duration, signal).catch(() => null),
        soundChanges(url, duration, signal).catch(() => []),
      ]).then(([film, sound]) => {
        if (!mounted) return;
        setResults(map => ({ ...map, [id]: { frames: film?.frames ?? [], cuts: film?.cuts ?? [], sound: sound ?? [], status: film ? 'done' : 'failed' } }));
      });
    });
    // A changed set of videos restarts the work, so nothing finishes against a list that is gone.
    return () => { mounted = false; signals.forEach(sig => { sig.cancelled = true; }); started.current.clear(); };
  }, [key, duration]);
  return useCallback(url => (url ? results[`${url}@${duration}`] ?? PENDING : IDLE), [results, duration]);
}
