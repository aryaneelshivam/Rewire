import React from 'react';
import { FileText, Brain } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';

const ReportView = ({ data, snapshots, onClose }) => {
  const { summary, engagement, topRois, overview } = data;

  const dims = engagement.A.dimensions.filter(d => d !== 'overall');

  const chartData = dims.map(dim => ({
    name: dim.charAt(0).toUpperCase() + dim.slice(1),
    A: engagement.A.scores.adults[dim] || 0,
    B: engagement.B.scores.adults[dim] || 0,
  }));

  const winner = summary?.A_global_mean > summary?.B_global_mean ? 'A' : 'B';

  // Time-Series Data Prep
  const overviewChartData = [];
  const maxTOv = Math.max(overview?.A?.n_timesteps || 0, overview?.B?.n_timesteps || 0);

  if (overview?.A?.timestep_metrics && overview?.B?.timestep_metrics) {
    for (let i = 0; i < maxTOv; i++) {
      overviewChartData.push({
        time: i,
        A: overview.A.timestep_metrics.global_mean?.[i] ?? null,
        B: overview.B.timestep_metrics.global_mean?.[i] ?? null,
      });
    }
  }

  const asymmetryChartData = [];
  if (overview?.A?.timestep_metrics?.hemisphere_asymmetry && overview?.B?.timestep_metrics?.hemisphere_asymmetry) {
    for (let i = 0; i < maxTOv; i++) {
      asymmetryChartData.push({
        time: i,
        A: overview.A.timestep_metrics.hemisphere_asymmetry[i] ?? null,
        B: overview.B.timestep_metrics.hemisphere_asymmetry[i] ?? null,
      });
    }
  }

  return (
    <div className="report-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#f8f9fa', zIndex: 9999, overflowY: 'auto',
      padding: '40px 0', fontFamily: 'Inter, sans-serif', color: '#1a1a1a'
    }}>
      <div className="report-container" style={{
        width: '210mm', minHeight: '297mm', margin: '0 auto',
        backgroundColor: '#fff', boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
        padding: '60px', boxSizing: 'border-box', position: 'relative'
      }}>

        {/* Actions (Non-printing) */}
        <div style={{ position: 'absolute', top: 20, right: 30 }} className="no-print">
          <button onClick={() => window.print()} style={{
            backgroundColor: '#E85D24', color: 'white', border: 'none',
            padding: '10px 20px', borderRadius: '8px', cursor: 'pointer',
            marginRight: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px'
          }}>
            <FileText size={18} /> Print to PDF
          </button>
          <button onClick={onClose} style={{
            backgroundColor: '#eee', color: '#555', border: 'none',
            padding: '10px 20px', borderRadius: '8px', cursor: 'pointer',
            fontWeight: 600
          }}>Close</button>
        </div>

        {/* Header */}
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '2px solid #eee', paddingBottom: '30px', marginBottom: '40px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ width: 32, height: 32, backgroundColor: '#E85D24', borderRadius: '6px' }} />
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, letterSpacing: '-1px' }}>REWIRE</h1>
            </div>
            <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>PROFESSIONAL NEURAL STRATEGY REPORT</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontWeight: 600, fontSize: '14px', margin: 0 }}>Report ID: #RW-{Math.floor(Math.random() * 9000) + 1000}</p>
            <p style={{ color: '#999', fontSize: '12px', margin: '4px 0 0' }}>{new Date().toLocaleDateString('en-GB')}</p>
          </div>
        </header>

        {/* Executive Summary */}
        <section style={{ marginBottom: '50px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#E85D24', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '1px' }}>1. Executive Summary</h2>
          <div style={{
            backgroundColor: '#f8f9fa', borderRadius: '12px', padding: '30px',
            border: '1px solid #eee', display: 'flex', gap: '40px'
          }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '12px', color: '#000' }}>
                Variant {winner} is the Neural Winner
              </h3>
              <p style={{ fontSize: '15px', lineHeight: '1.6', color: '#444' }}>
                Our Analysis Engine V3 predicts that **Variant {winner}** will achieve higher emotional resonance
                and brand recall across target demographics. Variant {winner} shows **{Math.abs(Math.round((summary.B_global_mean / summary.A_global_mean - 1) * 100))}% {summary.B_global_mean > summary.A_global_mean ? 'higher' : 'lower'}**
                overall engagement compared to its counterpart.
              </p>
            </div>
            <div style={{
              width: '180px', display: 'flex', flexDirection: 'column',
              justifyContent: 'center', alignItems: 'center',
              backgroundColor: '#fff', borderRadius: '12px', border: '2px solid #E85D24', padding: '10px'
            }}>
              <p style={{ fontSize: '11px', fontWeight: 800, margin: 0, color: '#E85D24', textAlign: 'center' }}>ADVOCATED CREATIVE</p>
              <p style={{ fontSize: '64px', fontWeight: 900, margin: 0, color: '#1a1a1a' }}>{winner}</p>
            </div>
          </div>
        </section>

        {/* Dimension Matrix */}
        <section style={{ marginBottom: '50px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#E85D24', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '1px' }}>2. Cognitive Performance Matrix</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                <th style={{ padding: '12px 10px', color: '#666' }}>Cognitive Dimension</th>
                <th style={{ padding: '12px 10px', textAlign: 'center' }}>Variant A</th>
                <th style={{ padding: '12px 10px', textAlign: 'center' }}>Variant B</th>
                <th style={{ padding: '12px 10px', textAlign: 'center' }}>Diff %</th>
                <th style={{ padding: '12px 10px', textAlign: 'right' }}>Neural Lead</th>
              </tr>
            </thead>
            <tbody>
              {dims.map(dim => {
                const a = summary.dimension_winners.adults[dim].A;
                const b = summary.dimension_winners.adults[dim].B;
                const diff = summary.dimension_winners.adults[dim].diff;
                const pc = ((b / a - 1) * 100).toFixed(1);
                const win = summary.dimension_winners.adults[dim].winner;

                return (
                  <tr key={dim} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px 10px', fontWeight: 600, textTransform: 'capitalize' }}>{dim}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>{a.toFixed(3)}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>{b.toFixed(3)}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'center', color: diff > 0 ? '#10b981' : '#ef4444' }}>
                      {diff > 0 ? '+' : ''}{pc}%
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700 }}>
                      <span style={{
                        backgroundColor: win === 'B' ? '#f0f0ff' : '#fff0f0',
                        color: win === 'B' ? '#7F77DD' : '#E85D24',
                        padding: '2px 8px', borderRadius: '4px'
                      }}>
                        Variant {win}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Neural Footprint Snapshots */}
        <section style={{ marginBottom: '50px', pageBreakInside: 'avoid' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#E85D24', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '1px' }}>3. Neural Footprint Snapshots</h2>
          <div style={{ display: 'flex', gap: '30px' }}>
            <div style={{ flex: 1 }}>
              <div style={{
                aspectRatio: '4/3', backgroundColor: '#000', borderRadius: '12px',
                overflow: 'hidden', border: '2px solid #E85D24', position: 'relative'
              }}>
                <img src={snapshots.A} alt="Variant A Snapshot" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                <div style={{ position: 'absolute', bottom: 10, left: 10, color: '#fff', fontSize: '10px', fontWeight: 800 }}>VARIANT A PEAK</div>
              </div>
              <p style={{ marginTop: '12px', fontSize: '12px', color: '#666', lineHeight: '1.4' }}>
                Peak activation metrics identifying high-stimulus engagement within Primary Visual and Narrative processing regions.
              </p>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                aspectRatio: '4/3', backgroundColor: '#000', borderRadius: '12px',
                overflow: 'hidden', border: '2px solid #7F77DD', position: 'relative'
              }}>
                <img src={snapshots.B} alt="Variant B Snapshot" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                <div style={{ position: 'absolute', bottom: 10, left: 10, color: '#fff', fontSize: '10px', fontWeight: 800 }}>VARIANT B PEAK</div>
              </div>
              <p style={{ marginTop: '12px', fontSize: '12px', color: '#666', lineHeight: '1.4' }}>
                Peak activation metrics identified recruitment of Reward hubs and Attention-Sustain pathways.
              </p>
            </div>
          </div>
        </section>

        {/* Comparative Neural Metrics Chart */}
        <section style={{ marginBottom: '50px', pageBreakInside: 'avoid' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#E85D24', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '1px' }}>4. Comparative Neural Metrics</h2>
          <div style={{ height: '280px', backgroundColor: '#fff', border: '1px solid #eee', padding: '20px', borderRadius: '12px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#666' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#666' }} />
                <Tooltip
                  cursor={{ fill: '#f8f9fa' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '15px', fontSize: '11px' }} />
                <Bar dataKey="A" name="Variant A" fill="#E85D24" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="B" name="Variant B" fill="#7F77DD" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Global Activation Time-Series */}
        <section style={{ marginBottom: '50px', pageBreakInside: 'avoid' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#E85D24', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '1px' }}>5. Global Brain Activation Dynamics</h2>
          <div style={{ height: '240px', backgroundColor: '#fff', border: '1px solid #eee', padding: '20px', borderRadius: '12px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overviewChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="repScoreA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E85D24" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#E85D24" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="repScoreB" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7F77DD" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#7F77DD" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#999' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#999' }} />
                <Tooltip />
                <Legend iconType="line" wrapperStyle={{ fontSize: '11px' }} />
                <Area type="monotone" dataKey="A" name="Variant A" stroke="#E85D24" fill="url(#repScoreA)" strokeWidth={2} connectNulls />
                <Area type="monotone" dataKey="B" name="Variant B" stroke="#7F77DD" strokeWidth={2} strokeDasharray="5 5" fill="none" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p style={{ marginTop: '10px', fontSize: '11px', color: '#666', fontStyle: 'italic' }}>Global mean cortical activity across the stimulus duration. Values indicate aggregate firing rates.</p>
        </section>

        {/* Approach vs Avoidance Asymmetry */}
        <section style={{ marginBottom: '50px', pageBreakInside: 'avoid' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#E85D24', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '1px' }}>6. Approach vs. Avoidance (Asymmetry)</h2>
          <div style={{ height: '240px', backgroundColor: '#fff', border: '1px solid #eee', padding: '20px', borderRadius: '12px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={asymmetryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#999' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#999' }} />
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                <Area type="monotone" dataKey="A" name="Variant A" stroke="#E85D24" fill="#E85D24" fillOpacity={0.05} strokeWidth={2} connectNulls />
                <Area type="monotone" dataKey="B" name="Variant B" stroke="#7F77DD" fill="#7F77DD" fillOpacity={0.05} strokeWidth={2} strokeDasharray="4 4" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p style={{ marginTop: '10px', fontSize: '11px', color: '#666', fontStyle: 'italic' }}>Fronto-lateral asymmetry: Positive values (Approach) indicate target engagement; Negative values indicate stimulus avoidance or cognitive fatigue.</p>
        </section>

        {/* Methodology */}
        <section style={{ marginTop: '80px', borderTop: '1px solid #eee', paddingTop: '30px' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 700, color: '#999', textTransform: 'uppercase', marginBottom: '15px' }}>Technical Methodology</h2>
          <p style={{ fontSize: '10px', color: '#999', lineHeight: '1.6' }}>
            Rewire utilizes Meta's Tribe V2 inference model combined with the Rewire Analysis Engine V3 (Synthesis).
            Reports are based on a synthetic ensemble of 200 subject brains per stimulus. Calculations incorporate
            Biologically Grounded Neural Realism including AR(1) temporal dynamics, Cholesky network coherence,
            and Sigmoidal firing caps. HCP-360 Parcellation mapped to fsaverage5 cortical surface.
          </p>
        </section>

      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background-color: #fff !important; }
          .report-overlay { position: static !important; padding: 0 !important; background-color: #fff !important; }
          .report-container { box-shadow: none !important; margin: 0 !important; width: 100% !important; padding: 40px !important; }
        }
      `}</style>
    </div>
  );
};

export default ReportView;
