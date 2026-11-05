import React, { useState, useEffect } from 'react';
import { Camera, Zap, ChevronRight, Loader2, Sparkles, Eye, Film } from 'lucide-react';

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

  // Infer physiological neural driver tag
  const inferSceneTag = (ts, val) => {
    if (val > 3.5) return 'Surge: Executive & Reward';
    if (ts < 5) return 'Stimulus Onset & Visual Salience';
    if (ts % 2 === 0) return 'Audio-Visual Synchrony';
    return 'Narrative Immersion Peak';
  };

  const hasAnyVideo = videoUrlA || videoUrlB;

  if (!hasAnyVideo) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '64px 24px' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: 'var(--rounded-full)',
          backgroundColor: 'var(--surface-soft)',
          border: '1px solid var(--hairline)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <Film size={24} color="var(--charcoal)" />
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>Upload Stimulus Videos for Keyframe Extraction</h3>
        <p style={{ color: 'var(--body)', fontSize: '14px', maxWidth: '480px', margin: '8px auto 20px', lineHeight: 1.5 }}>
          Rewire chronometrically aligns video keyframes with localized BOLD fMRI resonance peaks to detect which creative visual cuts drive maximal neural imprint.
        </p>
        <div style={{ display: 'inline-flex', gap: '8px', padding: '6px 14px', borderRadius: 'var(--rounded-full)', background: 'var(--surface-soft)', border: '1px solid var(--hairline)', fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--charcoal)' }}>
          Supported: H.264 / MP4 · Upload in Left Panel Controls
        </div>
      </div>
    );
  }

  const isProcessing = (isProcessingA && snapshotsA.length === 0) || (isProcessingB && snapshotsB.length === 0);
  if (isProcessing) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '64px 24px' }}>
        <Loader2 className="animate-spin" size={28} style={{ color: '#000000', marginBottom: '16px' }} />
        <h3>Extracting Neural Peaks from Video Stream...</h3>
        <p style={{ color: 'var(--body)', fontSize: '14px', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
          Decoding keyframes at peak BOLD timestamps via HTML5 Canvas.
        </p>
      </div>
    );
  }

  const renderColumn = (label, isVariantA, snapshots, variant) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={isVariantA ? "variant-badge-a" : "variant-badge-b"}>{variant}</span>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>{label}</h3>
        </div>
        <span className="command-tag" style={{ fontSize: '10px' }}>
          {snapshots.length} Detected Peaks
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {snapshots.map((s, i) => {
          const tag = inferSceneTag(s.timestamp, s.activation);
          return (
            <div
              key={i}
              className="snapshot-card"
              onClick={() => onSeekToTimestamp(s.timestamp)}
              style={{
                boxShadow: 'var(--shadow-card)',
                transition: 'var(--transition-smooth)'
              }}
            >
              <div className="snapshot-image-container">
                <img src={s.image} alt={`Peak at ${s.timestamp}s`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div className="snapshot-time-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Eye size={10} />
                  <span>{Math.floor(s.timestamp / 60)}:{(s.timestamp % 60).toString().padStart(2, '0')}s</span>
                </div>
              </div>

              <div className="snapshot-info" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: isVariantA ? '#000000' : '#525252',
                    fontFamily: 'var(--font-mono)',
                    backgroundColor: 'var(--surface-soft)',
                    padding: '2px 8px',
                    borderRadius: 'var(--rounded-full)',
                    border: '1px solid var(--hairline)'
                  }}>
                    {tag}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>
                    t={s.timestamp}s
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--mute)', display: 'block', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                      Peak BOLD z
                    </span>
                    <span style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>
                      +{s.activation.toFixed(3)}
                    </span>
                  </div>

                  <button className="pill-btn" style={{ height: '26px', fontSize: '11px', padding: '0 10px' }}>
                    Seek Cortex <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span className="command-tag" style={{ fontSize: '10px', padding: '2px 8px' }}>
            KEYFRAME BENCHMARKING
          </span>
          <span style={{ fontSize: '11px', color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>
            Maximal Cortical Intensity Synchronization
          </span>
        </div>
        <h2>High Impact Moments — A/B Stimulus Comparison</h2>
        <p style={{ color: 'var(--body)', fontSize: '13px', marginTop: '2px' }}>
          Keyframes extracted at peaks of cortical resonance. Click any moment to jump the video and 3D cortex mesh to that exact timestamp.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        {snapshotsA.length > 0 ? (
          renderColumn('Variant A Keyframes', true, snapshotsA, 'A')
        ) : (
          <div style={{ flex: 1, textAlign: 'center', padding: '40px 20px', color: 'var(--mute)', fontSize: '13px', border: '1px dashed var(--hairline)', borderRadius: '12px' }}>
            {videoUrlA ? 'Extracting Variant A Keyframes...' : 'Upload Video A in left panel to extract peak keyframes'}
          </div>
        )}

        {snapshotsB.length > 0 ? (
          renderColumn('Variant B Keyframes', false, snapshotsB, 'B')
        ) : (
          <div style={{ flex: 1, textAlign: 'center', padding: '40px 20px', color: 'var(--mute)', fontSize: '13px', border: '1px dashed var(--hairline)', borderRadius: '12px' }}>
            {videoUrlB ? 'Extracting Variant B Keyframes...' : 'Upload Video B in left panel to extract peak keyframes'}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImpactScenes;
