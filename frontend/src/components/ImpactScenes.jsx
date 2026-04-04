import React, { useState, useEffect, useRef } from 'react';
import { Camera, Zap, ChevronRight, Loader2 } from 'lucide-react';

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

    const newSnapshots = [];
    await new Promise(resolve => { video.onloadedmetadata = resolve; });

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth / 2;
    canvas.height = video.videoHeight / 2;
    const ctx = canvas.getContext('2d');

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
  }, [videoUrlA, topPeaksA]);

  useEffect(() => {
    if (videoUrlB && topPeaksB.length > 0 && snapshotsB.length === 0) {
      captureSnapshots(videoUrlB, topPeaksB, setSnapshotsB, setIsProcessingB);
    }
  }, [videoUrlB, topPeaksB]);

  const hasAnyVideo = videoUrlA || videoUrlB;

  if (!hasAnyVideo) {
    return (
      <div className="glass-card animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <Camera size={48} style={{ color: 'var(--text-tertiary)', marginBottom: '1.5rem', opacity: 0.2 }} />
        <h3 style={{ color: 'var(--text-secondary)' }}>Upload videos to analyze High Impact Scenes</h3>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', maxWidth: '400px', margin: '0.8rem auto' }}>
          Rewire identifies moments of peak cortical engagement and captures them for A/B visual comparison.
        </p>
      </div>
    );
  }

  const isProcessing = (isProcessingA && snapshotsA.length === 0) || (isProcessingB && snapshotsB.length === 0);
  if (isProcessing) {
    return (
      <div className="glass-card animate-fade-in" style={{ textAlign: 'center', padding: '6rem 2rem' }}>
        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-orange)', marginBottom: '1.5rem' }} />
        <h3>Extracting Neural Peaks...</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.5rem' }}>
          Capturing high-intensity frames from both stimulus videos.
        </p>
      </div>
    );
  }

  const renderColumn = (label, color, snapshots, variant) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <div className={`variant-badge-${variant.toLowerCase()}`} style={{ fontSize: '0.7rem', fontWeight: 700 }}>{variant}</div>
        <h3 style={{ fontSize: '1rem', color }}>{label}</h3>
        <span className="badge" style={{ backgroundColor: `${color}22`, color, fontSize: '0.7rem' }}>{snapshots.length} Peaks</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {snapshots.map((s, i) => (
          <div key={i} className="snapshot-card glass-card" onClick={() => onSeekToTimestamp(s.timestamp)} style={{ cursor: 'pointer' }}>
            <div className="snapshot-image-container">
              <img src={s.image} alt={`Peak at ${s.timestamp}s`} />
              <div className="snapshot-overlay">
                <button className="view-moment-btn">
                  ANALYZE <ChevronRight size={14} />
                </button>
              </div>
              <div className="snapshot-time-badge">
                {Math.floor(s.timestamp / 60)}:{(s.timestamp % 60).toString().padStart(2, '0')}s
              </div>
            </div>
            <div className="snapshot-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <Zap size={14} style={{ color }} />
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Peak Intensity</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'Outfit', color }}>{s.activation.toFixed(3)}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Global Max</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>High Impact Moments — A/B</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Side-by-side neural peak comparison.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem' }}>
        {snapshotsA.length > 0 ? renderColumn('Variant A', '#E85D24', snapshotsA, 'A') : (
          <div style={{ flex: 1, textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
            {videoUrlA ? 'Processing...' : 'Upload Video A to see peaks'}
          </div>
        )}
        {snapshotsB.length > 0 ? renderColumn('Variant B', '#7F77DD', snapshotsB, 'B') : (
          <div style={{ flex: 1, textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
            {videoUrlB ? 'Processing...' : 'Upload Video B to see peaks'}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImpactScenes;
