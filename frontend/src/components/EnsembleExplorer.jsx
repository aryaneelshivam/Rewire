import React, { useEffect, useMemo, useState } from 'react';
import { RotateCw } from 'lucide-react';
import SegmentedControl from '@/components/arc/segmented-control/segmented-control';
import { Select } from '@/components/arc/select/select';
import { Slider } from '@/components/arc/slider/slider';
import { Button } from '@/components/arc/button/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/arc/toggle-group/toggle-group';
import { LineChart } from '@/components/arc/line-chart/line-chart';
import { Ridgeline } from '@/components/arc/ridgeline/ridgeline';
import { Progress } from '@/components/arc/progress/progress';
import { SortableDataTable } from '@/components/arc/sortable-data-table/sortable-data-table';
import { EmptyState } from '@/components/arc/empty-state/empty-state';
import { Skeleton } from '@/components/arc/skeleton/skeleton';
import { Alert } from '@/components/arc/alert/alert';
import { fetchEnsemble, fetchEnsembleActivation } from '../api';
import { CHART_COLORS, timeSeriesData, zFormat } from '@/lib/chart-data';
import { BASES, featureRows, standardize, pca, clusterRows, nearestEdges, layoutFor, contrast, meanTrajectory, cohortMix, describe, dimensionLabel, mean } from '@/lib/ensemble';
import { fmtClock } from '@/lib/timeline-events';
import EnsembleGraph3D from './EnsembleGraph3D';
import BrainViewer3D from './BrainViewer3D';
import { Card } from './ui';

const VIEWS = [
  { value: 'similarity', label: 'Similarity' },
  { value: 'temporal', label: 'Temporal' },
  { value: 'regional', label: 'Regional' },
];
const GROUP_COUNTS = [{ value: 'auto', label: 'Best fit' }, ...[3, 4, 5, 6].map(k => ({ value: String(k), label: `${k} groups` }))];
const BRAIN_MODES = [
  { value: 'cluster', label: 'This group' },
  { value: 'rest', label: 'Everyone else' },
  { value: 'difference', label: 'Where it is higher' },
];

/**
 * The 200 simulated viewers as a graph. Viewers who respond alike sit together and are joined; groups found in
 * the chosen basis keep their colour across views. Selecting a group shows what sets it apart from the rest.
 */
export default function EnsembleExplorer({ variants, winner, currentTime, theme }) {
  const [variant, setVariant] = useState(winner);
  const [store, setStore] = useState({});
  const [error, setError] = useState(null);
  const [view, setView] = useState('similarity');
  const [basis, setBasis] = useState('trajectory');
  const [groupCount, setGroupCount] = useState('auto');
  const [segment, setSegment] = useState(null);
  const [region, setRegion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [picked, setPicked] = useState(null);
  const [hover, setHover] = useState(null);
  const [rotate, setRotate] = useState(true);
  const [brainMode, setBrainMode] = useState('cluster');
  const [metric, setMetric] = useState('mean');

  const data = store[variant];
  useEffect(() => {
    if (store[variant]) return;
    let live = true;
    fetchEnsemble(variant)
      .then(d => { if (live) setStore(s => ({ ...s, [variant]: d })); })
      .catch(() => { if (live) setError('The viewer profiles could not load. Check your connection and try again.'); });
    return () => { live = false; };
  }, [variant, store]);

  const T = data?.n_timesteps ?? 1;
  const seg = segment ?? [0, Math.min(T - 1, 9)];
  // Default region: the one viewers disagree on most, so the regional view opens on something worth seeing.
  const regionIndex = useMemo(() => {
    if (!data) return 0;
    if (region != null && region < data.roi_labels.length) return region;
    let best = 0, bestSpread = -1;
    data.roi_labels.forEach((_, r) => {
      const col = data.regions.map(row => row[r]);
      const m = mean(col);
      const spread = mean(col.map(v => (v - m) ** 2));
      if (spread > bestSpread) { bestSpread = spread; best = r; }
    });
    return best;
  }, [data, region]);

  const model = useMemo(() => {
    if (!data) return null;
    const reduced = pca(standardize(featureRows(data, basis, seg)), 10);
    const { k, labels } = clusterRows(reduced, groupCount === 'auto' ? null : Number(groupCount));
    const groups = Array.from({ length: k }, (_, g) => {
      const members = labels.map((l, i) => (l === g ? i : -1)).filter(i => i >= 0);
      const rows = contrast(data, members);
      return { index: g, members, rows, note: describe(data, members, rows), color: CHART_COLORS[g % CHART_COLORS.length] };
    });
    return { reduced, labels, groups, edges: nearestEdges(reduced, 4) };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, basis, groupCount, seg[0], seg[1]]);

  const positions = useMemo(() => (model ? layoutFor(view, data, model.reduced, { region: regionIndex }) : []), [model, view, data, regionIndex]);

  // Size carries the view's measure: the response at the playhead in the temporal view, otherwise even.
  const sizes = useMemo(() => {
    if (!data) return [];
    if (view !== 'temporal') return data.trajectory.map(() => 1);
    const now = data.trajectory.map(r => r[Math.min(currentTime, T - 1)]);
    const lo = Math.min(...now), hi = Math.max(...now);
    return now.map(v => 0.6 + 1.1 * ((v - lo) / (hi - lo || 1)));
  }, [data, view, currentTime, T]);

  const group = selected != null && model ? model.groups[selected] ?? null : null;
  // A new variant, basis or group count regroups everyone, so any selection is cleared with it.
  const regroup = set => value => { set(value); setSelected(null); setPicked(null); };

  if (error) return <Alert tone="danger" title="The ensemble did not load">{error}</Alert>;
  if (!data || !model) return <Skeleton lines={6} label="Loading viewer profiles" />;

  const cohortName = c => (data.cohort_labels[c] || c);
  const regionName = data.roi_labels[regionIndex];
  const pickedGroup = picked != null ? model.labels[picked] : null;
  const axisHint = {
    similarity: `Viewers who respond alike in ${BASES.find(b => b.value === basis).label.toLowerCase()} sit together; each is joined to its four nearest.`,
    temporal: `Left to right: when each viewer peaks. Up: stronger overall response. Size: response at the playhead, ${fmtClock(currentTime)}.`,
    regional: `Up: response in ${regionName}. Across: the two main axes of each viewer's regional pattern.`,
  }[view];

  const others = group ? data.cohorts.map((_, i) => i).filter(i => model.labels[i] !== group.index) : [];
  const metricValues = (key, ids) => ids.map(i => (key === 'mean' ? mean(data.trajectory[i]) : data.dimensions[key][i]));
  const metricOptions = [{ value: 'mean', label: 'Mean response' }, ...Object.keys(data.dimensions).map(k => ({ value: k, label: dimensionLabel(k) }))];

  return (
    <div className="ensemble">
      <Card
        title="Neural ensemble"
        exportName="neural-ensemble"
        description={`${data.n_profiles} simulated viewers${variants.length > 1 ? ` of Variant ${variant}` : ''}, grouped by how alike their predicted responses are.`}
        actions={variants.length > 1 && (
          <div className="ensemble-variant">
            <Select label="Variant" options={variants.map(v => ({ value: v, label: `Variant ${v}${v === winner ? ', winner' : ''}` }))} value={variant} onValueChange={regroup(setVariant)} />
          </div>
        )}
      >
        <div className="ensemble-controls">
          <SegmentedControl label="View" options={VIEWS} value={view} onValueChange={setView} />
          <div className="ensemble-field"><Select label="Similar in" options={BASES} value={basis} onValueChange={regroup(setBasis)} /></div>
          <div className="ensemble-field narrow"><Select label="Groups" options={GROUP_COUNTS} value={groupCount} onValueChange={regroup(setGroupCount)} /></div>
          {basis === 'segment' && (
            <div className="ensemble-field wide">
              <Slider label="Segment" min={0} max={T - 1} value={seg} onValueChange={setSegment} format={fmtClock} thumbLabels={['Segment start', 'Segment end']} minStepsBetweenThumbs={1} />
            </div>
          )}
          {view === 'regional' && (
            <div className="ensemble-field"><Select label="Region" options={data.roi_labels.map((r, i) => ({ value: String(i), label: r }))} value={String(regionIndex)} onValueChange={v => setRegion(Number(v))} /></div>
          )}
        </div>

        <div className="ensemble-body">
          <div className="ensemble-graph">
            <EnsembleGraph3D
              positions={positions}
              sizes={sizes}
              colorTokens={CHART_COLORS}
              groups={model.labels}
              selectedGroup={selected}
              edges={model.edges}
              theme={theme}
              autoRotate={rotate}
              onHoverNode={(id, ev) => setHover(id == null ? null : { id, x: ev?.offsetX ?? 0, y: ev?.offsetY ?? 0 })}
              onPickNode={id => { setPicked(id); setSelected(id == null ? null : model.labels[id]); }}
            />
            {hover && (
              <span className="ensemble-tip" style={{ left: hover.x + 12, top: hover.y + 12 }}>
                Viewer {hover.id + 1}, {cohortName(data.cohorts[hover.id])}, group {model.labels[hover.id] + 1}
              </span>
            )}
            <div className="ensemble-tools">
              <ToggleGroup type="multiple" label="Graph display" size="sm" value={rotate ? ['rotate'] : []} onValueChange={list => setRotate(list.includes('rotate'))}>
                <ToggleGroupItem value="rotate" label="Auto-rotate"><RotateCw /></ToggleGroupItem>
              </ToggleGroup>
            </div>
            <p className="ensemble-axes">{axisHint}</p>
          </div>

          <div className="ensemble-groups">
            <p className="block-label"><strong>{model.groups.length} groups</strong><span>Select one to compare it with everyone else</span></p>
            <ul>
              {model.groups.map(g => (
                <li key={g.index}>
                  <button type="button" className="ensemble-group" aria-pressed={selected === g.index} onClick={() => { setSelected(selected === g.index ? null : g.index); setPicked(null); }}>
                    <span className="swatch" style={{ background: g.color }} aria-hidden="true" />
                    <span className="ensemble-group-name">Group {g.index + 1}</span>
                    <span className="num-key">{g.members.length}</span>
                    <span className="ensemble-group-note">{g.note || 'mixed cohorts'}</span>
                  </button>
                </li>
              ))}
            </ul>
            {picked != null && (
              <p className="ensemble-picked">
                Viewer {picked + 1}, {cohortName(data.cohorts[picked])}, in group {pickedGroup + 1}. Mean response <span className="num-key">{mean(data.trajectory[picked]).toFixed(3)}</span>.
              </p>
            )}
            {selected != null && <Button size="sm" variant="ghost" onClick={() => { setSelected(null); setPicked(null); }}>Clear selection</Button>}
          </div>
        </div>
      </Card>

      {!group ? (
        <div className="ensemble-empty">
          <EmptyState icon={null} title="Select a group to look inside it" description="Pick a group from the list or select any node. You will see its brain response, how its viewers are spread, and what sets it apart from the rest." />
        </div>
      ) : (
        <div className="bento ensemble-detail" style={{ '--group': group.color }}>
          <div className="span-5">
            <Card title={`Group ${group.index + 1}, ${group.members.length} viewers`} description={`Mean regional response at ${fmtClock(currentTime)}. Move the playhead to step through the creative.`}>
              <div className="ensemble-modes"><SegmentedControl label="Brain shows" options={BRAIN_MODES} value={brainMode} onValueChange={setBrainMode} /></div>
              <div className="ensemble-brain">
                <BrainViewer3D
                  currentTime={currentTime}
                  variant={variant}
                  autoRotate
                  chipLabel={`Group ${group.index + 1}, ${BRAIN_MODES.find(m => m.value === brainMode).label.toLowerCase()}`}
                  sourceKey={`${variant}|${group.members.join(',')}|${brainMode}`}
                  loadActivation={t => fetchEnsembleActivation(variant, t, group.members, brainMode).then(d => d.activation)}
                />
              </div>
            </Card>
          </div>

          <div className="span-7">
            <Card title="Response over time" exportName={`group-${group.index + 1}-response`} description={`Group ${group.index + 1} against the other ${others.length} viewers.`}>
              <LineChart
                data={timeSeriesData(T, i => ({ group: meanTrajectory(data, group.members)[i], rest: meanTrajectory(data, others)[i] }))}
                series={[
                  { key: 'group', label: `Group ${group.index + 1}`, color: group.color, area: true },
                  { key: 'rest', label: 'Everyone else', color: 'var(--chart-tie)', dashed: true, area: false },
                ]}
                label={`Mean whole-brain response, group ${group.index + 1} and everyone else`}
                unit="z"
                height={200}
                categoryLabel="Time"
                formatValue={zFormat}
                formatTick={v => v.toFixed(2)}
              />
              <div className="ensemble-mix">
                <p className="block-label"><strong>Who is in it</strong><span>Share of the group, against an even 25%</span></p>
                {Object.entries(cohortMix(data, group.members)).map(([c, count]) => (
                  <div key={c} className="mix-row">
                    <span>{cohortName(c)}</span>
                    <Progress value={(count / group.members.length) * 100} label={`${cohortName(c)} share of group ${group.index + 1}`} />
                    <span className="num-key">{Math.round((count / group.members.length) * 100)}%</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="span-5">
            <Card
              title="Spread of responses"
              exportName={`group-${group.index + 1}-spread`}
              description="How the group's viewers are distributed, against everyone else."
              actions={<div className="ensemble-field"><Select label="Measure" options={metricOptions} value={metric} onValueChange={setMetric} /></div>}
            >
              <div className="ensemble-ridges" style={{ '--series-1': group.color, '--series-2': 'var(--chart-tie)' }}>
                <Ridgeline
                  series={[
                    // The ridge labels sit in a narrow gutter, so they stay short.
                    { id: 'group', label: `Grp ${group.index + 1}`, values: metricValues(metric, group.members) },
                    { id: 'rest', label: 'Others', values: metricValues(metric, others) },
                  ]}
                  label={`Distribution of ${metricOptions.find(m => m.value === metric).label.toLowerCase()} for group ${group.index + 1} and everyone else`}
                  formatValue={v => v.toFixed(4)}
                  rowHeight={44}
                />
              </div>
            </Card>
          </div>

          <div className="span-7">
            <Card title="What sets this group apart" exportName={`group-${group.index + 1}-differences`} description="Dimensions and regions ranked by effect size: the gap in means over the pooled spread.">
              <div className="flat-table">
                <SortableDataTable
                  rows={group.rows.slice(0, 10)}
                  rowKey="id"
                  caption={`Largest differences between group ${group.index + 1} and everyone else`}
                  itemName={{ one: 'feature', other: 'features' }}
                  columns={[
                    { key: 'feature', label: 'Feature', render: (v, r) => <span>{v} <span className="muted-note">{r.kind.toLowerCase()}</span></span> },
                    { key: 'group', label: 'Group', numeric: true, render: v => <span className="num-key">{v.toFixed(4)}</span> },
                    { key: 'rest', label: 'Everyone else', numeric: true, render: v => v.toFixed(4) },
                    { key: 'd', label: 'Effect size', numeric: true, render: v => <span className="num-key">{`${v > 0 ? 'Higher' : 'Lower'}, ${Math.abs(v).toFixed(2)}`}</span> },
                  ]}
                />
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
