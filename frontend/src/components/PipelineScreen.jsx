import React, { useEffect, useMemo, useRef, useState } from 'react';
import { viewerCount } from '@/lib/viewers';
import { Upload, ScanSearch, Cpu, Users, ChartColumn, CircleCheck, CircleX, Ban, AudioLines, Hourglass, Brain } from 'lucide-react';
import { Timeline } from '@/components/arc/timeline/timeline';
import { Progress } from '@/components/arc/progress/progress';
import { Button } from '@/components/arc/button/button';
import { Alert } from '@/components/arc/alert/alert';
import { Badge } from '@/components/arc/badge/badge';
import { ConfirmMorph } from '@/components/arc/confirm-morph/confirm-morph';
import { fetchJob, cancelJob } from '../api';

const clock = s => {
  const t = Math.max(0, Math.round(s));
  return t >= 60 ? `${Math.floor(t / 60)}m ${String(t % 60).padStart(2, '0')}s` : `${t}s`;
};
const mb = bytes => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

// An icon for each kind of event, so the feed reads at a glance. The title always says the outcome as well.
const iconFor = e => {
  const t = `${e.title} ${e.meta ?? ''}`.toLowerCase();
  const I = e.tone === 'danger' ? CircleX
    : t.includes('cancel') ? Ban
    : t.includes('ready') || t.includes('came back') ? CircleCheck
    : t.includes('upload') ? Upload
    : t.includes('check') ? ScanSearch
    : t.includes('queued') || t.includes('waiting') ? Hourglass
    : t.includes('transcrib') ? AudioLines
    : t.includes('gpu') || t.includes('model') ? Cpu
    : t.includes('predict') ? Brain
    : t.includes('viewer') ? Users
    : t.includes('scor') ? ChartColumn
    : null;
  return I ? <I size={14} strokeWidth={1.75} aria-hidden="true" /> : undefined;
};

/**
 * Follows an analysis job until it finishes. The run unfolds as an activity feed, newest first: each stage as it
 * starts and finishes, each video's trip through the GPU, and any error, which opens in place. Above it, overall
 * progress and a row per video keep parallel work visible. The dashboard opens when the results are ready.
 */
export default function PipelineScreen({ jobId, onDone, onBack, onRetry }) {
  const [job, setJob] = useState(null);
  const [lost, setLost] = useState(false);
  const [gone, setGone] = useState(false);      // the backend no longer knows this job (it restarted)
  const doneRef = useRef(false);
  const offset = useRef(0);                      // local clock minus server clock, so times use the server's timestamps
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);

  useEffect(() => {
    let live = true, timer;
    const poll = async () => {
      try {
        const next = await fetchJob(jobId);
        if (!live) return;
        offset.current = Date.now() / 1000 - next.now;
        setJob(next); setLost(false);
        if (next.status === 'done' && !doneRef.current) { doneRef.current = true; setTimeout(onDone, 1200); return; }
        if (next.status !== 'running') return;
      } catch (err) {
        if (!live) return;
        if (err.response?.status === 404) { setGone(true); return; }
        setLost(true);
      }
      timer = setTimeout(poll, 1000);
    };
    poll();
    return () => { live = false; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // Server timestamps shifted onto this machine's clock, so "just now" and the day group match the feed's `now`.
  // Events within the same millisecond would sort arbitrarily, so each one is kept at least 1ms after the one before.
  const events = useMemo(() => {
    let last = 0;
    return (job?.events ?? []).map(e => {
      last = Math.max(last + 1, Math.round((e.at + offset.current) * 1000));
      return {
        id: e.id,
        at: last,
        actor: e.actor ?? undefined,
        title: e.title,
        meta: e.meta ?? undefined,
        tone: e.tone,
        icon: iconFor(e),
        detail: e.detail ? <pre className="feed-error">{e.detail}</pre> : undefined,
      };
    });
  }, [job]);
  const failureIds = useMemo(() => events.filter(e => e.tone === 'danger' && e.detail).map(e => e.id), [events]);

  if (gone) {
    return (
      <main className="onboard"><div className="onboard-inner">
        <p className="onboard-brand">Rewire</p>
        <h1>This analysis was interrupted</h1>
        <Alert tone="warning" title="It stopped before finishing">Nothing was saved from it. Completed analyses are safe in the workspace.</Alert>
        <div className="onboard-actions"><span /><div className="onboard-actions-end"><Button variant="secondary" onClick={onBack}>Back</Button>{onRetry && <Button onClick={() => { setGone(false); onRetry(); }}>Run it again</Button>}</div></div>
      </div></main>
    );
  }

  if (!job) {
    return <main className="onboard"><div className="onboard-inner"><p className="onboard-brand">Rewire</p><h1>Starting the analysis</h1>{lost && <Alert tone="warning" title="Connection lost">Reconnecting.</Alert>}</div></main>;
  }

  const now = Date.now() / 1000 - offset.current;
  const running = job.status === 'running';
  const done = job.stages.filter(s => s.state === 'done').length;
  const active = job.stages.find(s => s.state === 'running');
  const stageLabel = key => job.video_stages.find(st => st.key === key)?.label ?? key;
  const videoStageIndex = key => Math.max(0, job.video_stages.findIndex(st => st.key === key));
  const title = { running: 'Analysing', done: 'Analysis complete', failed: 'The analysis stopped', cancelled: 'Analysis cancelled' }[job.status];
  const activeText = active ? { checked: 'Checking the videos', predicting: 'Predicting brain response', synthesis: `Simulating ${viewerCount(job.viewers)} viewers`, scoring: 'Scoring the results' }[active.key] ?? active.label : title;

  return (
    <main className="onboard pipeline">
      <div className="onboard-inner">
        <p className="onboard-brand">Rewire</p>
        <header className="onboard-head pipeline-head">
          <div>
            <h1>{title}</h1>
            <p className="onboard-lede">
              {job.mode === 'compare' ? 'Two videos' : 'One video'}, started {clock(now - job.created)} ago.
              {running && ' You can leave this page open; the dashboard opens on its own when the results are ready.'}
            </p>
          </div>
          {running && (
            // Stopping throws away GPU work already done, so it asks first. The feed shows the request and the outcome.
            <ConfirmMorph
              label="Cancel analysis"
              icon={<Ban size={16} strokeWidth={1.75} aria-hidden="true" />}
              prompt="Stop this analysis? Nothing will be saved."
              confirmLabel="Stop it"
              cancelLabel="Keep going"
              pendingLabel="Stopping"
              doneLabel="Stopping"
              tone="danger"
              confirmTimeout={8000}
              resultTimeout={0}
              onConfirm={() => cancelJob(jobId)}
            />
          )}
        </header>

        <section className="pipeline-overall" aria-label="Overall progress">
          <div className="pipeline-overall-head">
            <strong>{activeText}</strong>
            <span className="num-key">{done} of {job.stages.length} stages{active?.started ? `, ${clock(now - active.started)} on this one` : ''}</span>
          </div>
          <Progress value={(done / job.stages.length) * 100} label={`Analysis progress: ${done} of ${job.stages.length} stages done`} />
        </section>

        <div className="pipeline-body">
          <section className="pipeline-videos" aria-label="Videos">
            {job.videos.map(v => {
              const idx = videoStageIndex(v.stage);
              const pct = v.state === 'done' ? 100 : Math.round((idx / (job.video_stages.length - 1)) * 100);
              const elapsed = v.started ? clock((v.ended ?? now) - v.started) : null;
              return (
                <div key={v.variant} className="pipeline-video">
                  <div className="pipeline-video-head">
                    <strong>{job.mode === 'compare' ? `Variant ${v.variant}` : 'Your video'}</strong>
                    <Badge size="sm" tone={v.state === 'done' ? 'success' : v.state === 'failed' ? 'danger' : 'neutral'}>
                      {v.state === 'done' ? 'Done' : v.state === 'failed' ? 'Failed' : v.state === 'running' ? 'Running' : 'Waiting'}
                    </Badge>
                  </div>
                  <span className="pipeline-file">{v.name}</span>
                  <Progress value={pct} label={`${v.name}: ${stageLabel(v.stage)}`} />
                  <p className="pipeline-video-meta">
                    <span>{stageLabel(v.stage)}</span>
                    <span className="num-key">{[v.duration && `${Math.round(v.duration)}s`, mb(v.size), elapsed].filter(Boolean).join(' · ')}</span>
                  </p>
                </div>
              );
            })}
            <p className="pipeline-note">Most videos take a few minutes; longer videos take longer. You can leave this page open.</p>
          </section>

          <section className="pipeline-feed" aria-label="Activity">
            <Timeline
              key={`${job.id}-${failureIds.join('')}`}   // remount when an error arrives, so it opens expanded
              events={events}
              now={Date.now()}
              label="Analysis activity, newest first"
              timeZone={timeZone}
              maxHeight={440}
              defaultExpanded={failureIds}
              headingLevel={2}
            />
          </section>
        </div>

        {lost && running && <Alert tone="warning" title="Connection lost">Reconnecting. Your analysis keeps running in the meantime.</Alert>}

        <div className="onboard-actions">
          <span />
          <div className="onboard-actions-end">
            {!running && job.status !== 'done' && (
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
