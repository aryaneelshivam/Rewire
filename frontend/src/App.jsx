import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import {
  fetchStatus, fetchOverview, fetchEngagement, fetchTopRois,
  fetchTimeSeries, fetchHeatmap, fetchDemographics, fetchABSummary, createJob, runMediaUrl
} from './api';
import UploadDataScreen from './components/UploadDataScreen';
import PipelineScreen from './components/PipelineScreen';
import WorkspaceScreen from './components/WorkspaceScreen';
import OverviewPanel from './components/OverviewPanel';
import EngagementPanel from './components/EngagementPanel';
import TopRoisPanel from './components/TopRoisPanel';
import DemoTimeSeries from './components/DemoTimeSeries';
import VarianceHeatmap from './components/VarianceHeatmap';
import CortexMonitor from './components/CortexMonitor';
import WinnerPlayer from './components/WinnerPlayer';
import CreativeTimeline from './components/CreativeTimeline';
import EnsembleExplorer from './components/EnsembleExplorer';
import AsymmetryPanel from './components/AsymmetryPanel';
import ImpactScenes from './components/ImpactScenes';
import ABSummaryPanel from './components/ABSummaryPanel';
import DimensionalLeadPanel, { ContestsPanel } from './components/DimensionalLeadPanel';
import KeyMetricsPanel from './components/KeyMetricsPanel';
import ReportView from './components/ReportView';
import ShareDialog from './components/ShareDialog';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/arc/button/button';
import { ActionButton } from '@/components/arc/action-button/action-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/arc/tabs/tabs';
import { Alert } from '@/components/arc/alert/alert';
import { Skeleton } from '@/components/arc/skeleton/skeleton';
import { ThemeSwitch } from '@/components/arc/theme-switch/theme-switch';

const TABS = [
  { id: 'overview', label: 'Overview', title: 'A/B overview', desc: 'Which creative drives stronger predicted cortical response, and when.' },
  { id: 'audiences', label: 'Audiences', title: 'Audience dynamics', desc: 'How each age cohort responds across eight cognitive dimensions.' },
  { id: 'scenes', label: 'Key moments', title: 'High-impact moments', desc: 'The seconds where each variant drives the strongest response.' },
  { id: 'regions', label: 'Brain regions', title: 'Brain regions', desc: 'Top cortical regions and how consistent the response is across simulated viewers.' },
  { id: 'ensemble', label: 'Ensemble', title: 'Neural ensemble explorer', desc: 'All 200 simulated viewers, grouped by how alike they respond. Find a group and see what sets it apart.' },
];

/** The variant that takes more cohort and dimension contests; 'TIE' when they split evenly. */
function winnerOf(summary) {
  let a = 0, b = 0;
  Object.values(summary?.dimension_winners || {}).forEach(dims => Object.entries(dims).forEach(([dim, d]) => {
    if (dim === 'overall') return;
    if (d.winner === 'A') a++; else if (d.winner === 'B') b++;
  }));
  return a > b ? 'A' : b > a ? 'B' : 'TIE';
}

function App() {
  const [loading, setLoading] = useState(true);
  const [awaitingUpload, setAwaitingUpload] = useState(false);
  // The analysis in progress: its id, plus the files, mode and details it started with, so it can be retried.
  const [job, setJob] = useState(null);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [runInfo, setRunInfo] = useState(null);        // the saved run on screen: id, title, names
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
  const playerRef = useRef(null);
  const brainRef = useRef(null);

  const [sharing, setSharing] = useState(false);
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

  // Each slot takes a File (played from the browser's copy) or a URL (a video kept with a saved run).
  const applyVideos = (videos = {}) => {
    ['A', 'B'].forEach(v => {
      const src = videos[v];
      const url = typeof src === 'string' ? src : src ? URL.createObjectURL(src) : null;
      (v === 'A' ? setVideoUrlA : setVideoUrlB)(old => { if (old?.startsWith('blob:')) URL.revokeObjectURL(old); return url; });
    });
  };

  const handleTimeUpdate = (e) => setCurrentTime(Math.floor(e.target.currentTime));
  const videoPause = () => { playerRef.current?.pause(); setIsPlaying(false); };

  // With a video loaded the element is the clock; without one, the interval below steps the playhead.
  const togglePlayback = () => {
    const video = playerRef.current;
    if (video) { if (video.paused) video.play(); else video.pause(); return; }
    setIsPlaying(p => !p);
  };

  const handleSeekToTimestamp = (t) => {
    const maxT = Math.max(1, ...Object.values(overview || {}).map(o => o.n_timesteps || 1)) - 1;
    const clampedT = Math.max(0, Math.min(t, maxT));
    if (playerRef.current) playerRef.current.currentTime = clampedT;
    setCurrentTime(clampedT);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const status = await fetchStatus();
      // An analysis already running on the backend (after a reload, say) is picked up where it is.
      if (status.active_job) { setJob(j => j ?? { id: status.active_job }); setLoading(false); return; }
      if (!status.loaded) { setAwaitingUpload(true); setLoading(false); return; }
      // A saved run plays the videos it kept; samples and runs without them play nothing.
      setRunInfo(status.run?.id && !status.run.deleted ? status.run : null);
      applyVideos(Object.fromEntries(Object.entries(status.videos || {}).filter(([, kept]) => kept).map(([v]) => [v, runMediaUrl(status.run.id, v)])));
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

  // One variant (a single creative) or two (a comparison). Everything below follows the loaded data.
  const variants = overview ? Object.keys(overview) : [];
  const single = variants.length === 1;
  const winner = single ? 'A' : winnerOf(abSummary);
  const shown = winner === 'B' ? 'B' : 'A';
  const winnerVideo = shown === 'B' ? videoUrlB : videoUrlA;
  const shareVideos = useMemo(() => ({ A: videoUrlA, B: videoUrlB }), [videoUrlA, videoUrlB]);
  // The scorecard's brain: show one variant at one second in the 3D viewer, take its picture, then put it back.
  const viewRef = useRef({});
  viewRef.current = { variant: brainVariant, time: currentTime };
  const captureBrain = useCallback(async (variant, t) => {
    const before = viewRef.current;
    setBrainVariant(variant);
    setCurrentTime(t);
    await new Promise(r => setTimeout(r, 1400));
    const image = brainRef.current?.getSnapshot() ?? null;
    setBrainVariant(before.variant);
    setCurrentTime(before.time);
    return image;
  }, []);

  // The brain opens on the winning variant once the summary arrives.
  useEffect(() => { if (abSummary) setBrainVariant(abSummary.mode !== 'single' && winnerOf(abSummary) === 'B' ? 'B' : 'A'); }, [abSummary]);

  // The timeline's two tracks, and a key for its saved notes that changes when the data does.
  const tracks = useMemo(() => overview ? Object.keys(overview).map(v => ({
    variant: v,
    overview: overview[v],
    videoUrl: v === 'A' ? videoUrlA : videoUrlB,
    isWinner: v === (winner === 'B' ? 'B' : 'A'),
  })) : [], [overview, videoUrlA, videoUrlB, winner]);
  const notesKey = overview
    ? `rewire-notes:${Object.values(overview).map(o => `${o.n_timesteps}-${o.peak_timestep}-${o.transcript?.length ?? 0}`).join('|')}`
    : 'rewire-notes';

  // A looped range sends the playhead back to its start whenever it reaches the end.
  const [loopRange, setLoopRange] = useState(null);
  useEffect(() => {
    if (loopRange && (currentTime >= loopRange.end || currentTime < loopRange.start)) handleSeekToTimestamp(loopRange.start);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, loopRange]);
  const playRange = (span) => {
    setLoopRange(span);
    if (!span) return;
    handleSeekToTimestamp(span.start);
    if (playerRef.current) playerRef.current.play(); else setIsPlaying(true);
  };

  const contentRef = useRef(null);
  const openTab = (tabId, t) => {
    setActiveTab(tabId);
    handleSeekToTimestamp(t);
    // After the tab renders, bring the analysis into view.
    setTimeout(() => contentRef.current?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }), 0);
  };

  // Without the winner's video, playback steps through the timeline once a second.
  useEffect(() => {
    if (!isPlaying || !overview || winnerVideo) return;
    const maxT = Math.max(...Object.values(overview).map(o => o.n_timesteps));
    const interval = setInterval(() => setCurrentTime(t => (t + 1) % maxT), 1000);
    return () => clearInterval(interval);
  }, [isPlaying, overview, winnerVideo]);

  if (job) {
    return (
      <PipelineScreen
        key={job.id}
        jobId={job.id}
        onDone={() => { setJob(null); setAwaitingUpload(false); setActiveTab('overview'); setCurrentTime(0); loadData(); }}
        onBack={() => { setJob(null); loadData(); }}
        onRetry={job.videos ? async () => {
          const { job_id } = await createJob(job.mode, job.videos, job.meta);
          setJob(j => ({ ...j, id: job_id }));
        } : undefined}
      />
    );
  }

  const openedRun = () => { setShowWorkspace(false); setAwaitingUpload(false); setActiveTab('overview'); setCurrentTime(0); setIsPlaying(false); loadData(); };

  if (showWorkspace) {
    return (
      <WorkspaceScreen
        onOpened={openedRun}
        onNewAnalysis={() => { setShowWorkspace(false); setAwaitingUpload(true); }}
        onClose={overview ? () => { setShowWorkspace(false); loadData(); } : undefined}
      />
    );
  }

  if (awaitingUpload) {
    return (
      <UploadDataScreen
        onJobStarted={(id, videos, mode, meta) => setJob({ id, videos, mode, meta })}
        onDataLoaded={() => loadData()}
        onCancel={overview ? () => setAwaitingUpload(false) : undefined}
        onOpenWorkspace={() => { setAwaitingUpload(false); setShowWorkspace(true); }}
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
        <Alert tone="danger" title="Rewire can't be reached right now">
          Check your connection, then try again.
        </Alert>
        <Button variant="secondary" onClick={loadData}>Try again</Button>
      </div>
    );
  }

  const maxTimesteps = Math.max(...variants.map(v => overview[v].n_timesteps));
  const tab = TABS.find(t => t.id === activeTab);


  return (
    <div className="app-root">
      <header className="app-header">
        <div className="brand">
          <span className="brand-name">Rewire</span>
          {runInfo?.title && <span className="brand-run">{runInfo.title}</span>}
          <span className="brand-sub">{single ? 'One creative' : 'Two creatives'}, {maxTimesteps}s, 200 simulated viewers</span>
        </div>
        <div className="header-actions">
          <span className="theme-toggle"><ThemeSwitch theme={theme} variant="rise" iconOnly onThemeChange={changeTheme} /></span>
          <Button variant="ghost" onClick={() => { videoPause(); setShowWorkspace(true); }}>Workspace</Button>
          <Button variant="secondary" onClick={() => { videoPause(); setAwaitingUpload(true); }}>New analysis</Button>
          <Button variant={single ? 'primary' : 'secondary'} onClick={() => { videoPause(); setSharing(true); }}>
            <Share2 size={16} strokeWidth={1.75} aria-hidden="true" /> Share scorecard
          </Button>
          {/* The printable report compares a pair; it is offered when two creatives are loaded. */}
          {!single && <ActionButton
            label="Export report"
            pendingLabel="Building report"
            successLabel="Report ready"
            onAction={handleGenerateReport}
            onActionError={() => {}}
          />}
        </div>
      </header>

      {sharing && (
        <ShareDialog
          onClose={() => setSharing(false)}
          overview={overview}
          engagement={engagement}
          abSummary={abSummary}
          runInfo={runInfo}
          videos={shareVideos}
          timeSeries={timeSeries}
          captureBrain={captureBrain}
        />
      )}

      <main className="app-main">
        <div className="stage">
          <CortexMonitor
            ref={brainRef}
            currentTime={currentTime}
            variant={brainVariant}
            variants={variants}
            onVariantChange={setBrainVariant}
            cohort={brainDemographic}
            onCohortChange={setBrainDemographic}
          />
          <WinnerPlayer
            winner={single ? 'SINGLE' : winner}
            videoUrl={winnerVideo}
            videoRef={playerRef}
            currentTime={currentTime}
            duration={maxTimesteps}
            peakTime={overview[shown].peak_timestep}
            isPlaying={isPlaying}
            onTogglePlay={togglePlayback}
            onSeek={handleSeekToTimestamp}
            onTimeUpdate={handleTimeUpdate}
            onPlayingChange={setIsPlaying}
            onAddVideo={() => setAwaitingUpload(true)}
          />
          <CreativeTimeline
            duration={maxTimesteps}
            currentTime={currentTime}
            onSeek={handleSeekToTimestamp}
            tracks={tracks}
            onOpenTab={openTab}
            onPlayRange={playRange}
            loopRange={loopRange}
            storageKey={notesKey}
          />
        </div>

        <div className="app-content" ref={contentRef}>
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
                <div className="span-7"><OverviewPanel dataA={overview.A} dataB={overview.B} onSeekToTimestamp={handleSeekToTimestamp} /></div>
                <div className="span-5"><KeyMetricsPanel overview={overview} engagement={engagement} demographics={demographics} /></div>
                <div className="span-12"><AsymmetryPanel dataA={overview.A} dataB={overview.B} /></div>
              </div>
            </TabsContent>

            <TabsContent value="audiences">
              <div className="bento">
                <div className={single ? 'span-12' : 'span-7'}><EngagementPanel dataA={engagement.A} dataB={engagement.B} /></div>
                {!single && <div className="span-5">{abSummary && <ContestsPanel data={abSummary} />}</div>}
                <div className="span-12">{abSummary && <DimensionalLeadPanel data={abSummary} />}</div>
                <div className="span-12">
                  <DemoTimeSeries
                    dataA={timeSeries?.A?.timeseries || timeSeries?.A}
                    dataB={timeSeries?.B?.timeseries || timeSeries?.B}
                    labels={demographics.A.labels}
                    transcriptA={overview.A.transcript}
                    transcriptB={overview.B?.transcript}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="scenes">
              <ImpactScenes videoUrlA={videoUrlA} videoUrlB={videoUrlB} overviewA={overview.A} overviewB={overview.B} onSeekToTimestamp={handleSeekToTimestamp} />
            </TabsContent>

            <TabsContent value="ensemble">
              {activeTab === 'ensemble' && <EnsembleExplorer variants={variants} winner={winner === 'B' ? 'B' : 'A'} currentTime={currentTime} theme={theme} />}
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
