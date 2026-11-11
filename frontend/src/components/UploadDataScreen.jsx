import React, { useRef, useState } from 'react';
import { Button } from '@/components/arc/button/button';
import { Select } from '@/components/arc/select/select';
import { FileDropzone } from '@/components/arc/file-dropzone/file-dropzone';
import { Accordion } from '@/components/arc/accordion/accordion';
import { Alert } from '@/components/arc/alert/alert';
import SegmentedControl from '@/components/arc/segmented-control/segmented-control';
import { createJob, uploadPredictions, fetchStatus, loadSampleData } from '../api';

const GENRE_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'emotional', label: 'Emotional' },
  { value: 'humor', label: 'Humor' },
  { value: 'action', label: 'Action' },
  { value: 'informational', label: 'Informational' },
  { value: 'luxury', label: 'Luxury' },
];
const PACING_OPTIONS = [
  { value: 'fast_cut', label: 'Fast cut (under 2s a shot)' },
  { value: 'medium', label: 'Medium' },
  { value: 'slow_burn', label: 'Slow burn (over 5s a shot)' },
];
const AUDIO_OPTIONS = [
  { value: 'music_heavy', label: 'Music heavy' },
  { value: 'dialogue_heavy', label: 'Dialogue heavy' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'silent', label: 'Silent or ambient' },
];
const CONTENT_TYPE_OPTIONS = [
  { value: 'video_ad', label: 'Video ad' },
  { value: 'music_video', label: 'Music video' },
  { value: 'trailer', label: 'Trailer' },
  { value: 'short_form', label: 'Short form' },
];
const MODES = [
  { value: 'single', label: 'One video' },
  { value: 'compare', label: 'Two videos' },
];
const DEFAULT_META = { genre: 'general', content_type: 'video_ad', pacing: 'medium', audio_profile: 'mixed' };
const VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm,.mkv';
const MAX_MB = 500;

/**
 * The start of every analysis: choose one video or two, drop them in, and run. The videos go to the backend
 * pipeline; a copy stays in the browser for playback on the dashboard.
 */
const UploadDataScreen = ({ onJobStarted, onDataLoaded, onCancel, onOpenWorkspace, initialMode = 'single' }) => {
  const [mode, setMode] = useState(initialMode);
  const [videos, setVideos] = useState({ A: null, B: null });
  const [meta, setMeta] = useState({ A: DEFAULT_META, B: DEFAULT_META });
  const [pkl, setPkl] = useState({ A: null, B: null });
  const [busy, setBusy] = useState(null);           // 'run', 'import' or 'sample'
  const [uploadPct, setUploadPct] = useState(0);
  const [error, setError] = useState(null);
  const upload = useRef(null);    // aborts the upload when the person cancels it

  const variants = mode === 'compare' ? ['A', 'B'] : ['A'];
  const ready = variants.every(v => videos[v]);
  const titleFor = v => (mode === 'single' ? 'Your video' : `Variant ${v}`);

  const run = async () => {
    if (!ready || busy) return;
    setBusy('run'); setError(null); setUploadPct(0);
    upload.current = new AbortController();
    try {
      const chosen = Object.fromEntries(variants.map(v => [v, videos[v]]));
      const { job_id } = await createJob(mode, chosen, meta, e => e.total && setUploadPct(Math.round((e.loaded / e.total) * 100)), upload.current.signal);
      onJobStarted(job_id, chosen, mode, meta);
    } catch (err) {
      // A cancelled upload is the person's choice, not an error to report.
      if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
        setError(err.response?.data?.detail || 'The videos could not be sent. Check that the backend is running and try again.');
      }
      setBusy(null);
    } finally {
      upload.current = null;
    }
  };

  const importPredictions = async () => {
    if (!pkl.A || busy) return;
    setBusy('import'); setError(null);
    try {
      await uploadPredictions(pkl.A, pkl.B, meta.A, meta.B);
      const status = await fetchStatus();
      if (status.loaded) onDataLoaded(); else setError('The files loaded but returned no results.');
    } catch (err) {
      setError(err.response?.data?.detail || 'The prediction files could not be imported.');
    } finally { setBusy(null); }
  };

  const useSamples = async () => {
    setBusy('sample'); setError(null);
    try {
      await loadSampleData();
      onDataLoaded();
    } catch {
      setError('The sample data could not load. Check that the sample files are in the project folder.');
    } finally { setBusy(null); }
  };

  const metaFields = v => (
    <div className="meta-col" key={v}>
      {mode === 'compare' && <h3 className="aside-title">Variant {v}</h3>}
      {[['Genre', 'genre', GENRE_OPTIONS], ['Format', 'content_type', CONTENT_TYPE_OPTIONS], ['Pacing', 'pacing', PACING_OPTIONS], ['Audio', 'audio_profile', AUDIO_OPTIONS]].map(([label, key, options]) => (
        <Select key={key} label={label} options={options} value={meta[v][key]} onValueChange={val => setMeta(m => ({ ...m, [v]: { ...m[v], [key]: val } }))} />
      ))}
    </div>
  );

  return (
    <main className="onboard">
      <div className="onboard-inner">
        <p className="onboard-brand">Rewire</p>
        <header className="onboard-head">
          <h1>{mode === 'single' ? 'Analyse a creative' : 'Compare two creatives'}</h1>
          <p className="onboard-lede">{mode === 'single' ? 'Drop in your video' : 'Drop in both videos'} and Rewire predicts how 200 simulated viewers respond, second by second. Videos up to 3 minutes and {MAX_MB} MB each.</p>
        </header>

        <div className="onboard-mode">
          <SegmentedControl label="How many videos" options={MODES} value={mode} onValueChange={m => { setMode(m); setError(null); }} />
        </div>

        <div className={`variant-cols ${mode === 'single' ? 'is-single' : ''}`}>
          {variants.map(v => (
            <section key={`${mode}-${v}`} className="variant-col" aria-labelledby={`video-${v}`}>
              <h2 id={`video-${v}`}>{titleFor(v)}</h2>
              <FileDropzone
                accept={VIDEO_ACCEPT}
                multiple={false}
                maxFiles={1}
                maxSize={MAX_MB * 1024 * 1024}
                label={videos[v] ? 'Replace video' : 'Add video'}
                description="Drop an MP4 or MOV, or choose a file"
                note="Required"
                onFilesChange={files => setVideos(s => ({ ...s, [v]: files[0] ?? null }))}
              />
            </section>
          ))}
        </div>

        <Accordion
          defaultOpen={-1}
          items={[
            { title: 'Creative details (optional)', content: <div className={`meta-grid ${mode === 'single' ? 'is-single' : ''}`}>{variants.map(metaFields)}</div> },
            {
              title: 'Import saved predictions (.pkl)',
              content: (
                <div className="pkl-import">
                  <p className="onboard-lede">Already have prediction files from an earlier run? Import them to skip the GPU step.</p>
                  <div className="variant-cols">
                    {variants.map(v => (
                      <FileDropzone key={`pkl-${mode}-${v}`} accept=".pkl" multiple={false} maxFiles={1} label={`${titleFor(v)} predictions`} description="Drop the .pkl file" onFilesChange={files => setPkl(s => ({ ...s, [v]: files[0] ?? null }))} />
                    ))}
                  </div>
                  <Button variant="secondary" loading={busy === 'import'} disabled={!variants.every(v => pkl[v]) || (busy && busy !== 'import')} onClick={importPredictions}>Import and open</Button>
                </div>
              ),
            },
          ]}
        />

        {error && <Alert tone="danger" title="The analysis did not start">{error}</Alert>}

        <div className="onboard-actions">
          <div className="onboard-actions-end">
            <Button variant="secondary" loading={busy === 'sample'} disabled={busy && busy !== 'sample'} onClick={useSamples}>Use sample data</Button>
            {onOpenWorkspace && <Button variant="ghost" onClick={onOpenWorkspace}>Open workspace</Button>}
          </div>
          <div className="onboard-actions-end">
            {busy === 'run'
              ? <Button variant="ghost" onClick={() => upload.current?.abort()}>Cancel upload</Button>
              : onCancel && <Button variant="ghost" onClick={onCancel}>Back to results</Button>}
            <Button loading={busy === 'run'} disabled={!ready || (busy && busy !== 'run')} onClick={run}>
              {busy === 'run' ? `Uploading ${uploadPct}%` : 'Run analysis'}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default UploadDataScreen;
