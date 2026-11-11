import React, { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/arc/button/button';
import { Badge } from '@/components/arc/badge/badge';
import { SearchField } from '@/components/arc/search-field/search-field';
import SegmentedControl from '@/components/arc/segmented-control/segmented-control';
import { InlineEdit } from '@/components/arc/inline-edit/inline-edit';
import { ConfirmMorph } from '@/components/arc/confirm-morph/confirm-morph';
import { EmptyState } from '@/components/arc/empty-state/empty-state';
import { Skeleton } from '@/components/arc/skeleton/skeleton';
import { Alert } from '@/components/arc/alert/alert';
import { fetchRuns, openRun, renameRun, deleteRun, runMediaUrl } from '../api';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'single', label: 'One video' },
  { value: 'compare', label: 'Comparisons' },
];
const DIMENSION_NAMES = { visual: 'visual', auditory: 'auditory', reward: 'reward', memory: 'memory', attention: 'attention', narrative: 'narrative', personal: 'self-relevance', action: 'action' };

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const when = s => (s ? dateFmt.format(new Date(s * 1000)) : '');
const length = run => {
  const secs = Object.values(run.durations || {}).filter(Boolean);
  const fromSummary = Object.values(run.summary?.variants || {}).map(v => v.seconds);
  const all = secs.length ? secs : fromSummary;
  return all.length ? all.map(s => `${Math.round(s)}s`).join(' and ') : null;
};

/** The headline of a saved run, in words: who won, or where a single creative lands hardest. */
function outcome(run) {
  const s = run.summary;
  if (!s) return 'Open it once to record its result';
  if (run.mode === 'compare' && s.winner) {
    if (s.winner === 'TIE') return 'Evenly matched';
    return <><span className={s.winner === 'B' ? 'num-b' : 'num-a'}>Variant {s.winner}</span> {s.lead_pct != null ? `leads by ${Math.round(s.lead_pct)}% overall` : 'leads overall'}</>;
  }
  const v = s.variants?.A;
  if (!v) return '';
  return <>Strongest with <span className="num-a">{v.best_cohort_label.replace(/\s*\(.*\)/, '')}</span>, led by {DIMENSION_NAMES[v.top_dimension] ?? v.top_dimension}</>;
}

/**
 * Every analysis saved on this computer: runs from videos and imported predictions. Open one to load it into the
 * dashboard (with its videos, when they were kept), rename it in place, or delete it.
 */
export default function WorkspaceScreen({ onOpened, onNewAnalysis, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [opening, setOpening] = useState(null);

  const load = () => fetchRuns().then(setData).catch(() => setError('The workspace could not load. Check your connection and try again.'));
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.runs ?? []).filter(r => (filter === 'all' || r.mode === filter)
      && (!q || [r.title, ...Object.values(r.names || {})].some(t => t?.toLowerCase().includes(q))));
  }, [data, query, filter]);

  const open = async run => {
    setOpening(run.id); setError(null);
    try {
      await openRun(run.id);
      onOpened(run);
    } catch (err) {
      setError(err.response?.data?.detail || 'This analysis could not be opened.');
      setOpening(null);
    }
  };

  const total = data?.runs.length ?? 0;
  const disk = (data?.runs ?? []).reduce((s, r) => s + (r.size_mb || 0), 0);

  return (
    <main className="onboard workspace">
      <div className="onboard-inner">
        <p className="onboard-brand">Rewire</p>
        <header className="onboard-head workspace-head">
          <div>
            <h1>Workspace</h1>
            <p className="onboard-lede">
              {data ? `${total} ${total === 1 ? 'analysis' : 'analyses'} saved on this computer${total ? `, ${disk.toFixed(0)} MB` : ''}.` : 'Loading saved analyses.'}
            </p>
          </div>
          <div className="onboard-actions-end">
            {onClose && <Button variant="ghost" onClick={onClose}>Back to results</Button>}
            <Button onClick={onNewAnalysis}>New analysis</Button>
          </div>
        </header>

        {error && <Alert tone="danger" title="Something went wrong" onDismiss={() => setError(null)}>{error}</Alert>}

        {!data ? (
          <Skeleton lines={4} label="Loading saved analyses" />
        ) : total === 0 ? (
          <EmptyState icon={null} title="Nothing saved yet" description="Every analysis you run is kept here, with its videos, so you can come back to it." action={<Button onClick={onNewAnalysis}>Analyse a video</Button>} />
        ) : (
          <>
            <div className="workspace-tools">
              <div className="workspace-search"><SearchField label="Search analyses" placeholder="Title or file name" value={query} onValueChange={setQuery} /></div>
              <SegmentedControl label="Show" options={FILTERS} value={filter} onValueChange={setFilter} />
            </div>

            {shown.length === 0 ? (
              <EmptyState icon={null} title="No matching analyses" description="Try another title or file name." action={<Button variant="secondary" onClick={() => { setQuery(''); setFilter('all'); }}>Clear filters</Button>} />
            ) : (
              <ul className="run-list">
                {shown.map(run => (
                  <li key={run.id} className={`run-row ${data.current === run.id ? 'is-current' : ''}`}>
                    <div className={`run-thumbs ${run.variants.length > 1 ? 'is-pair' : ''}`} aria-hidden="true">
                      {run.variants.map(v => run.thumbs?.[v]
                        ? <img key={v} src={runMediaUrl(run.id, v, 'thumb')} alt="" loading="lazy" />
                        : <span key={v} className="run-thumb-empty">{run.source === 'import' ? 'Predictions' : 'No video'}</span>)}
                    </div>

                    <div className="run-main">
                      <InlineEdit
                        as="h2"
                        variant="body"
                        label={`Title of the analysis from ${when(run.created)}`}
                        value={run.title}
                        validate={t => (t.trim() ? null : 'A title cannot be empty')}
                        onSave={async t => {
                          const res = await renameRun(run.id, t.trim());
                          setData(d => ({ ...d, runs: d.runs.map(r => (r.id === run.id ? { ...r, title: res.title } : r)) }));
                        }}
                        className="run-title"
                      />
                      <p className="run-meta">
                        <Badge size="sm" tone={run.mode === 'compare' ? 'info' : 'neutral'}>{run.mode === 'compare' ? 'Comparison' : 'One video'}</Badge>
                        {run.source === 'import' && <Badge size="sm">Imported</Badge>}
                        {data.current === run.id && <Badge size="sm" tone="success">Open now</Badge>}
                        <span>{run.variants.map(v => run.names?.[v]).filter(Boolean).join(', ')}</span>
                        {length(run) && <span>{length(run)}</span>}
                        <span>{when(run.created)}</span>
                      </p>
                      <p className="run-outcome">{outcome(run)}</p>
                    </div>

                    <div className="run-actions">
                      <Button variant={data.current === run.id ? 'secondary' : 'primary'} size="sm" loading={opening === run.id} disabled={!!opening && opening !== run.id} onClick={() => open(run)}>
                        {data.current === run.id ? 'Show' : 'Open'}
                      </Button>
                      <ConfirmMorph
                        label="Delete"
                        icon={<Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />}
                        prompt="Delete this analysis and its videos?"
                        confirmLabel="Delete"
                        pendingLabel="Deleting"
                        doneLabel="Deleted"
                        tone="danger"
                        resultTimeout={1200}
                        onConfirm={async () => {
                          await deleteRun(run.id);
                          setTimeout(() => setData(d => ({ ...d, runs: d.runs.filter(r => r.id !== run.id) })), 900);
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}
