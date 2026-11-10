import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
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
import AsymmetryPanel from './components/AsymmetryPanel';
import ImpactScenes from './components/ImpactScenes';
import LivePulsePanel from './components/LivePulsePanel';
import ABSummaryPanel from './components/ABSummaryPanel';
import DimensionalLeadPanel, { ContestsPanel } from './components/DimensionalLeadPanel';
import KeyMetricsPanel from './components/KeyMetricsPanel';
import ReportView from './components/ReportView';
import { Button } from '@/components/arc/button/button';
import { ActionButton } from '@/components/arc/action-button/action-button';
import SegmentedControl from '@/components/arc/segmented-control/segmented-control';
import { Select } from '@/components/arc/select/select';
import { Slider } from '@/components/arc/slider/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/arc/tabs/tabs';
import { Alert } from '@/components/arc/alert/alert';
import { Skeleton } from '@/components/arc/skeleton/skeleton';
import { Tooltip } from '@/components/arc/tooltip/tooltip';
import { ThemeSwitch } from '@/components/arc/theme-switch/theme-switch';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Overview', title: 'A/B overview', desc: 'Which creative drives stronger predicted cortical response, and when.' },
  { id: 'audiences', label: 'Audiences', title: 'Audience dynamics', desc: 'How each age cohort responds to the two variants across eight cognitive dimensions.' },
  { id: 'scenes', label: 'Key moments', title: 'High-impact moments', desc: 'The seconds where each variant drives the strongest response.' },
  { id: 'regions', label: 'Brain regions', title: 'Brain regions', desc: 'Top cortical regions and how consistent the response is across simulated viewers.' },
];

const COHORTS = [
  { value: 'baseline', label: 'All audiences' },
  { value: 'kids', label: 'Kids (6 to 12)' },
  { value: 'genz', label: 'Gen Z (13 to 24)' },
  { value: 'adults', label: 'Adults (25 to 54)' },
  { value: 'older', label: 'Older (55+)' },
];

const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

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

  const [activeTab, setActiveTab] = useState('overview');
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [brainDemographic, setBrainDemographic] = useState('baseline');
  const [brainVariant, setBrainVariant] = useState('A');

  const [videoUrlA, setVideoUrlA] = useState(null);
  const [videoUrlB, setVideoUrlB] = useState(null);
  const vRefA = useRef(null);
  const vRefB = useRef(null);
  const brainRef = useRef(null);

  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportSnapshots, setReportSnapshots] = useState({ A: null, B: null });
  const [reportError, setReportError] = useState(null);

  // Theme: read what the pre-paint script in index.html chose, then keep the <html> attribute and the saved choice in sync.
  const [theme, setTheme] = useState(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('rewire-theme', theme); } catch { /* storage blocked: the theme still applies for this visit */ }
  }, [theme]);
  const changeTheme = (next) => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const apply = () => { document.documentElement.dataset.theme = next; flushSync(() => setTheme(next)); };
    if (!document.startViewTransition || reduce) { apply(); return; }
    document.startViewTransition(apply);
    // A transition waits for a rendered frame; if none comes (a hidden or throttled page), switch anyway.
    setTimeout(() => { if (document.documentElement.dataset.theme !== next) apply(); }, 400);
  };

  const handleGenerateReport = async () => {
    if (isGeneratingReport) return;
    setIsGeneratingReport(true);
    setReportError(null);
    try {
      const [sum, eng, rois] = await Promise.all([fetchABSummary(), fetchEngagement(), fetchTopRois()]);
      if (!rois?.A || !rois?.B || !overview?.A || !overview?.B) {
        throw new Error('Neural data is still loading or incomplete.');
      }
      const snaps = { A: null, B: null };
      for (const v of ['A', 'B']) {
        try {
          setBrainVariant(v);
          const peak = rois[v].rois?.[0]?.peak_timestep || 0;
          const max = overview[v].n_timesteps || 1;
          setCurrentTime(Math.max(0, Math.min(Math.floor(peak), max - 1)));
          await new Promise(r => setTimeout(r, 1200));
          snaps[v] = brainRef.current?.getSnapshot();
        } catch (e) { console.warn(`${v} snapshot failed`, e); }
      }
      setReportSnapshots(snaps);
      setReportData({ summary: sum, engagement: eng, topRois: rois, overview, demographics, videoUrlA, videoUrlB });
    } catch (err) {
      console.error('Report generation failed:', err);
      setReportError(err.message);
      throw err;
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Videos are chosen on the data screen. A new file replaces the current one; leaving a slot empty keeps what is loaded.
  const [videoNames, setVideoNames] = useState({ A: null, B: null });
  const applyVideos = (videos = {}) => {
    ['A', 'B'].forEach(v => {
      const file = videos[v];
      if (!file) return;
      const url = URL.createObjectURL(file);
      (v === 'A' ? setVideoUrlA : setVideoUrlB)(old => { if (old) URL.revokeObjectURL(old); return url; });
      setVideoNames(names => ({ ...names, [v]: file.name }));
    });
  };

  const handleTimeUpdate = (e) => {
    setCurrentTime(Math.floor(e.target.currentTime));
    const otherRef = e.target === vRefA.current ? vRefB : vRefA;
    if (otherRef.current && Math.abs(otherRef.current.currentTime - e.target.currentTime) > 0.5) {
      otherRef.current.currentTime = e.target.currentTime;
    }
  };

  const togglePlayback = () => {
    [vRefA, vRefB].forEach(r => {
      if (r.current) { if (isPlaying) r.current.pause(); else r.current.play(); }
    });
    setIsPlaying(!isPlaying);
  };

  const handleSeekToTimestamp = (t) => {
    const maxT = Math.max(overview?.A?.n_timesteps || 1, overview?.B?.n_timesteps || 1) - 1;
    const clampedT = Math.max(0, Math.min(t, maxT));
    [vRefA, vRefB].forEach(r => { if (r.current) r.current.currentTime = clampedT; });
    setCurrentTime(clampedT);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const status = await fetchStatus();
      if (!status.loaded) { setAwaitingUpload(true); setLoading(false); return; }
      setAwaitingUpload(false);
      const [ov, en, tr, ts, hm, dm, ab] = await Promise.all([
        fetchOverview(), fetchEngagement(), fetchTopRois(),
        fetchTimeSeries(), fetchHeatmap(), fetchDemographics(), fetchABSummary()
      ]);
      setOverview(ov); setEngagement(en); setTopRois(tr);
      setTimeSeries(ts); setHeatmap(hm); setDemographics(dm); setAbSummary(ab);
    } catch (err) {
      console.error('Error loading:', err);
      if (err.response?.status === 400) setAwaitingUpload(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Without a video, playback steps through the timeline once a second.
  useEffect(() => {
    if (!isPlaying || !overview || videoUrlA || videoUrlB) return;
    const maxT = Math.max(overview.A.n_timesteps, overview.B.n_timesteps);
    const interval = setInterval(() => setCurrentTime(t => (t + 1) % maxT), 1000);
    return () => clearInterval(interval);
  }, [isPlaying, overview, videoUrlA, videoUrlB]);

  if (awaitingUpload) {
    return (
      <UploadDataScreen
        currentVideos={videoNames}
        onUploadComplete={videos => { applyVideos(videos); loadData(); }}
        onCancel={overview ? videos => { applyVideos(videos); setAwaitingUpload(false); } : undefined}
      />
    );
  }

  if (loading) {
    return (
      <div className="splash">
        <h2>Loading predictions</h2>
        <Skeleton lines={3} label="Loading predictions" className="splash-skeleton" />
      </div>
    );
  }

  if (!overview || !engagement || !topRois || !demographics) {
    return (
      <div className="splash">
        <Alert tone="danger" title="The analysis engine is not responding">
          Start the backend on port 8000, then try again.
        </Alert>
        <Button variant="secondary" onClick={loadData}>Try again</Button>
      </div>
    );
  }

  const maxTimesteps = Math.max(overview.A.n_timesteps, overview.B.n_timesteps);
  const tab = TABS.find(t => t.id === activeTab);

  const hasVideo = videoUrlA || videoUrlB;
  const videoTile = (variant, url, ref) => url && (
    <figure className="video-tile">
      <video ref={ref} src={url} muted playsInline onTimeUpdate={handleTimeUpdate} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} aria-label={`Variant ${variant} video`} />
      <figcaption>Variant {variant}</figcaption>
    </figure>
  );

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="brand">
          <span className="brand-name">Rewire</span>
          <span className="brand-sub">{maxTimesteps}s stimulus, 200 simulated viewers</span>
        </div>
        <div className="header-actions">
          <span className="theme-toggle"><ThemeSwitch theme={theme} variant="rise" iconOnly onThemeChange={changeTheme} /></span>
          <Button variant="secondary" onClick={() => setAwaitingUpload(true)}>Change data</Button>
          <ActionButton
            label="Export report"
            pendingLabel="Building report"
            successLabel="Report ready"
            onAction={handleGenerateReport}
            onActionError={() => {}}
          />
        </div>
      </header>

      <main className="app-main">
        <aside className="app-aside" aria-label="Cortex monitor">
          <div className="aside-head">
            <h2>Cortex monitor</h2>
            <SegmentedControl label="Variant shown on the brain" options={[{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }]} value={brainVariant} onValueChange={setBrainVariant} />
          </div>
          <Select label="Audience" options={COHORTS} value={brainDemographic} onValueChange={setBrainDemographic} />

          <BrainViewer3D
            ref={brainRef}
            nTimesteps={overview[brainVariant].n_timesteps}
            currentTime={currentTime}
            setCurrentTime={setCurrentTime}
            peakTimestep={overview[brainVariant].peak_timestep}
            demographic={brainDemographic}
            autoRotate
            variant={brainVariant}
          />

          <div className="colorbar" aria-label="Colour scale: grey is below threshold, white is the peak">
            <span>Below threshold</span>
            <div className="colorbar-ramp" />
            <span>Peak</span>
          </div>

          <div className="aside-section">
            <Slider label="Timeline" min={0} max={maxTimesteps - 1} value={currentTime} onValueChange={handleSeekToTimestamp} format={fmtClock} />
            <div className="player">
              <Tooltip content="Back 10 seconds"><Button variant="secondary" size="sm" className="icon-btn" aria-label="Back 10 seconds" onClick={() => handleSeekToTimestamp(currentTime - 10)}><SkipBack size={16} strokeWidth={1.75} aria-hidden="true" /></Button></Tooltip>
              <Button variant="secondary" size="sm" onClick={togglePlayback}>
                {isPlaying ? <Pause size={16} strokeWidth={1.75} aria-hidden="true" /> : <Play size={16} strokeWidth={1.75} aria-hidden="true" />}
                {isPlaying ? 'Pause' : 'Play'}
              </Button>
              <Tooltip content="Forward 10 seconds"><Button variant="secondary" size="sm" className="icon-btn" aria-label="Forward 10 seconds" onClick={() => handleSeekToTimestamp(currentTime + 10)}><SkipForward size={16} strokeWidth={1.75} aria-hidden="true" /></Button></Tooltip>
            </div>
          </div>

          <div className="aside-section">
            <LivePulsePanel currentTime={currentTime} overviewA={overview.A} overviewB={overview.B} />
          </div>

          {hasVideo && (
            <div className="aside-section">
              <div className="video-tiles">{videoTile('A', videoUrlA, vRefA)}{videoTile('B', videoUrlB, vRefB)}</div>
            </div>
          )}
        </aside>

        <div className="app-content">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="content-head">
              <div>
                <h1>{tab.title}</h1>
                <p>{tab.desc}</p>
              </div>
              <TabsList aria-label="Analysis sections">
                {TABS.map(t => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}
              </TabsList>
            </div>

            {reportError && (
              <Alert tone="danger" title="The report could not be built" onDismiss={() => setReportError(null)}>{reportError}</Alert>
            )}

            <TabsContent value="overview">
              <div className="bento">
                <div className="span-12">{abSummary && <ABSummaryPanel data={abSummary} />}</div>
                <div className="span-8"><OverviewPanel dataA={overview.A} dataB={overview.B} onSeekToTimestamp={handleSeekToTimestamp} /></div>
                <div className="span-4"><KeyMetricsPanel overview={overview} engagement={engagement} demographics={demographics} /></div>
                <div className="span-12"><AsymmetryPanel dataA={overview.A} dataB={overview.B} /></div>
              </div>
            </TabsContent>

            <TabsContent value="audiences">
              <div className="bento">
                <div className="span-7"><EngagementPanel dataA={engagement.A} dataB={engagement.B} /></div>
                <div className="span-5">{abSummary && <ContestsPanel data={abSummary} />}</div>
                <div className="span-12">{abSummary && <DimensionalLeadPanel data={abSummary} />}</div>
                <div className="span-12">
                  <DemoTimeSeries
                    dataA={timeSeries?.A?.timeseries || timeSeries?.A}
                    dataB={timeSeries?.B?.timeseries || timeSeries?.B}
                    labels={demographics.A.labels}
                    transcriptA={overview.A.transcript}
                    transcriptB={overview.B.transcript}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="scenes">
              <ImpactScenes videoUrlA={videoUrlA} videoUrlB={videoUrlB} overviewA={overview.A} overviewB={overview.B} onSeekToTimestamp={handleSeekToTimestamp} />
            </TabsContent>

            <TabsContent value="regions">
              <div className="bento">
                <div className="span-12"><TopRoisPanel dataA={topRois.A} dataB={topRois.B} /></div>
                <div className="span-12">{heatmap && <VarianceHeatmap dataA={heatmap.A} dataB={heatmap.B} />}</div>
              </div>
            </TabsContent>
          </Tabs>

          <footer className="app-footer">
            <span>Predicted brain responses. Simulated viewers, not real participants.</span>
            <a href="https://github.com/aryaneelshivam/Rewire" target="_blank" rel="noreferrer">Source on GitHub</a>
          </footer>
        </div>
      </main>

      {reportData && <ReportView data={reportData} snapshots={reportSnapshots} onClose={() => setReportData(null)} />}
    </div>
  );
}

export default App;
