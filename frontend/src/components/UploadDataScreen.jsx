import React, { useRef, useState } from 'react';
import { Button } from '@/components/arc/button/button';
import { FileDropzone } from '@/components/arc/file-dropzone/file-dropzone';
import { Alert } from '@/components/arc/alert/alert';
import { createJob, loadSampleData } from '../api';
import AssetList from './AssetList';
import { releaseUrl } from '@/lib/object-urls';

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
  const [durations, setDurations] = useState({});
  const [busy, setBusy] = useState(null);           // 'run' or 'sample'
  const [uploadPct, setUploadPct] = useState(0);
  const [error, setError] = useState(null);
  const upload = useRef(null);    // aborts the upload when the person cancels it

  const mode = videos.files.length === 2 ? 'compare' : 'single';
  const tooLong = videos.files.some(f => durations[f.id] > MAX_SECONDS);
  const ready = videos.files.length > 0 && !tooLong;
  const bySlot = (slots, pick) => Object.fromEntries(slots.files.map((f, i) => [i === 0 ? 'A' : 'B', pick(f)]));

  const run = async () => {
    if (!ready || busy) return;
    setBusy('run'); setError(null); setUploadPct(0);
    upload.current = new AbortController();
    try {
      const chosen = bySlot(videos, f => f.file);
      const { job_id } = await createJob(mode, chosen, {}, e => e.total && setUploadPct(Math.round((e.loaded / e.total) * 100)), upload.current.signal);
      onJobStarted(job_id, chosen, mode, {});
    } catch (err) {
      // A cancelled upload is the person's choice, not an error to report.
      if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
        setError(err.response?.data?.detail || 'The videos could not be sent. Check your connection and try again.');
      }
      setBusy(null);
    } finally {
      upload.current = null;
    }
  };

  const useSamples = async () => {
    setBusy('sample'); setError(null);
    try {
      await loadSampleData();
      onDataLoaded();
    } catch {
      setError('The sample could not load. Try again in a moment.');
    } finally { setBusy(null); }
  };

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
