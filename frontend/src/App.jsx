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
import { 
  Brain, Sparkles, Play, Pause, Upload, Video, SkipBack, 
  SkipForward, ArrowLeftRight, FileText, RotateCcw, Search, Terminal
} from 'lucide-react';
import ReportView from './components/ReportView';

function App() {
  const [loading, setLoading] = useState(true);
  const [awaitingUpload, setAwaitingUpload] = useState(false);
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
  const [autoRotate] = useState(true);
  const [brainDemographic, setBrainDemographic] = useState('baseline');
  const [brainVariant, setBrainVariant] = useState('A');
  const [searchQuery, setSearchQuery] = useState('');

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

    try {
      const [sum, eng, rois] = await Promise.all([
        fetchABSummary(),
        fetchEngagement(),
        fetchTopRois()
      ]);

      if (!rois?.A || !rois?.B || !overview?.A || !overview?.B) {
        throw new Error("Neural data is still loading or incomplete.");
      }

      setActiveTab('explore');
      const snaps = { A: null, B: null };

      // Snapshot A
      try {
        setBrainVariant('A');
        const peakA = rois.A.rois?.[0]?.peak_timestep || 0;
        const maxA = overview.A.n_timesteps || 1;
        const safePeakA = Math.max(0, Math.min(Math.floor(peakA), maxA - 1));
        setCurrentTime(safePeakA);
        await new Promise(r => setTimeout(r, 1200));
        snaps.A = brainRef.current?.getSnapshot();
      } catch (e) { console.warn("A Snapshot failed", e); }

      // Snapshot B
      try {
        setBrainVariant('B');
        const peakB = rois.B.rois?.[0]?.peak_timestep || 0;
        const maxB = overview.B.n_timesteps || 1;
        const safePeakB = Math.max(0, Math.min(Math.floor(peakB), maxB - 1));
        setCurrentTime(safePeakB);
        await new Promise(r => setTimeout(r, 1200));
        snaps.B = brainRef.current?.getSnapshot();
      } catch (e) { console.warn("B Snapshot failed", e); }

      setReportSnapshots(snaps);
      setReportData({
        summary: sum,
        engagement: eng,
        topRois: rois,
        overview: overview,
        demographics: demographics,
        videoUrlA,
        videoUrlB
      });
    } catch (err) {
      console.error("Report generation failed:", err);
      alert(`Report generation failed: ${err.message}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleFileChange = (variant) => (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (variant === 'A') {
      setVideoUrlA(url);
    } else {
      setVideoUrlB(url);
    }
  };

  const handleTimeUpdate = (e) => {
    const t = Math.floor(e.target.currentTime);
    setCurrentTime(t);
    const otherRef = e.target === vRefA.current ? vRefB : vRefA;
    if (otherRef.current && Math.abs(otherRef.current.currentTime - e.target.currentTime) > 0.5) {
      otherRef.current.currentTime = e.target.currentTime;
    }
  };

  const togglePlayback = () => {
    [vRefA, vRefB].forEach(r => {
      if (r.current) {
        if (isPlaying) r.current.pause();
        else r.current.play();
      }
    });
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
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--canvas)', color: 'var(--ink)' }}>
        <div style={{ textAlign: 'center' }}>
          <Brain size={36} className="animate-pulse" style={{ color: 'var(--variant-a)', marginBottom: '16px' }} />
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 600 }}>Rewire</h2>
          <p style={{ color: 'var(--body)', fontSize: '13px', marginTop: '6px' }}>Loading A/B Neural Intelligence Engine...</p>
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
      {/* ===== OLLAMA PRIMARY NAV ===== */}
      <header className="app-header">
        <div className="header-brand">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
            <path d="M9 21h6" />
          </svg>
          <h1>Rewire</h1>
          <span className="header-subtitle">v2.0 · Meta Tribe fMRI</span>
          
          {/* Scientific Telemetry Status Strip */}
          <div className="telemetry-strip header-telemetry">
            <span className="sci-dot live" />
            <span style={{ fontWeight: 600 }}>Tribe v2 Engine</span>
            <span style={{ color: 'var(--mute)' }}>·</span>
            <span>200 Brains</span>
            <span style={{ color: 'var(--mute)' }}>·</span>
            <span>20,484 v</span>
          </div>

        </div>

        {/* Center Search Pill */}
        <div className="search-pill">
          <Search size={14} color="var(--mute)" />
          <input
            type="text"
            placeholder="Search ROIs, scenes, neural metrics..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Right CTA Pills */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setAwaitingUpload(true)}
            className="button-secondary"
            style={{ height: '36px', fontSize: '13px', padding: '0 16px' }}
          >
            <Upload size={13} />
            Change PKL
          </button>
          
          <button
            onClick={handleGenerateReport}
            disabled={isGeneratingReport}
            className="button-primary"
            style={{ height: '36px', fontSize: '13px', padding: '0 18px', opacity: isGeneratingReport ? 0.6 : 1 }}
          >
            {isGeneratingReport ? <RotateCcw size={13} className="animate-spin" /> : <FileText size={13} />}
            {isGeneratingReport ? 'Synthesizing Dossier...' : 'Export Strategy Dossier'}
          </button>
        </div>
      </header>

      {/* ===== MAIN TWO-PANEL LAYOUT ===== */}
      <main className="app-main">
        {/* LEFT: Brain Visualization & Stimulus Video */}
        <div className="brain-panel">
          
          {/* Top Control Bar in Left Panel */}
          <div className="brain-toolbar">
            <button className="show-guide-btn" onClick={() => setActiveTab('browse')}>
              <Sparkles size={13} /> Guide
            </button>

            {/* Video A upload */}
            <label className="upload-btn variant-a">
              <Upload size={13} /> Video A
              <input type="file" accept="video/mp4" onChange={handleFileChange('A')} style={{ display: 'none' }} />
            </label>

            {/* Video B upload */}
            <label className="upload-btn variant-b">
              <Upload size={13} /> Video B
              <input type="file" accept="video/mp4" onChange={handleFileChange('B')} style={{ display: 'none' }} />
            </label>

            {/* Demographic Selector Dropdown */}
            <select
              className="dark-input"
              value={brainDemographic}
              onChange={e => setBrainDemographic(e.target.value)}
            >
              <option value="baseline">Universal Baseline</option>
              <option value="kids">Kids Ensemble</option>
              <option value="genz">GenZ Ensemble</option>
              <option value="adults">Adults Ensemble</option>
              <option value="older">Older Ensemble</option>
            </select>

            {/* Variant toggle for 3D brain */}
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
            <div style={{ marginBottom: '20px' }}>
              <div className="dual-video-row">
                {/* Video A */}
                <div className="video-slot">
                  <div className="video-container">
                    <div className="video-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Video size={13} />
                        <span>Variant A</span>
                      </div>
                      <span className="variant-badge-a">A</span>
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
                        <Upload size={18} color="var(--mute)" />
                        <span>Upload Video A</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Video B */}
                <div className="video-slot">
                  <div className="video-container">
                    <div className="video-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Video size={13} />
                        <span>Variant B</span>
                      </div>
                      <span className="variant-badge-b">B</span>
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
                        <Upload size={18} color="var(--mute)" />
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
              <div className="timeline-slider minimal" style={{ marginTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button className="play-btn-minimal" onClick={skipBackward} title="Back 10s">
                      <SkipBack size={14} />
                    </button>
                    <button className="play-btn-minimal" onClick={togglePlayback}>
                      {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button className="play-btn-minimal" onClick={skipForward} title="Forward 10s">
                      <SkipForward size={14} />
                    </button>
                  </div>

                  <div style={{ flex: 1, position: 'relative', height: '14px', display: 'flex', alignItems: 'center' }}>
                    <input type="range" min="0" max={maxTimesteps - 1} value={currentTime}
                      onChange={e => {
                        const t = parseInt(e.target.value);
                        [vRefA, vRefB].forEach(r => { if (r.current) r.current.currentTime = t; });
                        setCurrentTime(t);
                      }}
                      className="minimal-range"
                    />
                  </div>

                  <span style={{ fontSize: '11px', color: 'var(--mute)', minWidth: '50px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    {currentTime + 1}/{maxTimesteps}s
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Activity Scale */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div className="sci-colorbar">
              <span>Sub-threshold</span>
              <div className="sci-colorbar-gradient" />
              <span>Peak z</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--charcoal)', fontFamily: 'var(--font-mono)' }}>
              Viewing Variant <strong>{brainVariant}</strong> ({brainDemographic})
            </span>
          </div>

          {/* 3D Brain Viewport Container */}
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

        {/* RIGHT: Content & Neuromarketing Metrics */}
        <div className="content-panel">
          {/* Tab Navigation (Pills) */}
          <div className="tab-bar">
            {tabs.map(tab => (
              <button 
                key={tab.id} 
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* A/B OVERVIEW TAB */}
          {activeTab === 'browse' && (
            <div>
              <p style={{ color: 'var(--body)', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
                Comparing predicted cortical activation across <strong style={{ color: 'var(--variant-a)' }}>Variant A</strong> and{' '}
                <strong style={{ color: 'var(--variant-b)' }}>Variant B</strong>.
                Identifies which creative version generates higher audience recall and emotional resonance.
              </p>

              {/* Single Inverted 'Max' Tier Card for Verdict */}
              {abSummary && <ABSummaryPanel data={abSummary} />}

              {/* Side-by-side Flat Stat Cards */}
              <div className="ab-stat-row">
                {/* Variant A Card */}
                <div className="ab-stat-card variant-a">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>Variant A</span>
                    <span className="variant-badge-a">A</span>
                  </div>
                  <div className="ab-stat-grid">
                    <div>
                      <span className="ab-stat-sub">Peak BOLD</span>
                      <span className="ab-stat-val" style={{ fontFamily: 'var(--font-mono)' }}>
                        {overview.A.timestep_metrics.global_max[overview.A.peak_timestep].toFixed(3)}
                      </span>
                    </div>
                    <div>
                      <span className="ab-stat-sub">Global Mean</span>
                      <span className="ab-stat-val" style={{ fontFamily: 'var(--font-mono)' }}>
                        {(overview.A.timestep_metrics.global_mean.reduce((a, b) => a + b, 0) / overview.A.n_timesteps).toFixed(3)}
                      </span>
                    </div>
                    <div>
                      <span className="ab-stat-sub">Top Audience</span>
                      <span className="ab-stat-val">
                        {demographics.A.labels[engagement.A.best_demographic]}
                      </span>
                    </div>
                    <div>
                      <span className="ab-stat-sub">Active Fraction</span>
                      <span className="ab-stat-val" style={{ fontFamily: 'var(--font-mono)' }}>
                        {(overview.A.timestep_metrics.active_fraction[overview.A.peak_timestep] * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* VS Divider */}
                <div className="ab-vs-divider">
                  <ArrowLeftRight size={14} color="var(--mute)" />
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--mute)' }}>VS</span>
                </div>

                {/* Variant B Card */}
                <div className="ab-stat-card variant-b">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--charcoal)' }}>Variant B</span>
                    <span className="variant-badge-b">B</span>
                  </div>
                  <div className="ab-stat-grid">
                    <div>
                      <span className="ab-stat-sub">Peak BOLD</span>
                      <span className="ab-stat-val" style={{ fontFamily: 'var(--font-mono)' }}>
                        {overview.B.timestep_metrics.global_max[overview.B.peak_timestep].toFixed(3)}
                      </span>
                    </div>
                    <div>
                      <span className="ab-stat-sub">Global Mean</span>
                      <span className="ab-stat-val" style={{ fontFamily: 'var(--font-mono)' }}>
                        {(overview.B.timestep_metrics.global_mean.reduce((a, b) => a + b, 0) / overview.B.n_timesteps).toFixed(3)}
                      </span>
                    </div>
                    <div>
                      <span className="ab-stat-sub">Top Audience</span>
                      <span className="ab-stat-val">
                        {demographics.B.labels[engagement.B.best_demographic]}
                      </span>
                    </div>
                    <div>
                      <span className="ab-stat-sub">Active Fraction</span>
                      <span className="ab-stat-val" style={{ fontFamily: 'var(--font-mono)' }}>
                        {(overview.B.timestep_metrics.active_fraction[overview.B.peak_timestep] * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <OverviewPanel dataA={overview.A} dataB={overview.B} onSeekToTimestamp={handleSeekToTimestamp} />
              <AsymmetryPanel dataA={overview.A} dataB={overview.B} />
            </div>
          )}

          {/* DEMOGRAPHIC DYNAMICS TAB */}
          {activeTab === 'compare' && (
            <div>
              <p style={{ color: 'var(--body)', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
                Cohort-level analysis comparing how demographic cohorts respond to <strong style={{ color: 'var(--variant-a)' }}>Variant A</strong> vs <strong style={{ color: 'var(--variant-b)' }}>Variant B</strong> across 8 functional cognitive dimensions.
              </p>
              <EngagementPanel dataA={engagement.A} dataB={engagement.B} />
              {abSummary && <DimensionalLeadPanel data={abSummary} />}
              <div style={{ marginTop: '20px' }}>
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

          {/* HIGH IMPACT SCENES TAB */}
          {activeTab === 'scenes' && (
            <div>
              <p style={{ color: 'var(--body)', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
                Keyframe extraction and cortical intensity benchmarking for both stimuli.
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

          {/* REGIONAL VARIANCE TAB */}
          {activeTab === 'explore' && (
            <div>
              <p style={{ color: 'var(--body)', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
                Deep-dive into cortical regions of interest (ROIs) and inter-subject variance stability across 200 synthesized brains.
              </p>
              <TopRoisPanel dataA={topRois.A} dataB={topRois.B} />
              <div style={{ marginTop: '20px' }}>
                <VarianceHeatmap dataA={heatmap.A} dataB={heatmap.B} />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ===== OLLAMA FOOTER ===== */}
      <footer className="footer-section">
        <div className="footer-links">
          <a href="https://github.com/aryaneelshivam/Rewire" target="_blank" rel="noreferrer">Rewire</a>
          <a href="#models">Models</a>
          <a href="#docs">Docs</a>
          <a href="https://github.com/aryaneelshivam/Rewire" target="_blank" rel="noreferrer">GitHub</a>
          <a href="#privacy">Privacy</a>
          <a href="#terms">Terms</a>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>
          © 2026 Rewire Analytics · Meta Tribe v2 fMRI Inference
        </span>
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
