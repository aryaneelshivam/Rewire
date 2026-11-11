import React, { useEffect, useRef, useState } from 'react';
import { Stepper } from '@/components/arc/stepper/stepper';
import { Progress } from '@/components/arc/progress/progress';
import { Button } from '@/components/arc/button/button';
import { Alert } from '@/components/arc/alert/alert';
import { Badge } from '@/components/arc/badge/badge';
import { fetchJob, cancelJob } from '../api';

const clock = s => {
  const t = Math.max(0, Math.round(s));
  return t >= 60 ? `${Math.floor(t / 60)}m ${String(t % 60).padStart(2, '0')}s` : `${t}s`;
};
const mb = bytes => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/**
 * Follows an analysis job until it finishes: the whole run as a stepper, and each video's trip through the GPU
 * as a progress row. Opens the dashboard when the results are ready.
 */
export default function PipelineScreen({ jobId, onDone, onBack, onRetry }) {
  const [job, setJob] = useState(null);
  const [lost, setLost] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const doneRef = useRef(false);
  const offset = useRef(0);        // local clock minus server clock, so elapsed times use the server's timestamps
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);

  useEffect(() => {
    let live = true, timer;
    const tick = async () => {
      try {
        const next = await fetchJob(jobId);
        if (!live) return;
        offset.current = Date.now() / 1000 - next.now;
        setJob(next); setLost(false);
        if (next.status === 'done' && !doneRef.current) { doneRef.current = true; setTimeout(onDone, 700); return; }
        if (next.status !== 'running') return;
      } catch {
        if (live) setLost(true);
      }
      timer = setTimeout(tick, 1000);
    };
    tick();
    return () => { live = false; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  if (!job) {
    return <main className="onboard"><div className="onboard-inner"><p className="onboard-brand">Rewire</p><h1>Starting the analysis</h1>{lost && <Alert tone="warning" title="The backend is not answering">Retrying every second.</Alert>}</div></main>;
  }

  const now = Date.now() / 1000 - offset.current;
  const firstOpen = job.stages.findIndex(s => s.state !== 'done');
  const current = firstOpen === -1 ? job.stages.length : firstOpen;
  const steps = job.stages.map(s => ({
    id: s.key,
    label: s.label,
    description: s.state === 'running' && s.started ? [s.detail, clock(now - s.started)].filter(Boolean).join(', ') : s.detail || undefined,
    error: s.state === 'failed' ? s.detail : undefined,
  }));
  const videoStageIndex = key => Math.max(0, job.video_stages.findIndex(st => st.key === key));
  const stageLabel = key => job.video_stages.find(st => st.key === key)?.label ?? key;
  const running = job.status === 'running';
  const title = { running: 'Analysing', done: 'Analysis complete', failed: 'The analysis stopped', cancelled: 'Analysis cancelled' }[job.status];

  return (
    <main className="onboard pipeline">
      <div className="onboard-inner">
        <p className="onboard-brand">Rewire</p>
        <header className="onboard-head">
          <h1>{title}</h1>
          <p className="onboard-lede">
            {job.mode === 'compare' ? 'Two videos' : 'One video'}, started {clock(now - job.created)} ago.
            {running && ' You can leave this page open; the dashboard opens on its own when the results are ready.'}
          </p>
        </header>

        <div className="pipeline-body">
          <Stepper steps={steps} current={current} orientation="vertical" label="Analysis stages" completeLabel="Analysis complete" />

          <section className="pipeline-videos" aria-label="Videos">
            {job.videos.map(v => {
              const idx = videoStageIndex(v.stage);
              const pct = v.state === 'done' ? 100 : Math.round((idx / (job.video_stages.length - 1)) * 100);
              const elapsed = v.started ? clock((v.ended ?? now) - v.started) : null;
              return (
                <div key={v.variant} className="pipeline-video">
                  <div className="pipeline-video-head">
                    <strong>{job.mode === 'compare' ? `Variant ${v.variant}` : 'Your video'}</strong>
                    <span className="pipeline-file">{v.name}</span>
                    <Badge size="sm" tone={v.state === 'done' ? 'success' : v.state === 'failed' ? 'danger' : 'neutral'}>
                      {v.state === 'done' ? 'Done' : v.state === 'failed' ? 'Failed' : v.state === 'running' ? 'Running' : 'Waiting'}
                    </Badge>
                  </div>
                  <Progress value={pct} label={`${v.name}: ${stageLabel(v.stage)}`} />
                  <p className="pipeline-video-meta">
                    <span>{stageLabel(v.stage)}{v.detail ? `. ${v.detail}` : ''}</span>
                    <span className="num-key">{[v.duration && `${Math.round(v.duration)}s video`, mb(v.size), elapsed].filter(Boolean).join(' · ')}</span>
                  </p>
                </div>
              );
            })}
            <p className="pipeline-note">
              {job.engine === 'modal'
                ? 'Prediction runs on a cloud GPU. The first run after a while starts the GPU and loads the model, which takes a few minutes; later runs are faster.'
                : 'Replay engine: sample predictions are used instead of the GPU, for testing.'}
            </p>
          </section>
        </div>

        {lost && running && <Alert tone="warning" title="The backend is not answering">Still trying. The analysis keeps running on the backend.</Alert>}
        {(job.status === 'failed' || job.status === 'cancelled') && (
          <Alert tone={job.status === 'failed' ? 'danger' : 'neutral'} title={job.status === 'failed' ? 'Something went wrong' : 'Cancelled'}>{job.error}</Alert>
        )}

        <div className="onboard-actions">
          <span />
          <div className="onboard-actions-end">
            {running ? (
              <Button variant="secondary" loading={cancelling} onClick={async () => { setCancelling(true); try { await cancelJob(jobId); } finally { setCancelling(false); } }}>Cancel</Button>
            ) : job.status !== 'done' && (
              <>
                <Button variant="ghost" onClick={onBack}>Back</Button>
                {onRetry && <Button onClick={onRetry}>Try again</Button>}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
