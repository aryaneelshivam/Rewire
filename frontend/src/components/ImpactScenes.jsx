import React, { useState, useEffect } from 'react';
import { Skeleton } from '@/components/arc/skeleton/skeleton';
import { Card, VariantTag } from './ui';

const ImpactScenes = ({ videoUrlA, videoUrlB, overviewA, overviewB, onSeekToTimestamp }) => {
  const [snapshotsA, setSnapshotsA] = useState([]);
  const [snapshotsB, setSnapshotsB] = useState([]);
  const [isProcessingA, setIsProcessingA] = useState(false);
  const [isProcessingB, setIsProcessingB] = useState(false);

  // Identify top 6 peaks for each variant
  const getTopPeaks = (overview) => {
    if (!overview || !overview.timestep_metrics?.global_max) return [];
    const metrics = overview.timestep_metrics.global_max;
    const allPeaks = metrics.map((val, idx) => ({ val, idx }));
    const filteredPeaks = [];
    const sorted = [...allPeaks].sort((a, b) => b.val - a.val);
    for (const p of sorted) {
      if (filteredPeaks.length >= 6) break;
      if (!filteredPeaks.some(fp => Math.abs(fp.idx - p.idx) < 3)) {
        filteredPeaks.push(p);
      }
    }
    return filteredPeaks.sort((a, b) => a.idx - b.idx);
  };

  const topPeaksA = React.useMemo(() => getTopPeaks(overviewA), [overviewA]);
  const topPeaksB = React.useMemo(() => getTopPeaks(overviewB), [overviewB]);

  const captureSnapshots = async (videoUrl, peaks, setSnapshots, setIsProcessing) => {
    if (!videoUrl || peaks.length === 0) return;
    setIsProcessing(true);
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;

    await new Promise(resolve => { video.onloadedmetadata = resolve; });

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth / 2;
    canvas.height = video.videoHeight / 2;
    const ctx = canvas.getContext('2d');

    const newSnapshots = [];
    for (const peak of peaks) {
      video.currentTime = peak.idx;
      await new Promise(resolve => {
        const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
        video.addEventListener('seeked', onSeeked);
      });
      await new Promise(r => setTimeout(r, 100));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      newSnapshots.push({
        timestamp: peak.idx,
        activation: peak.val,
        image: canvas.toDataURL('image/jpeg', 0.8)
      });
    }
    setSnapshots(newSnapshots);
    setIsProcessing(false);
  };

  useEffect(() => {
    if (videoUrlA && topPeaksA.length > 0 && snapshotsA.length === 0) {
      captureSnapshots(videoUrlA, topPeaksA, setSnapshotsA, setIsProcessingA);
    }
  }, [videoUrlA, topPeaksA, snapshotsA.length]);

  useEffect(() => {
    if (videoUrlB && topPeaksB.length > 0 && snapshotsB.length === 0) {
      captureSnapshots(videoUrlB, topPeaksB, setSnapshotsB, setIsProcessingB);
    }
  }, [videoUrlB, topPeaksB, snapshotsB.length]);

  const fmt = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;

  // Frames once a video is loaded; until then, the peak moments themselves.
  const column = (variant, videoUrl, snapshots, peaks, processing) => {
    const items = snapshots.length ? snapshots : peaks.map(p => ({ timestamp: p.idx, activation: p.val, image: null }));
    return (
      <div>
        <div className="scene-col-head">
          <h3><VariantTag v={variant} /> Variant {variant} <span className="muted">peak z-score and time</span></h3>

        </div>
        {processing && !snapshots.length ? (
          <Skeleton lines={4} label="Capturing frames" />
        ) : (
          <div className="scene-list">
            {[...items].sort((a, b) => b.activation - a.activation).map(s => (
              <button key={s.timestamp} type="button" className={`scene ${s.image ? '' : 'no-img'}`} onClick={() => onSeekToTimestamp(s.timestamp)} title="Jump to this moment">
                {s.image && <img src={s.image} alt={`Variant ${variant} at ${s.timestamp}s`} />}
                <div className="scene-meta">
                  <strong>{s.activation.toFixed(3)}</strong>
                </div>
                <span className="scene-time">{fmt(s.timestamp)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card
      title="Strongest moments per variant"
      exportName="key-moments"
      description={videoUrlA || videoUrlB
        ? 'Six highest-activation seconds per variant. Select one to move the playhead there.'
        : 'Six highest-activation seconds per variant. Select one to move the playhead there. Add the videos in the cortex monitor to see each frame.'}
    >
      <div className="scene-cols">
        {column('A', videoUrlA, snapshotsA, topPeaksA, isProcessingA)}
        {column('B', videoUrlB, snapshotsB, topPeaksB, isProcessingB)}
      </div>
    </Card>
  );
};

export default ImpactScenes;
