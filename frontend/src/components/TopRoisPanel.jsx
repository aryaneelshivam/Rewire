import React, { useState } from 'react';
import { SlopeChart } from '@/components/arc/slope-chart/slope-chart';
import { DonutChart } from '@/components/arc/donut-chart/donut-chart';
import { signedZ, CHART_COLORS } from '@/lib/chart-data';
import { Card, BarRow } from './ui';
import { Accordion } from '@/components/arc/accordion/accordion';
import SegmentedControl from '@/components/arc/segmented-control/segmented-control';


const REGION_DEFINITIONS = {
  'V4t': {
    fullName: 'Visual Area 4 (Transitional)',
    network: 'Visual Object Processing',
    lobe: 'Occipital',
    desc: 'Integrates complex object boundaries, color contrast, and early-stage motion. Direct driver of visual curiosity and gaze fixation.',
  },
  'MT': {
    fullName: 'Middle Temporal Area (V5)',
    network: 'Dynamic Motion Cortex',
    lobe: 'Temporal-Occipital',
    desc: 'Specialized for speed, motion parallax, and rapid visual cuts. Highly reactive to action scenes, cinematic camera pans, and kinetic transitions.',
  },
  'MST': {
    fullName: 'Medial Superior Temporal Area',
    network: 'Optic Flow & Immersion',
    lobe: 'Parieto-Temporal',
    desc: 'Decodes complex heading direction and 3D optic flow. Generates immersive viewer sensation of moving forward into the scene.',
  },
  'TPOJ3': {
    fullName: 'Temporo-Parieto-Occipital Junction 3',
    network: 'Multimodal Integration',
    lobe: 'Junctional Cortices',
    desc: 'Binds simultaneous visual, auditory, and narrative cues. Essential for brand storyline comprehension and high-level conceptual recall.',
  },
  'V8': {
    fullName: 'Visual Area 8 (Ventral Color Hub)',
    network: 'Ventral Stream',
    lobe: 'Occipital-Temporal',
    desc: 'Processes vivid color vibrancy and aesthetic appeal. Key predictor of packaging recognition and visual brand signature retention.',
  },
  'LO1': {
    fullName: 'Lateral Occipital 1',
    network: 'Object Recognition',
    lobe: 'Lateral Occipital',
    desc: 'Specialized in segmenting foreground products from background clutter, enabling instant brand recognition.',
  },
  '46': {
    fullName: 'Dorsolateral Prefrontal Cortex (Area 46)',
    network: 'Executive Valuation',
    lobe: 'Prefrontal',
    desc: 'Central node for working memory, value computation, and conscious consideration. Directly correlates with purchase intent.',
  },
  'p24': {
    fullName: 'Posterior Cingulate Cortex (Area 24)',
    network: 'Default Mode & Valuation',
    lobe: 'Medial Frontal',
    desc: 'Associated with personal relevance, emotional resonance, and deep storytelling connection.',
  }
};

const TopRoisPanel = ({ dataA, dataB }) => {
  const [selectedRoi, setSelectedRoi] = useState(null);
  const [shareVariant, setShareVariant] = useState('A');

  if (!dataA || !dataA.rois) return null;
  if (!dataB?.rois) return <SingleRois rois={dataA.rois} selected={selectedRoi} onSelect={setSelectedRoi} />;

  // Compare the union of both variants' top regions. Each variant's value comes from its full table of
  // regional peaks, so a region that is in only one top list still gets a real value for the other.
  const peakOf = (data, name) => data.peaks?.[name]?.[0] ?? data.rois.find(r => r.name === name)?.peak_activation;
  const names = [...new Set([...dataA.rois, ...dataB.rois].map(r => r.name))];
  const mergedRois = names
    .map(name => ({ name, peakA: peakOf(dataA, name), peakB: peakOf(dataB, name) }))
    .filter(r => r.peakA != null && r.peakB != null)
    .map(r => ({ ...r, diff: r.peakA - r.peakB, winner: r.peakA >= r.peakB ? 'A' : 'B' }))
    .sort((a, b) => Math.max(b.peakA, b.peakB) - Math.max(a.peakA, a.peakB))
    .slice(0, 8);

  const slopeData = mergedRois.map(r => ({ key: r.name, label: r.name, start: r.peakA, end: r.peakB }));
  const biggestSwing = mergedRois.reduce((best, r) => !best || Math.abs(r.diff) > Math.abs(best.diff) ? r : best, null);
  const shareData = mergedRois.map((r, i) => ({ color: CHART_COLORS[i % CHART_COLORS.length], key: r.name, label: REGION_DEFINITIONS[r.name]?.network ? `${r.name} · ${REGION_DEFINITIONS[r.name].network}` : r.name, value: Math.max(0, shareVariant === 'A' ? r.peakA : r.peakB) }));

  // A highlighted line takes the colour of the variant it favours.
  const favourColor = item => (item && item.end > item.start ? 'var(--chart-b)' : 'var(--chart-a)');

  const notes = mergedRois.filter(r => REGION_DEFINITIONS[r.name]).map(r => {
    const info = REGION_DEFINITIONS[r.name];
    return {
      title: `${r.name}: ${info.fullName}`,
      content: (
        <div className="region-note">
          <p>{info.desc}</p>
          <p className="muted">{info.network}, {info.lobe}. Peak A {r.peakA.toFixed(3)}, B {r.peakB.toFixed(3)}.</p>
        </div>
      ),
    };
  });

  return (
    <Card
      title="Top cortical regions"
      exportName="top-cortical-regions"
      description="Peak activation in each variant’s strongest regions, set against the other variant in the same region."
    >
      <div className="split split-7-5">
        <div className="split-main">
          <p className="block-label">
            <strong>Peak z-score, A to B</strong>
            {biggestSwing && <span>Largest swing {biggestSwing.name}</span>}
          </p>
          <div style={{ '--series-1': favourColor(slopeData.find(d => d.key === (selectedRoi ?? biggestSwing?.name))) }}>
          <SlopeChart
            data={slopeData}
            label="Peak activation by cortical region, Variant A vs B"
            startLabel="Variant A"
            endLabel="Variant B"
            highlightKey={selectedRoi ?? biggestSwing?.name ?? null}
            height={Math.max(160, slopeData.length * 40)}
            formatValue={v => v.toFixed(3)}
            formatChange={change => `B ${signedZ(change)} vs A`}
          />
          </div>
        </div>
        <div className="split-aside">
          <div className="block-label">
            <strong>Share</strong>
            <SegmentedControl label="Variant" options={[{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }]} value={shareVariant} onValueChange={setShareVariant} />
          </div>
          <DonutChart
            data={shareData}
            label={`Variant ${shareVariant} peak activation across top regions`}
            totalLabel="Summed peak z"
            formatValue={v => v.toFixed(2)}
            legendAction="select"
            activeKey={selectedRoi}
            onActiveChange={setSelectedRoi}
            maxSegments={6}
            size={168}
            thickness={20}
          />
        </div>
      </div>

      {notes.length > 0 && (
        <div className="block">
          <p className="block-label"><strong>What these regions do</strong></p>
          <Accordion defaultOpen={-1} items={notes} />
        </div>
      )}
    </Card>
  );
};

/** One creative: each top region's peak, with its share of the summed peak response. */
function SingleRois({ rois, selected, onSelect }) {
  const top = [...rois].sort((a, b) => b.peak_activation - a.peak_activation).slice(0, 8);
  const max = Math.max(...top.map(r => r.peak_activation), 1e-6);
  const shareData = top.map((r, i) => ({ color: CHART_COLORS[i % CHART_COLORS.length], key: r.name, label: REGION_DEFINITIONS[r.name]?.network ? `${r.name} · ${REGION_DEFINITIONS[r.name].network}` : r.name, value: Math.max(0, r.peak_activation) }));
  const notes = top.filter(r => REGION_DEFINITIONS[r.name]).map(r => {
    const info = REGION_DEFINITIONS[r.name];
    return { title: `${r.name}: ${info.fullName}`, content: <div className="region-note"><p>{info.desc}</p><p className="muted">{info.network}, {info.lobe}. Peak {r.peak_activation.toFixed(3)} at {r.peak_timestep}s.</p></div> };
  });
  return (
    <Card title="Top cortical regions" exportName="top-cortical-regions" description="The regions that respond most strongly, and when they peak.">
      <div className="split split-7-5">
        <div className="split-main">
          <p className="block-label"><strong>Peak z-score</strong><span>Peak time</span></p>
          <div className="dim-bars">
            {top.map(r => (
              <div key={r.name} className="dim-bar roi-bar"><span>{r.name}</span><BarRow variant="A" value={r.peak_activation} max={max} /><span className="num-key">{r.peak_timestep}s</span></div>
            ))}
          </div>
        </div>
        <div className="split-aside">
          <p className="block-label"><strong>Share</strong></p>
          <DonutChart data={shareData} label="Peak activation across top regions" totalLabel="Summed peak z" formatValue={v => v.toFixed(2)} legendAction="select" activeKey={selected} onActiveChange={onSelect} maxSegments={6} size={168} thickness={20} />
        </div>
      </div>
      {notes.length > 0 && (
        <div className="block">
          <p className="block-label"><strong>What these regions do</strong></p>
          <Accordion defaultOpen={-1} items={notes} />
        </div>
      )}
    </Card>
  );
}

export default TopRoisPanel;
