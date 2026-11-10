import React, { useState } from 'react';
import { Ridgeline } from '@/components/arc/ridgeline/ridgeline';
import { Card } from './ui';
import { Treemap } from '@/components/arc/treemap/treemap';
import SegmentedControl from '@/components/arc/segmented-control/segmented-control';
import { Select } from '@/components/arc/select/select';
import { VARIANT_OPTIONS } from '@/lib/chart-data';

const ROI_ANATOMY = {
  'V1': { network: 'Visual', name: 'Primary Visual Cortex', desc: 'Low-level edge and luminance contrast' },
  'V2': { network: 'Visual', name: 'Secondary Visual Cortex', desc: 'Binocular disparity and surface texture' },
  'V3': { network: 'Visual', name: 'Visual Area 3', desc: 'Dynamic global form and shape synthesis' },
  'V4': { network: 'Visual', name: 'Visual Area 4', desc: 'Color perception, geometric curvature and object features' },
  'V4t': { network: 'Visual', name: 'Visual Area 4 Transitional', desc: 'Motion-form integration and object boundaries' },
  'V8': { network: 'Visual', name: 'Visual Area 8', desc: 'Specialized color constancy and chromatic memory' },
  'MT': { network: 'Motion', name: 'Middle Temporal Area (V5)', desc: 'Visual velocity, motion direction, and parallax' },
  'MST': { network: 'Motion', name: 'Medial Superior Temporal Area', desc: 'Complex optic flow and self-motion perception' },
  'FST': { network: 'Motion', name: 'Fundus of Superior Temporal Sulcus', desc: 'Smooth pursuit motion and tracking' },
  'TPOJ1': { network: 'Integration', name: 'Temporo-Parieto-Occipital Junction 1', desc: 'Multisensory integration and temporal binding' },
  'TPOJ2': { network: 'Integration', name: 'Temporo-Parieto-Occipital Junction 2', desc: 'Cross-modal narrative and audio-visual cues' },
  'TPOJ3': { network: 'Integration', name: 'Temporo-Parieto-Occipital Junction 3', desc: 'Spatial attention and social intent decoding' },
  'LO1': { network: 'Visual', name: 'Lateral Occipital 1', desc: 'Object recognition and contour orientation' },
  'LO2': { network: 'Visual', name: 'Lateral Occipital 2', desc: 'Shape selectivity and semantic category parsing' },
  'PIT': { network: 'Visual', name: 'Posterior Inferior Temporal', desc: 'High-level brand and product visual identification' },
  'A1': { network: 'Auditory', name: 'Primary Auditory Cortex', desc: 'Acoustic pitch, frequency, and spectral tone' },
  'MBelt': { network: 'Auditory', name: 'Medial Belt Auditory Area', desc: 'Harmonics and complex auditory object recognition' },
  'PBelt': { network: 'Auditory', name: 'Posterior Belt Auditory Area', desc: 'Spatial sound localization and audio transitions' },
  '46': { network: 'Executive', name: 'Dorsolateral Prefrontal Area 46', desc: 'Working memory, decision valuation, and focus' },
  '9p': { network: 'Executive', name: 'Dorsal Prefrontal Area 9p', desc: 'Strategic evaluation and cognitive synthesis' },
  '8C': { network: 'Attention', name: 'Frontal Eye Field Area 8C', desc: 'Saccadic guidance and selective focal attention' },
  'p24': { network: 'Limbic', name: 'Posterior Cingulate Area 24', desc: 'Emotional salience, personal relevance, and value' },
  'a24': { network: 'Limbic', name: 'Anterior Cingulate Area 24', desc: 'Conflict resolution and emotional arousal' },
  'VIP': { network: 'Parietal', name: 'Ventral Intraparietal Area', desc: 'Peripersonal space and tactile-visual immersion' },
  'LIP': { network: 'Parietal', name: 'Lateral Intraparietal Area', desc: 'Salience mapping and gaze priority' },
  '7m': { network: 'Parietal', name: 'Medial Parietal Area 7m', desc: 'Narrative imagery and mental self-projection' },
  'PCV': { network: 'Limbic', name: 'Precuneus Visual Area', desc: 'Episodic memory recall and autobiographical link' },
  'VMV1': { network: 'Visual', name: 'Ventro-Medial Visual Area 1', desc: 'Scene recognition and environmental landscape' },
  'VMV2': { network: 'Visual', name: 'Ventro-Medial Visual Area 2', desc: 'Spatial background and scene context' },
  'PHA3': { network: 'Memory', name: 'Parahippocampal Area 3', desc: 'Contextual memory encoding and brand imprint' },
};

const DEMO_LABELS = {
  kids: 'Kids (6 to 12)',
  genz: 'Gen Z (13 to 24)',
  adults: 'Adults (25 to 54)',
  older: 'Older (55+)',
};

// Ten networks fold into four systems, so the treemap's four Arc series hues each mark one system.
const SYSTEMS = {
  Visual: 'Vision', Motion: 'Vision',
  Auditory: 'Hearing',
  Integration: 'Integration and attention', Parietal: 'Integration and attention', Attention: 'Integration and attention',
  Executive: 'Evaluation and memory', Limbic: 'Evaluation and memory', Memory: 'Evaluation and memory',
};
const SYSTEM_ORDER = ['Vision', 'Hearing', 'Integration and attention', 'Evaluation and memory'];
// Regions outside the anatomy table, placed by their HCP-MMP family.
const EXTRA_SYSTEMS = {
  V7: 'Vision', VMV3: 'Vision', LO3: 'Vision',
  A4: 'Hearing', A5: 'Hearing', LBelt: 'Hearing', RI: 'Hearing',
  STSdp: 'Integration and attention', STSvp: 'Integration and attention', STV: 'Integration and attention', PGp: 'Integration and attention', PGi: 'Integration and attention', FEF: 'Integration and attention', '6a': 'Integration and attention', '6d': 'Integration and attention',
  IFSp: 'Evaluation and memory', IFSa: 'Evaluation and memory', IFJa: 'Evaluation and memory',
};
const systemOf = roi => SYSTEMS[ROI_ANATOMY[roi]?.network] ?? EXTRA_SYSTEMS[roi] ?? 'Integration and attention';

const COHORT_OPTIONS = [{ value: 'all', label: 'All cohorts' }, ...Object.entries(DEMO_LABELS).map(([value, label]) => ({ value, label }))];

const VarianceHeatmap = ({ dataA, dataB }) => {
  const [variant, setVariant] = useState('A');
  const [cohort, setCohort] = useState('all');
  const [view, setView] = useState('map');

  if (!dataA?.values || !dataB?.values) return null;

  const roiLabels = dataA.roi_labels || [];
  const demographics = dataA.demographics || [];
  const valuesA = dataA.values;
  const valuesB = dataB.values;

  // Mean inter-subject variance per region over the chosen cohorts.
  const cohortIdx = cohort === 'all' ? demographics.map((_, i) => i) : [demographics.indexOf(cohort)].filter(i => i >= 0);
  const meanOver = (values, r) => cohortIdx.length ? cohortIdx.reduce((sum, d) => sum + (Number(values[d]?.[r]) || 0), 0) / cohortIdx.length : 0;
  const regions = roiLabels.map((roi, r) => {
    const a = meanOver(valuesA, r), b = meanOver(valuesB, r);
    return { roi, a, b, system: systemOf(roi) };
  });

  const own = variant === 'A' ? 'a' : 'b', other = variant === 'A' ? 'b' : 'a', otherName = variant === 'A' ? 'B' : 'A';
  const tree = {
    id: 'root', label: 'All regions',
    children: SYSTEM_ORDER.map(system => ({
      id: system, label: system,
      children: regions.filter(r => r.system === system).map(r => ({ id: r.roi, label: `${r.roi} ${ROI_ANATOMY[r.roi]?.name ? `(${ROI_ANATOMY[r.roi].name})` : ''}`.trim(), value: r[own], color: r[own] - r[other] })),
    })).filter(group => group.children.length),
  };

  const ranked = [...regions].sort((x, y) => (x[own]) - (y[own]));
  const calm = ranked[0], split = ranked[ranked.length - 1];
  const name = roi => ROI_ANATOMY[roi]?.name ? ` (${ROI_ANATOMY[roi].name})` : '';

  // Spread of inter-subject variance across all ROIs, one ridge per cohort and variant.
  const SHORT = { kids: 'Kids', genz: 'GenZ', adults: 'Adult', older: 'Older' };
  const ridgeSeries = demographics.flatMap((demo, dIdx) => [
    { id: `${demo}-A`, label: `${SHORT[demo] || demo} A`, values: (valuesA[dIdx] || []).map(Number).filter(Number.isFinite) },
    { id: `${demo}-B`, label: `${SHORT[demo] || demo} B`, values: (valuesB[dIdx] || []).map(Number).filter(Number.isFinite) },
  ]).filter(item => item.values.length > 1);

  return (
    <Card
      title="Response variance across viewers"
      exportName="response-variance"
      description="Low variance: the audience reacts as one. High variance: the creative is polarising."
      actions={<SegmentedControl label="View" options={[{ value: 'map', label: 'By region' }, { value: 'spread', label: 'Distribution' }]} value={view} onValueChange={setView} />}
    >
      {view === 'map' && (<>
        <div className="filter-row">
          <SegmentedControl label="Variant" options={VARIANT_OPTIONS} value={variant} onValueChange={setVariant} />
          <div className="filter-select"><Select label="Cohort" options={COHORT_OPTIONS} value={cohort} onValueChange={setCohort} /></div>
        </div>
        <div className="treemap-colors">
          <Treemap
            data={tree}
            label={`Inter-subject variance by region for Variant ${variant}, grouped by brain system`}
            formatValue={v => `σ² ${v.toFixed(4)}`}
            colorLabel={`More varied than Variant ${otherName} by`}
            formatColor={v => `${v < 0 ? '\u2212' : '+'}${Math.abs(v).toFixed(4)}`}
            height={380}
          />
        </div>
        {calm && split && (
          <div className="readout">
            <span>Most consistent: <strong>{calm.roi}</strong>{name(calm.roi)}</span>
            <span>Most polarising: <strong>{split.roi}</strong>{name(split.roi)}</span>
          </div>
        )}
      </>)}

      {view === 'spread' && ridgeSeries.length > 0 && (
        <>
          <p className="block-label"><strong>Variance across {roiLabels.length} regions</strong><span>Narrow ridge = consensus</span></p>
          <div className="ridge-colors"><Ridgeline series={ridgeSeries} label="Distribution of inter-subject variance across regions by cohort and variant" formatValue={v => v.toFixed(3)} rowHeight={26} /></div>
        </>
      )}
    </Card>
  );
};

export default VarianceHeatmap;
