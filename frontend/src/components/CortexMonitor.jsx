import React, { forwardRef, useCallback, useState } from 'react';
import SegmentedControl from '@/components/arc/segmented-control/segmented-control';
import { Select } from '@/components/arc/select/select';
import { Gauge } from '@/components/arc/gauge/gauge';
import { VARIANT_OPTIONS } from '@/lib/chart-data';
import BrainViewer3D from './BrainViewer3D';
import { Card } from './ui';

const COHORTS = [
  { value: 'baseline', label: 'All viewers' },
  { value: 'kids', label: 'Kids (6 to 12)' },
  { value: 'genz', label: 'Gen Z (13 to 24)' },
  { value: 'adults', label: 'Adults (25 to 54)' },
  { value: 'older', label: 'Older (55+)' },
];

const THRESHOLDS = [
  { from: 0, tone: 'accent', label: 'Quiet' },
  { from: 35, tone: 'accent', label: 'Engaged' },
  { from: 70, tone: 'accent', label: 'Broad' },
];

const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const signed = (v) => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(3)}`;

/**
 * The brain at the playhead, with its controls and live readouts in a narrow rail beside it.
 * The rail reads like a notebook cell: each control is named the way a parameter would be.
 */
const CortexMonitor = forwardRef(function CortexMonitor({ currentTime, variant, onVariantChange, cohort, onCohortChange }, ref) {
  const [stats, setStats] = useState({ mean: 0, peak: 0, activePct: 0, lr: 0 });
  const onStats = useCallback(s => setStats(s), []);
  const tone = variant === 'B' ? 'num-b' : 'num-a';

  return (
    <Card title="Predicted cortical response at the playhead" exportName="cortical-response" className="monitor">
      <div className="monitor-body">
        <BrainViewer3D ref={ref} currentTime={currentTime} demographic={cohort} variant={variant} autoRotate onStats={onStats} />

        <div className="monitor-rail">
          <div className="param">
            <code className="param-name" aria-hidden="true">variant =</code>
            <SegmentedControl label="Variant shown on the brain" options={VARIANT_OPTIONS.map(o => ({ value: o.value, label: o.value }))} value={variant} onValueChange={onVariantChange} />
          </div>
          <div className="param">
            <code className="param-name" aria-hidden="true">cohort =</code>
            <Select label="Cohort" options={COHORTS} value={cohort} onValueChange={onCohortChange} />
          </div>

          <div className="colorbar" role="img" aria-label="Colour scale from low response in grey to peak response in pale yellow">
            <span>Low</span>
            <div className="colorbar-ramp" />
            <span>Peak</span>
          </div>

          <div className={`monitor-gauge ${variant === 'B' ? 'is-b' : ''}`}>
            <Gauge label="Active share" detail={`of the surface at ${fmtClock(currentTime)}`} value={Math.round(stats.activePct)} thresholds={THRESHOLDS} />
          </div>

          <dl className="monitor-stats">
            <div><dt>Mean z</dt><dd className={tone}>{stats.mean.toFixed(3)}</dd></div>
            <div><dt>Peak vertex</dt><dd className={tone}>{stats.peak.toFixed(3)}</dd></div>
            <div><dt>L minus R</dt><dd className="num-key">{signed(stats.lr)}</dd></div>
          </dl>
        </div>
      </div>
    </Card>
  );
});

export default CortexMonitor;
