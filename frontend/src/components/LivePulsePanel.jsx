import React from 'react';
import { VariantTag } from './ui';

/** Mean activation, active cortex, and the last 16 seconds for each variant at the playhead. */
const LivePulsePanel = ({ currentTime, overviewA, overviewB }) => {
  if (!overviewA?.timestep_metrics || !overviewB?.timestep_metrics) return null;

  const read = (overview) => {
    const m = overview.timestep_metrics;
    const t = Math.min(currentTime, m.global_mean.length - 1);
    return { intensity: m.global_mean[t] || 0, density: m.active_fraction[t] || 0 };
  };

  const rows = [['A', read(overviewA)], ['B', read(overviewB)]];
  const lead = rows[0][1].intensity === rows[1][1].intensity ? null : rows[0][1].intensity > rows[1][1].intensity ? 'A' : 'B';

  return (
    <table className="readout-table">
      <caption>At {Math.floor(currentTime / 60)}:{String(currentTime % 60).padStart(2, '0')}{lead ? `, Variant ${lead} leads` : ''}</caption>
      <thead>
        <tr><th scope="col">Variant</th><th scope="col">Mean z</th><th scope="col">Active cortex</th></tr>
      </thead>
      <tbody>
        {rows.map(([v, r]) => (
          <tr key={v}>
            <th scope="row"><VariantTag v={v} /></th>
            <td className={`num num-${v.toLowerCase()}`}>{r.intensity.toFixed(3)}</td>
            <td className={`num num-${v.toLowerCase()}`}>{(r.density * 100).toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default LivePulsePanel;
