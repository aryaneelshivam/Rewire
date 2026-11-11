import React, { useState, useEffect } from 'react';
import { Skeleton } from '@/components/arc/skeleton/skeleton';
import { Button } from '@/components/arc/button/button';
import { SortableDataTable } from '@/components/arc/sortable-data-table/sortable-data-table';
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

  // One sortable list of both variants' peaks. Frames join each row once that variant's video is loaded.
  const rowsFor = (variant, snapshots, peaks) => {
    const frames = new Map(snapshots.map(sn => [sn.timestamp, sn.image]));
    return peaks.map(p => ({ id: `${variant}-${p.idx}`, time: p.idx, variant, peak: p.val, image: frames.get(p.idx) ?? null }));
  };
  const rows = [...rowsFor('A', snapshotsA, topPeaksA), ...rowsFor('B', snapshotsB, topPeaksB)];
  const processing = (isProcessingA && !snapshotsA.length) || (isProcessingB && !snapshotsB.length);

  const columns = [
    {
      key: 'time', label: 'Moment', numeric: false, width: 220,
      render: (t, r) => (
        <span className="moment">
          {r.image && <img src={r.image} alt="" />}
          <Button variant="ghost" size="sm" onClick={() => onSeekToTimestamp(t)} aria-label={`Move the playhead to ${fmt(t)}, Variant ${r.variant}`}>{fmt(t)}</Button>
        </span>
      ),
    },
    ...(overviewB ? [{ key: 'variant', label: 'Variant', render: v => <VariantTag v={v}>{`Variant ${v}`}</VariantTag> }] : []),
    { key: 'peak', label: 'Peak z', numeric: true, render: (v, r) => <span className={r.variant === 'B' ? 'num-b' : 'num-a'}>{v.toFixed(3)}</span> },
  ];

  return (
    <Card
      title={overviewB ? 'Strongest moments per variant' : 'Strongest moments'}
      exportName="key-moments"
      description={videoUrlA || videoUrlB
        ? `Six highest-activation seconds${overviewB ? ' per variant' : ''}. Select a time to move the playhead there.`
        : `Six highest-activation seconds${overviewB ? ' per variant' : ''}. Select a time to move the playhead there. Run a new analysis with the video to see each frame.`}
    >
      {processing ? (
        <Skeleton lines={4} label="Capturing frames" />
      ) : (
        <div className="flat-table moments-table">
          <SortableDataTable rows={rows} columns={columns} rowKey="id" defaultSort={{ key: 'peak', direction: 'desc' }} caption="Highest-activation moments for each variant" itemName={{ one: 'moment', other: 'moments' }} />
        </div>
      )}
    </Card>
  );
};

export default ImpactScenes;
