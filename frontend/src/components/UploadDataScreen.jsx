import React, { useRef, useState } from 'react';
import { Button } from '@/components/arc/button/button';
import { Select } from '@/components/arc/select/select';
import { FileDropzone } from '@/components/arc/file-dropzone/file-dropzone';
import { Accordion } from '@/components/arc/accordion/accordion';
import { Alert } from '@/components/arc/alert/alert';
import { createJob, uploadPredictions, fetchStatus, loadSampleData } from '../api';
import AssetList from './AssetList';
import { releaseUrl } from '@/lib/object-urls';

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
const DEFAULT_META = { genre: 'general', content_type: 'video_ad', pacing: 'medium', audio_profile: 'mixed' };
const VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm,.mkv';
const MAX_MB = 500;
const MAX_SECONDS = 180;

let nextId = 0;
const fileIds = new WeakMap();
const idOf = file => {
  if (!fileIds.has(file)) fileIds.set(file, `f${nextId++}`);
  return fileIds.get(file);
};

/**
 * An ordered set of up to two files fed by one Arc drop zone. The drop zone keeps its own list, which cannot be
 * reordered from outside, so its list is hidden and remounted (with the current files) after a swap or removal.
 */
function useFileSlots() {
  const [files, setFiles] = useState([]);         // [{ id, file }], index 0 is A, index 1 is B
  const [zoneKey, setZoneKey] = useState(0);
  // Files that leave the list give back their preview URL.
  const release = (prev, next) => prev.filter(p => !next.some(n => n.file === p.file)).forEach(p => releaseUrl(p.file));
  const fromZone = list => {
    const next = list.slice(0, 2).map(file => ({ id: idOf(file), file }));
    setFiles(prev => { release(prev, next); return next; });
  };
  const remount = next => { release(files, next); setFiles(next); setZoneKey(k => k + 1); };
  return {
    files,
    zoneKey,
    defaultItems: files.map(({ id, file }) => ({ id, name: file.name, size: file.size, file })),
    fromZone,
    swap: () => remount([...files].reverse()),
    remove: id => remount(files.filter(f => f.id !== id)),
  };
}

/**
 * The start of every analysis: drop one video to analyse it, or two to compare them, in one drop zone. Rewire works
 * out the analysis from what was dropped and shows which file is which before anything runs.
 */
const UploadDataScreen = ({ onJobStarted, onDataLoaded, onCancel, onOpenWorkspace }) => {
  const videos = useFileSlots();
  const pkls = useFileSlots();
  const [durations, setDurations] = useState({});
  const [metaById, setMetaById] = useState({});    // creative details follow the file, so a swap keeps them right
  const [busy, setBusy] = useState(null);           // 'run', 'import' or 'sample'
  const [uploadPct, setUploadPct] = useState(0);
  const [error, setError] = useState(null);
  const upload = useRef(null);    // aborts the upload when the person cancels it

  const mode = videos.files.length === 2 ? 'compare' : 'single';
  const labelAt = (i, count) => (count === 1 ? 'Your video' : `Variant ${i === 0 ? 'A' : 'B'}`);
  const tooLong = videos.files.some(f => durations[f.id] > MAX_SECONDS);
  const ready = videos.files.length > 0 && !tooLong;
  const metaOf = id => metaById[id] ?? DEFAULT_META;
  const bySlot = (slots, pick) => Object.fromEntries(slots.files.map((f, i) => [i === 0 ? 'A' : 'B', pick(f)]));

  const run = async () => {
    if (!ready || busy) return;
    setBusy('run'); setError(null); setUploadPct(0);
    upload.current = new AbortController();
    try {
      const chosen = bySlot(videos, f => f.file);
      const meta = bySlot(videos, f => metaOf(f.id));
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
    if (!pkls.files.length || busy) return;
    setBusy('import'); setError(null);
    try {
      const [a, b] = pkls.files;
      await uploadPredictions(a.file, b?.file, DEFAULT_META, DEFAULT_META);
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

  const metaFields = ({ id, file }, i) => (
    <div className="meta-col" key={id}>
      <h3 className="aside-title"><span className={videos.files.length === 1 ? '' : i === 0 ? 'num-a' : 'num-b'}>{labelAt(i, videos.files.length)}</span> <span className="meta-file">{file.name}</span></h3>
      {[['Genre', 'genre', GENRE_OPTIONS], ['Format', 'content_type', CONTENT_TYPE_OPTIONS], ['Pacing', 'pacing', PACING_OPTIONS], ['Audio', 'audio_profile', AUDIO_OPTIONS]].map(([label, key, options]) => (
        <Select key={key} label={label} options={options} value={metaOf(id)[key]} onValueChange={val => setMetaById(m => ({ ...m, [id]: { ...metaOf(id), [key]: val } }))} />
      ))}
    </div>
  );

  return (
    <main className="onboard">
      <div className="onboard-inner">
        <p className="onboard-brand">Rewire</p>
        <header className="onboard-head">
          <h1>{mode === 'compare' ? 'Compare two creatives' : 'Analyse a creative'}</h1>
          <p className="onboard-lede">Drop one video to analyse it, or two to compare them. Rewire predicts how 200 simulated viewers respond, second by second. Videos up to 3 minutes and {MAX_MB} MB each.</p>
        </header>

        <section className="single-drop" aria-label="Videos">
          <FileDropzone
            key={`videos-${videos.zoneKey}`}
            accept={VIDEO_ACCEPT}
            multiple
            maxFiles={2}
            maxSize={MAX_MB * 1024 * 1024}
            defaultItems={videos.defaultItems}
            label={videos.files.length === 2 ? 'Two videos added' : videos.files.length === 1 ? 'Add a second video to compare' : 'Add one or two videos'}
            description="Drop MP4 or MOV files here, or choose them"
            note="One video to analyse, two to compare"
            compactAt={1}
            onFilesChange={videos.fromZone}
          />
          <AssetList
            files={videos.files}
            durations={durations}
            onDuration={(id, d) => setDurations(m => ({ ...m, [id]: d }))}
            onSwap={videos.swap}
            onRemove={videos.remove}
          />
        </section>

        <Accordion
          defaultOpen={-1}
          items={[
            {
              title: 'Creative details (optional)',
              content: videos.files.length
                ? <div className={`meta-grid ${videos.files.length === 1 ? 'is-single' : ''}`}>{videos.files.map(metaFields)}</div>
                : <p className="onboard-lede">Add a video first; its details appear here.</p>,
            },
            {
              title: 'Import saved predictions (.pkl)',
              content: (
                <div className="pkl-import single-drop">
                  <p className="onboard-lede">Already have prediction files from an earlier run? Drop one to analyse it, or two to compare, and skip the GPU step.</p>
                  <FileDropzone
                    key={`pkls-${pkls.zoneKey}`}
                    accept=".pkl"
                    multiple
                    maxFiles={2}
                    defaultItems={pkls.defaultItems}
                    label="Add one or two .pkl files"
                    description="Drop the prediction files here"
                    compactAt={1}
                    onFilesChange={pkls.fromZone}
                  />
                  <AssetList files={pkls.files} kind="pkl" onSwap={pkls.swap} onRemove={pkls.remove} />
                  <Button variant="secondary" loading={busy === 'import'} disabled={!pkls.files.length || (busy && busy !== 'import')} onClick={importPredictions}>Import and open</Button>
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
              {busy === 'run' ? `Uploading ${uploadPct}%` : mode === 'compare' ? 'Compare videos' : 'Run analysis'}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default UploadDataScreen;
