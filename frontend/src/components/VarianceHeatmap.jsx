import React, { useState } from 'react';
import { Ridgeline } from '@/components/arc/ridgeline/ridgeline';
import { Card } from './ui';
import SegmentedControl from '@/components/arc/segmented-control/segmented-control';
import { SearchField } from '@/components/arc/search-field/search-field';
import { EmptyState } from '@/components/arc/empty-state/empty-state';
import { Button } from '@/components/arc/button/button';

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

const VarianceHeatmap = ({ dataA, dataB }) => {
  const [activeVariant, setActiveVariant] = useState('both');
  const [view, setView] = useState('grid');
  const [hoveredCell, setHoveredCell] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('default'); // 'default', 'variance', 'delta'

  if (!dataA?.values || !dataB?.values) return null;

  const rawRoiLabels = dataA.roi_labels || [];
  const demographics = dataA.demographics || [];
  const valuesA = dataA.values;
  const valuesB = dataB.values;

  const maxValueA = valuesA.length ? Math.max(...valuesA.flat()) : 1;
  const maxValueB = valuesB.length ? Math.max(...valuesB.flat()) : 1;
  const globalMax = Math.max(maxValueA, maxValueB, 0.0001);

  // Compute full difference matrix
  const diffMatrix = demographics.map((_, dIdx) =>
    rawRoiLabels.map((_, rIdx) => {
      const a = valuesA[dIdx]?.[rIdx] || 0;
      const b = valuesB[dIdx]?.[rIdx] || 0;
      return a - b;
    })
  );

  const maxDiff = diffMatrix.length
    ? Math.max(...diffMatrix.flat().map(Math.abs), 0.0001)
    : 1;

  // Filter & Sort ROI Indices
  let processedRois = rawRoiLabels.map((roi, idx) => ({ roi, idx }));

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    processedRois = processedRois.filter(item => {
      const info = ROI_ANATOMY[item.roi] || {};
      return (
        item.roi.toLowerCase().includes(q) ||
        (info.name && info.name.toLowerCase().includes(q)) ||
        (info.network && info.network.toLowerCase().includes(q))
      );
    });
  }

  if (sortBy === 'variance') {
    processedRois.sort((a, b) => {
      const totalA = demographics.reduce((s, _, d) => s + (valuesA[d]?.[b.idx] || 0) + (valuesB[d]?.[b.idx] || 0), 0);
      const totalB = demographics.reduce((s, _, d) => s + (valuesA[d]?.[a.idx] || 0) + (valuesB[d]?.[a.idx] || 0), 0);
      return totalA - totalB;
    });
  } else if (sortBy === 'delta') {
    processedRois.sort((a, b) => {
      const sumDiffA = demographics.reduce((s, _, d) => s + Math.abs(diffMatrix[d]?.[b.idx] || 0), 0);
      const sumDiffB = demographics.reduce((s, _, d) => s + Math.abs(diffMatrix[d]?.[a.idx] || 0), 0);
      return sumDiffA - sumDiffB;
    });
  }

  // Summary Metrics
  let minVar = Infinity, minRoi = '', maxVar = 0, maxRoi = '';
  rawRoiLabels.forEach((roi, r) => {
    let sumVar = 0;
    demographics.forEach((_, d) => {
      sumVar += (valuesA[d]?.[r] || 0) + (valuesB[d]?.[r] || 0);
    });
    if (sumVar < minVar) { minVar = sumVar; minRoi = roi; }
    if (sumVar > maxVar) { maxVar = sumVar; maxRoi = roi; }
  });
  const summaryInsights = { minRoi, maxRoi };

  // Spread of inter-subject variance across all ROIs, one ridge per cohort and variant.
  const SHORT = { kids: 'Kids', genz: 'GenZ', adults: 'Adult', older: 'Older' };
  const ridgeSeries = demographics.flatMap((demo, dIdx) => [
    { id: `${demo}-A`, label: `${SHORT[demo] || demo} A`, values: (valuesA[dIdx] || []).map(Number).filter(Number.isFinite) },
    { id: `${demo}-B`, label: `${SHORT[demo] || demo} B`, values: (valuesB[dIdx] || []).map(Number).filter(Number.isFinite) },
  ]).filter(item => item.values.length > 1);

  // Scientific Colormaps
  // Colours come from the variant tokens, mixed toward transparent by magnitude.
  const mix = (token, ratio) => `color-mix(in oklab, var(${token}) ${(8 + ratio * 88).toFixed(0)}%, transparent)`;
  const getHeatColor = (value, token) => mix(token, Math.max(0, Math.min(1, value / (globalMax || 1))));
  const getDiffColor = (diff) => {
    if (Math.abs(diff) < 0.0001) return 'var(--surface-muted)';
    return mix(diff > 0 ? '--chart-a' : '--chart-b', Math.min(1, Math.abs(diff) / (maxDiff || 1)));
  };

  const getCellColor = (dIdx, rIdx) => {
    if (activeVariant === 'A') return getHeatColor(dataA.values[dIdx]?.[rIdx] || 0, '--chart-a');
    if (activeVariant === 'B') return getHeatColor(dataB.values[dIdx]?.[rIdx] || 0, '--chart-b');
    return getDiffColor(diffMatrix[dIdx]?.[rIdx] || 0);
  };

  const modes = [
    { value: 'both', label: 'A vs B' },
    { value: 'A', label: 'Variant A' },
    { value: 'B', label: 'Variant B' },
  ];
  const sorts = [
    { value: 'default', label: 'Default' },
    { value: 'variance', label: 'Most variance' },
    { value: 'delta', label: 'Biggest gap' },
  ];

  const cols = `120px repeat(${processedRois.length}, minmax(18px, 1fr))`;
  const cell = hoveredCell && {
    roi: rawRoiLabels[hoveredCell.rIdx],
    demo: demographics[hoveredCell.dIdx],
    a: valuesA[hoveredCell.dIdx]?.[hoveredCell.rIdx] || 0,
    b: valuesB[hoveredCell.dIdx]?.[hoveredCell.rIdx] || 0,
  };

  return (
    <Card
      title="Response variance across viewers"
      exportName="response-variance"
      description="Low variance: the audience reacts as one. High variance: the creative is polarising."
      actions={<SegmentedControl label="View" options={[{ value: 'grid', label: 'By region' }, { value: 'spread', label: 'Distribution' }]} value={view} onValueChange={setView} />}
    >
      {view === 'grid' && (<>
      <div className="filter-row">
        <SegmentedControl label="Heatmap mode" options={modes} value={activeVariant} onValueChange={setActiveVariant} />
        <div className="search">
          <SearchField label="Filter regions" placeholder="Region or network" value={searchQuery} onValueChange={setSearchQuery} />
        </div>
        <SegmentedControl label="Sort regions" options={sorts} value={sortBy} onValueChange={setSortBy} />
      </div>

      {processedRois.length === 0 ? (
        <EmptyState icon={null} title="No matching regions" description={`Nothing matches “${searchQuery}”. Try a region code such as V4 or a network such as Visual.`} action={<Button variant="secondary" onClick={() => setSearchQuery('')}>Clear search</Button>} />
      ) : (
        <div className="heatmap-wrap" onMouseLeave={() => setHoveredCell(null)}>
          <div className="heatmap" style={{ gridTemplateColumns: cols }}>
            {demographics.map((demo, dIdx) => (
              <React.Fragment key={demo}>
                <span className="heatmap-rowlabel">{DEMO_LABELS[demo] || demo}</span>
                {processedRois.map(({ roi, idx }) => (
                  <div
                    key={roi}
                    className="heatmap-cell"
                    style={{ background: getCellColor(dIdx, idx) }}
                    onMouseEnter={() => setHoveredCell({ dIdx, rIdx: idx })}
                    aria-label={`${roi}, ${DEMO_LABELS[demo] || demo}`}
                  />
                ))}
              </React.Fragment>
            ))}
            <span />
            {processedRois.map(({ roi }) => <span key={roi} className="heatmap-collabel">{roi}</span>)}
          </div>
        </div>
      )}

      <div className="readout">
        {cell ? (
          <>
            <span><strong>{cell.roi}</strong> · {ROI_ANATOMY[cell.roi]?.name || 'Cortical region'} · {DEMO_LABELS[cell.demo] || cell.demo}</span>
            <span>A σ² <strong className="num-a">{cell.a.toFixed(4)}</strong></span>
            <span>B σ² <strong className="num-b">{cell.b.toFixed(4)}</strong></span>
            <span>Gap <strong className={cell.a >= cell.b ? 'num-a' : 'num-b'}>{cell.a >= cell.b ? '+A' : '+B'} {Math.abs(cell.a - cell.b).toFixed(4)}</strong></span>
          </>
        ) : (
          <>
            <span>Most consistent: <strong>{summaryInsights.minRoi}</strong> {ROI_ANATOMY[summaryInsights.minRoi]?.name ? `(${ROI_ANATOMY[summaryInsights.minRoi].name})` : ''}</span>
            <span>Most polarising: <strong>{summaryInsights.maxRoi}</strong> {ROI_ANATOMY[summaryInsights.maxRoi]?.name ? `(${ROI_ANATOMY[summaryInsights.maxRoi].name})` : ''}</span>
            <span className="heatmap-scale">
              {activeVariant === 'both'
                ? <><span className="chart-dot b" />B higher<span className="ramp" style={{ background: 'linear-gradient(90deg, var(--chart-b), var(--surface-muted), var(--chart-a))' }} />A higher<span className="chart-dot" /></>
                : <>Low<span className="ramp" style={{ background: `linear-gradient(90deg, color-mix(in oklab, var(${activeVariant === 'A' ? '--chart-a' : '--chart-b'}) 8%, transparent), var(${activeVariant === 'A' ? '--chart-a' : '--chart-b'}))` }} />High</>}
            </span>
          </>
        )}
      </div>

      </>)}

      {view === 'spread' && ridgeSeries.length > 0 && (
        <>
          <p className="block-label"><strong>Variance across {rawRoiLabels.length} regions</strong><span>Narrow ridge = consensus</span></p>
          <div className="ridge-colors"><Ridgeline series={ridgeSeries} label="Distribution of inter-subject variance across regions by cohort and variant" formatValue={v => v.toFixed(3)} rowHeight={26} /></div>
        </>
      )}
    </Card>
  );
};

export default VarianceHeatmap;
