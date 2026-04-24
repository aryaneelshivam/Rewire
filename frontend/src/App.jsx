import React, { useState, useEffect, useRef } from 'react';
import {
  fetchStatus, fetchOverview, fetchEngagement, fetchTopRois,
  fetchTimeSeries, fetchHeatmap, fetchDemographics, fetchABSummary
} from './api';
import UploadDataScreen from './components/UploadDataScreen';
import OverviewPanel from './components/OverviewPanel';
import EngagementPanel from './components/EngagementPanel';
import TopRoisPanel from './components/TopRoisPanel';
import DemoTimeSeries from './components/DemoTimeSeries';
import VarianceHeatmap from './components/VarianceHeatmap';
import BrainViewer3D from './components/BrainViewer3D';
import HeadSilhouette from './components/HeadSilhouette';
import AsymmetryPanel from './components/AsymmetryPanel';
import ImpactScenes from './components/ImpactScenes';
import LivePulsePanel from './components/LivePulsePanel';
import ABSummaryPanel from './components/ABSummaryPanel';
import DimensionalLeadPanel from './components/DimensionalLeadPanel';
import { Brain, Sparkles, ExternalLink, Play, Pause, Upload, Video, Zap, SkipBack, SkipForward, FlaskConical, ArrowLeftRight, FileText, Download, RotateCcw } from 'lucide-react';
import ReportView from './components/ReportView';



function App() {
  const [loading, setLoading] = useState(true);
  const [awaitingUpload, setAwaitingUpload] = useState(false);
  // All data now has .A and .B sub-objects
  const [overview, setOverview] = useState(null);
  const [engagement, setEngagement] = useState(null);
  const [topRois, setTopRois] = useState(null);
  const [timeSeries, setTimeSeries] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [demographics, setDemographics] = useState(null);
  const [abSummary, setAbSummary] = useState(null);

  const [activeTab, setActiveTab] = useState('browse');
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [brainDemographic, setBrainDemographic] = useState('baseline');
  const [brainVariant, setBrainVariant] = useState('A');

  // Dual video support
  const [videoUrlA, setVideoUrlA] = useState(null);
  const [videoUrlB, setVideoUrlB] = useState(null);
  const vRefA = useRef(null);
  const vRefB = useRef(null);
  const brainRef = useRef(null);

  // Report Generation State
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportSnapshots, setReportSnapshots] = useState({ A: null, B: null });

  const handleGenerateReport = async () => {
    if (isGeneratingReport) return;
    setIsGeneratingReport(true);
    const prevTab = activeTab;
    const prevVariant = brainVariant;
    const prevTime = currentTime;

    try {
      console.log("📊 Starting Report Generation...");

      // 1. Ensure we have the latest data
      const [sum, eng, rois] = await Promise.all([
        fetchABSummary(),
        fetchEngagement(),
        fetchTopRois()
      ]);

      if (!rois?.A || !rois?.B || !overview?.A || !overview?.B) {
        throw new Error("Neural data is still loading or incomplete.");
      }

      // 2. Automated Capture Sequence
      setActiveTab('explore');
      const snaps = { A: null, B: null };

      // Snapshot A
      try {
        console.log("📸 Capturing Variant A...");
        setBrainVariant('A');
        const peakA = rois.A.rois?.[0]?.peak_timestep || 0;
        const maxA = overview.A.n_timesteps || 1;
        const safePeakA = Math.max(0, Math.min(Math.floor(peakA), maxA - 1));

        setCurrentTime(safePeakA);
        await new Promise(r => setTimeout(r, 1200)); // Wait for API + WebGL
        snaps.A = brainRef.current?.getSnapshot();
      } catch (e) { console.warn("A Snapshot failed", e); }

      // Snapshot B
      try {
        console.log("📸 Capturing Variant B...");
        setBrainVariant('B');
        const peakB = rois.B.rois?.[0]?.peak_timestep || 0;
        const maxB = overview.B.n_timesteps || 1;
        const safePeakB = Math.max(0, Math.min(Math.floor(peakB), maxB - 1));

        setCurrentTime(safePeakB);
        await new Promise(r => setTimeout(r, 1200)); // Wait for API + WebGL
        snaps.B = brainRef.current?.getSnapshot();
      } catch (e) { console.warn("B Snapshot failed", e); }

      console.log("✅ Report Ready!");
      setReportSnapshots(snaps);
      setReportData({ summary: sum, engagement: eng, topRois: rois, overview: overview });
    } catch (err) {
      console.error("❌ Report Generation Error:", err);
      alert(err.message || "Failed to generate report. Please try again.");
    } finally {
      // Restore state
      setActiveTab(prevTab);
      setBrainVariant(prevVariant);
      setCurrentTime(prevTime);
      setIsGeneratingReport(false);
    }
  };

  const handleFileChange = (variant) => (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'video/mp4') {
      const url = URL.createObjectURL(file);
      if (variant === 'A') setVideoUrlA(url);
      else setVideoUrlB(url);
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const handleTimeUpdate = () => {
    // Use whichever video ref is active as the time source
    const ref = vRefA.current || vRefB.current;
    if (ref) {
      const maxT = Math.max(overview?.A?.n_timesteps || 1, overview?.B?.n_timesteps || 1);
      const t = Math.floor(ref.currentTime);
      if (t < maxT) {
        setCurrentTime(t);
      }
    }
  };

  const togglePlayback = () => {
    const refs = [vRefA, vRefB].filter(r => r.current);
    if (isPlaying) {
      refs.forEach(r => r.current.pause());
    } else {
      refs.forEach(r => r.current.play());
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeekToTimestamp = (t) => {
    const maxT = Math.max(overview?.A?.n_timesteps || 1, overview?.B?.n_timesteps || 1) - 1;
    const clampedT = Math.max(0, Math.min(t, maxT));
    [vRefA, vRefB].forEach(r => {
      if (r.current) {
        r.current.currentTime = clampedT;
      }
    });
    setCurrentTime(clampedT);
  };

  const skipForward = () => handleSeekToTimestamp(currentTime + 10);
  const skipBackward = () => handleSeekToTimestamp(currentTime - 10);

  const loadData = async () => {
    setLoading(true);
    try {
      const status = await fetchStatus();
      if (!status.loaded) {
        setAwaitingUpload(true);
        setLoading(false);
        return;
      }

      setAwaitingUpload(false);
      const [ov, en, tr, ts, hm, dm, ab] = await Promise.all([
        fetchOverview(), fetchEngagement(), fetchTopRois(),
        fetchTimeSeries(), fetchHeatmap(), fetchDemographics(), fetchABSummary()
      ]);
      setOverview(ov); setEngagement(en); setTopRois(tr);
      setTimeSeries(ts); setHeatmap(hm); setDemographics(dm);
      setAbSummary(ab);
      setLoading(false);
    } catch (err) {
      console.error("Error loading:", err);
      // If we get 400 Bad Request about missing PKLs, handle it gracefully
      if (err.response?.status === 400) {
        setAwaitingUpload(true);
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fallback auto-play timer when no video is loaded
  useEffect(() => {
    if (!isPlaying || !overview || videoUrlA || videoUrlB) return;
    const maxT = Math.max(overview.A.n_timesteps, overview.B.n_timesteps);
    const interval = setInterval(() => {
      setCurrentTime(t => (t + 1) % maxT);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, overview, videoUrlA, videoUrlB]);

  const maxTimesteps = overview ? Math.max(overview.A.n_timesteps, overview.B.n_timesteps) : 1;

  if (awaitingUpload) {
    return (
      <UploadDataScreen
        onUploadComplete={() => loadData()}
        onCancel={overview ? () => setAwaitingUpload(false) : undefined}
      />
    );
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <Brain size={44} className="animate-pulse" style={{ color: '#E85D24', marginBottom: '1rem' }} />
          <h2 style={{ fontFamily: 'Outfit', fontSize: '1.4rem' }}>Rewire</h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', marginTop: '0.5rem' }}>Loading A/B Test Engine...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'browse', label: 'A/B Overview' },
    { id: 'compare', label: 'Demographic Dynamics' },
    { id: 'scenes', label: 'High Impact Scenes' },
    { id: 'explore', label: 'Regional Variance' }
  ];

  const hasVideo = videoUrlA || videoUrlB;

  return (
    <div className="app-root">
      {/* ===== HEADER ===== */}
      <header className="app-header">
        <div className="header-brand">
          <h1>Rewire</h1>
          <span>A/B Neural Intelligence</span>
        </div>
        <div className="ab-mode-badge">
          <FlaskConical size={14} />
          <span>A/B TEST MODE</span>
        </div>
        <nav className="header-nav" style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={handleGenerateReport}
            disabled={isGeneratingReport}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.7)',
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.8rem',
              cursor: isGeneratingReport ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s',
              opacity: isGeneratingReport ? 0.4 : 1
            }}
            onMouseEnter={(e) => { if (!isGeneratingReport) { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; } }}
            onMouseLeave={(e) => { if (!isGeneratingReport) { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; } }}
          >
            {isGeneratingReport ? <RotateCcw size={12} className="animate-spin" /> : <FileText size={12} />}
            {isGeneratingReport ? 'Processing...' : 'Export Strategy Report'}
          </button>
          <button
            onClick={() => setAwaitingUpload(true)}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.7)',
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          >
            <Upload size={12} />
            Change PKL Data
          </button>
        </nav>
      </header>

      {/* ===== MAIN TWO-PANEL LAYOUT ===== */}
      <main className="app-main">
        {/* LEFT: Brain Visualization */}
        <div className="brain-panel">
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="show-guide-btn">
              <Sparkles size={13} /> Show Guide
            </button>

            {/* Upload buttons for BOTH videos */}
            <label className="upload-btn variant-a">
              <Upload size={13} /> Video A
              <input type="file" accept="video/mp4" onChange={handleFileChange('A')} style={{ display: 'none' }} />
            </label>
            <label className="upload-btn variant-b">
              <Upload size={13} /> Video B
              <input type="file" accept="video/mp4" onChange={handleFileChange('B')} style={{ display: 'none' }} />
            </label>

            {/* Demographic Selector */}
            <select
              className="dark-input"
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: '#FFF',
                fontSize: '0.72rem',
                padding: '0.45rem 0.75rem',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--border-color)',
                outline: 'none',
                cursor: 'pointer'
              }}
              value={brainDemographic}
              onChange={e => setBrainDemographic(e.target.value)}
            >
              <option value="baseline">Universal Baseline</option>
              <option value="kids">Kids Ensemble</option>
              <option value="genz">GenZ Ensemble</option>
              <option value="adults">Adults Ensemble</option>
              <option value="older">Older Ensemble</option>
            </select>

            {/* Variant toggle for brain viewer */}
            <div className="variant-toggle">
              <button
                className={`vtog ${brainVariant === 'A' ? 'active-a' : ''}`}
                onClick={() => setBrainVariant('A')}
              >A</button>
              <button
                className={`vtog ${brainVariant === 'B' ? 'active-b' : ''}`}
                onClick={() => setBrainVariant('B')}
              >B</button>
            </div>
          </div>

          {/* Dual Video Players */}
          {hasVideo && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div className="dual-video-row">
                {/* Video A */}
                <div className="video-slot">
                  <div className="video-container glass-card" style={{ marginBottom: 0 }}>
                    <div className="video-header">
                      <Video size={14} color="#E85D24" />
                      <span>Variant A</span>
                      <div className="variant-badge-a">A</div>
                    </div>
                    {videoUrlA ? (
                      <video
                        ref={vRefA}
                        src={videoUrlA}
                        onTimeUpdate={handleTimeUpdate}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        className="main-video"
                      />
                    ) : (
                      <div className="video-placeholder">
                        <Upload size={20} style={{ opacity: 0.3 }} />
                        <span>Upload Video A</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Video B */}
                <div className="video-slot">
                  <div className="video-container glass-card" style={{ marginBottom: 0 }}>
                    <div className="video-header">
                      <Video size={14} color="#7F77DD" />
                      <span>Variant B</span>
                      <div className="variant-badge-b">B</div>
                    </div>
                    {videoUrlB ? (
                      <video
                        ref={vRefB}
                        src={videoUrlB}
                        onTimeUpdate={handleTimeUpdate}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        className="main-video"
                      />
                    ) : (
                      <div className="video-placeholder">
                        <Upload size={20} style={{ opacity: 0.3 }} />
                        <span>Upload Video B</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Live Pulse (compact) */}
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <LivePulsePanel currentTime={currentTime} overviewA={overview.A} overviewB={overview.B} />
                </div>
              </div>

              {/* Shared Timeline Scrubber */}
              <div className="timeline-slider minimal" style={{ marginTop: '0.5rem', padding: '0.4rem 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button className="play-btn-minimal" onClick={skipBackward} title="Back 10s">
                      <SkipBack size={12} fill="currentColor" />
                    </button>
                    <button className="play-btn-minimal" onClick={togglePlayback}>
                      {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                    </button>
                    <button className="play-btn-minimal" onClick={skipForward} title="Forward 10s">
                      <SkipForward size={12} fill="currentColor" />
                    </button>
                  </div>

                  <div style={{ flex: 1, position: 'relative', height: '12px', display: 'flex', alignItems: 'center' }}>
                    <input type="range" min="0" max={maxTimesteps - 1} value={currentTime}
                      onChange={e => {
                        const t = parseInt(e.target.value);
                        [vRefA, vRefB].forEach(r => { if (r.current) r.current.currentTime = t; });
                        setCurrentTime(t);
                      }}
                      className="minimal-range"
                    />
                  </div>

                  <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', minWidth: '45px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {currentTime + 1}/{maxTimesteps}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Activity gradient */}
          <div className="activity-bar">
            <span>Low</span>
            <div className="gradient"></div>
            <span>High</span>
          </div>
          <div style={{ textAlign: 'center', marginTop: '0.15rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
              Activity — Variant {brainVariant}
            </span>
          </div>

          {/* Brain viewport */}
          <div className="brain-viewport">
            <HeadSilhouette />
            <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
              <BrainViewer3D
                ref={brainRef}
                nTimesteps={overview[brainVariant].n_timesteps}
                currentTime={currentTime}
                setCurrentTime={setCurrentTime}
                peakTimestep={overview[brainVariant].peak_timestep}
                demographic={brainDemographic}
                autoRotate={autoRotate}
                variant={brainVariant}
              />
            </div>
          </div>
        </div>

        {/* RIGHT: Content Panel */}
        <div className="content-panel">
          <div className="tab-bar">
            {tabs.map(tab => (
              <button key={tab.id} className={`pill-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
            ))}
          </div>

          {/* A/B OVERVIEW */}
          {activeTab === 'browse' && (
            <div className="animate-fade-in">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '1rem' }}>
                Comparing neural activation across <strong style={{ color: '#E85D24' }}>Variant A</strong> and{' '}
                <strong style={{ color: '#7F77DD' }}>Variant B</strong>.
                The A/B test identifies which stimulus drives stronger cortical engagement across demographic cohorts.
              </p>

              {/* A/B Quick Wins */}
              {abSummary && <ABSummaryPanel data={abSummary} />}

              {/* Side-by-side stat cards */}
              <div className="ab-stat-row">
                <div className="ab-stat-card variant-a-card">
                  <div className="ab-stat-label">Variant A</div>
                  <div className="ab-stat-grid">
                    <div>
                      <span className="ab-stat-sub">Peak</span>
                      <span className="ab-stat-val">{overview.A.timestep_metrics.global_max[overview.A.peak_timestep].toFixed(3)}</span>
                    </div>
                    <div>
                      <span className="ab-stat-sub">Mean</span>
                      <span className="ab-stat-val">{(overview.A.timestep_metrics.global_mean.reduce((a, b) => a + b, 0) / overview.A.n_timesteps).toFixed(3)}</span>
                    </div>
                    <div>
                      <span className="ab-stat-sub">Top Demo</span>
                      <span className="ab-stat-val">{demographics.A.labels[engagement.A.best_demographic]}</span>
                    </div>
                    <div>
                      <span className="ab-stat-sub">Active %</span>
                      <span className="ab-stat-val">{(overview.A.timestep_metrics.active_fraction[overview.A.peak_timestep] * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                <div className="ab-vs-divider">
                  <ArrowLeftRight size={16} />
                  <span>VS</span>
                </div>
                <div className="ab-stat-card variant-b-card">
                  <div className="ab-stat-label">Variant B</div>
                  <div className="ab-stat-grid">
                    <div>
                      <span className="ab-stat-sub">Peak</span>
                      <span className="ab-stat-val">{overview.B.timestep_metrics.global_max[overview.B.peak_timestep].toFixed(3)}</span>
                    </div>
                    <div>
                      <span className="ab-stat-sub">Mean</span>
                      <span className="ab-stat-val">{(overview.B.timestep_metrics.global_mean.reduce((a, b) => a + b, 0) / overview.B.n_timesteps).toFixed(3)}</span>
                    </div>
                    <div>
                      <span className="ab-stat-sub">Top Demo</span>
                      <span className="ab-stat-val">{demographics.B.labels[engagement.B.best_demographic]}</span>
                    </div>
                    <div>
                      <span className="ab-stat-sub">Active %</span>
                      <span className="ab-stat-val">{(overview.B.timestep_metrics.active_fraction[overview.B.peak_timestep] * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <OverviewPanel dataA={overview.A} dataB={overview.B} />
              <AsymmetryPanel dataA={overview.A} dataB={overview.B} />
            </div>
          )}

          {/* DEMOGRAPHIC DYNAMICS */}
          {activeTab === 'compare' && (
            <div className="animate-fade-in">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '1.75rem' }}>
                Comparing how different demographic cohorts respond to <strong style={{ color: '#E85D24' }}>A</strong> vs <strong style={{ color: '#7F77DD' }}>B</strong> across cognitive dimensions.
                Identify which variant wins for each target audience.
              </p>
              <EngagementPanel dataA={engagement.A} dataB={engagement.B} />
              {abSummary && <DimensionalLeadPanel data={abSummary} />}
              <div style={{ marginTop: '1.5rem' }}>
                <DemoTimeSeries
                  dataA={timeSeries?.A?.timeseries || timeSeries?.A}
                  dataB={timeSeries?.B?.timeseries || timeSeries?.B}
                  colors={demographics.A.colors}
                  labels={demographics.A.labels}
                  transcriptA={overview.A.transcript}
                  transcriptB={overview.B.transcript}
                />
              </div>
            </div>
          )}

          {/* HIGH IMPACT SCENES */}
          {activeTab === 'scenes' && (
            <div className="animate-fade-in">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '1.75rem' }}>
                Peak cortical response moments for each variant. Compare which stimulus content
                drives the strongest neural engagement.
              </p>
              <ImpactScenes
                videoUrlA={videoUrlA}
                videoUrlB={videoUrlB}
                overviewA={overview.A}
                overviewB={overview.B}
                onSeekToTimestamp={handleSeekToTimestamp}
              />
            </div>
          )}

          {/* REGIONAL VARIANCE */}
          {activeTab === 'explore' && (
            <div className="animate-fade-in">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '1.75rem' }}>
                Deep-dive into the most active ROIs and their stability across variants.
                Compare <strong style={{ color: '#E85D24' }}>A</strong> vs <strong style={{ color: '#7F77DD' }}>B</strong> inter-subject variance patterns.
              </p>
              <TopRoisPanel dataA={topRois.A} dataB={topRois.B} />
              <div style={{ marginTop: '1.5rem' }}>
                <VarianceHeatmap dataA={heatmap.A} dataB={heatmap.B} />
              </div>
            </div>
          )}

        </div>
      </main>

      <footer className="app-footer">
        <p>© 2026 Rewire Analytics Engine • A/B Neural Testing • Modal GPU</p>
      </footer>
      {/* Comprehensive Strategy Report Overlay */}
      {reportData && (
        <ReportView
          data={reportData}
          snapshots={reportSnapshots}
          onClose={() => setReportData(null)}
        />
      )}
    </div>
  );
}

export default App;
