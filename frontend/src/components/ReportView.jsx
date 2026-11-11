import React from 'react';
import { FileText, Brain, ShieldCheck, CheckCircle2, Award, Printer, X } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';

const COLORS = { a: '#0066cc', b: '#7a7a7a', grid: '#e0e0e0', muted: '#7a7a7a' };

const ReportView = ({ data, snapshots, onClose }) => {
  const { summary, engagement, overview } = data;

  const dims = engagement.A.dimensions.filter(d => d !== 'overall');

  const chartData = dims.map(dim => ({
    name: dim.charAt(0).toUpperCase() + dim.slice(1),
    A: engagement.A.scores.adults[dim] || 0,
    B: engagement.B.scores.adults[dim] || 0,
  }));

  // The same verdict as the dashboard and the scorecard: the higher overall score across the audiences.
  const verdict = summary?.overall;
  const winner = verdict?.winner ?? (summary?.A_global_mean > summary?.B_global_mean ? 'A' : 'B');
  const leadPct = verdict?.lead_pct != null ? verdict.lead_pct.toFixed(1) : null;

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

  return (
    <div className="report-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(12px)',
      zIndex: 9999, overflowY: 'auto',
      padding: '40px 0', fontFamily: 'var(--font-body)', color: 'var(--ink)'
    }}>
      <div className="report-container" style={{
        width: '210mm', minHeight: '297mm', margin: '0 auto',
        backgroundColor: '#ffffff', borderRadius: '8px',
        border: '1px solid var(--hairline)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        padding: '56px 64px', boxSizing: 'border-box', position: 'relative'
      }}>

        {/* Actions (Non-printing Floating Bar) */}
        <div style={{ position: 'absolute', top: 24, right: 32 }} className="no-print">
          <button onClick={() => window.print()} className="button-primary" style={{ marginRight: '10px' }}>
            <Printer size={14} /> Print Dossier
          </button>
          <button onClick={onClose} className="button-secondary">
            <X size={14} /> Close
          </button>
        </div>

        {/* Header with Institutional Branding */}
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          borderBottom: '2px solid #000000', paddingBottom: '20px', marginBottom: '32px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
                <path d="M9 21h6" />
              </svg>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                REWIRE NEUROMARKETING INTELLIGENCE
              </h1>
            </div>
            <p style={{ color: 'var(--charcoal)', fontSize: '13px', margin: 0, fontWeight: 500 }}>
              Comparative fMRI Cortical Resonance & Creative Valuation Dossier
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontWeight: 700, fontSize: '12px', margin: 0, fontFamily: 'var(--font-mono)' }}>
              DOSSIER #RW-84920
            </p>
            <p style={{ color: 'var(--mute)', fontSize: '11px', margin: '3px 0 0', fontFamily: 'var(--font-mono)' }}>
              ACQUISITION: {new Date().toLocaleDateString('en-GB')}
            </p>
            <span style={{
              display: 'inline-block',
              marginTop: '4px',
              fontSize: '9.5px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '2px',
              backgroundColor: '#000000',
              color: '#ffffff'
            }}>
              CLASSIFICATION: CONFIDENTIAL
            </span>
          </div>
        </header>

        {/* Technical Specification Metadata Strip */}
        <section style={{
          backgroundColor: 'var(--surface-soft)',
          border: '1px solid var(--hairline)',
          borderRadius: '6px',
          padding: '10px 16px',
          marginBottom: '32px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)'
        }}>
          <div>
            <span style={{ color: 'var(--mute)', display: 'block', fontSize: '9px' }}>INFERENCE ENGINE</span>
            <strong>Rewire neural encoder</strong>
          </div>
          <div>
            <span style={{ color: 'var(--mute)', display: 'block', fontSize: '9px' }}>COHORT ENSEMBLE</span>
            <strong>n=200 Synthetic Brains</strong>
          </div>
          <div>
            <span style={{ color: 'var(--mute)', display: 'block', fontSize: '9px' }}>CORTICAL MESH</span>
            <strong>fsaverage5 (20,484 v)</strong>
          </div>
          <div>
            <span style={{ color: 'var(--mute)', display: 'block', fontSize: '9px' }}>CORRECTION</span>
            <strong>FDR q &lt; 0.05 / AR(1)</strong>
          </div>
        </section>

        {/* 1. Executive Summary & Verdict */}
        <section style={{ marginBottom: '36px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>
            1. EXECUTIVE STRATEGY VERDICT
          </span>
          <div style={{
            backgroundColor: '#09090b', borderRadius: '10px', padding: '26px',
            border: '1px solid #27272a', color: '#ffffff', display: 'flex', gap: '28px', alignItems: 'center'
          }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
                PRIMARY CREATIVE RECOMMENDATION
              </span>
              <h3 style={{ fontSize: '22px', fontWeight: 600, margin: '6px 0 10px', color: '#ffffff', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
                {winner === 'TIE' ? 'The Variants Are Evenly Matched' : `Variant ${winner} Drives Stronger Overall Engagement`}
              </h3>
              <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
                {winner === 'TIE'
                  ? <>Across 200 simulated viewers, the two variants' overall engagement scores, averaged over the four audiences, are within 5% of each other.</>
                  : <>Across 200 simulated viewers, <strong>Variant {winner}</strong> scores {leadPct != null ? <strong>{leadPct}% higher</strong> : 'higher'} on overall engagement, averaged over the four audiences{verdict?.cohorts_led?.[winner] === verdict?.cohorts ? ', and leads with every one of them' : ''}. The cohort and dimension breakdown below shows where each variant is stronger.</>}
              </p>
            </div>
            <div style={{
              width: '120px', display: 'flex', flexDirection: 'column',
              justifyContent: 'center', alignItems: 'center',
              backgroundColor: '#ffffff', borderRadius: '8px', padding: '16px'
            }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.06em' }}>WINNER</span>
              <span style={{ fontSize: '48px', fontWeight: 800, color: '#000000', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{winner}</span>
            </div>
          </div>
        </section>

        {/* 2. Cognitive Performance Matrix */}
        <section style={{ marginBottom: '36px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>
            2. COGNITIVE DIMENSION BENCHMARK
          </span>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--hairline-strong)', textAlign: 'left' }}>
                <th style={{ padding: '8px', color: 'var(--charcoal)', fontWeight: 600 }}>Functional Network</th>
                <th style={{ padding: '8px', textAlign: 'center', color: 'var(--charcoal)' }}>Variant A</th>
                <th style={{ padding: '8px', textAlign: 'center', color: 'var(--charcoal)' }}>Variant B</th>
                <th style={{ padding: '8px', textAlign: 'center', color: 'var(--charcoal)' }}>Difference</th>
                <th style={{ padding: '8px', textAlign: 'right', color: 'var(--charcoal)' }}>Statistical Lead</th>
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
                  <tr key={dim} style={{ borderBottom: '1px solid var(--hairline)' }}>
                    <td style={{ padding: '9px 8px', fontWeight: 600, textTransform: 'capitalize' }}>{dim}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{a.toFixed(3)}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{b.toFixed(3)}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {diff > 0 ? '+' : ''}{pc}%
                    </td>
                    <td style={{ padding: '9px 8px', textAlign: 'right' }}>
                      <span className="command-tag" style={{ fontSize: '11px', padding: '1px 8px' }}>
                        Variant {win}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* 3. Neural Footprint Snapshots */}
        <section style={{ marginBottom: '36px', pageBreakInside: 'avoid' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>
            3. PEAK CORTICAL TOPOGRAPHY RECONSTRUCTION
          </span>
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1 }}>
              <div style={{
                aspectRatio: '4/3', backgroundColor: '#09090b', borderRadius: '8px',
                overflow: 'hidden', border: '1px solid var(--hairline)', position: 'relative'
              }}>
                <img src={snapshots.A} alt="Variant A Snapshot" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                <div style={{ position: 'absolute', bottom: 8, left: 8, color: '#fff', fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.8)', padding: '2px 8px', borderRadius: '3px' }}>
                  VARIANT A · PEAK BOLD
                </div>
              </div>
              <p style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--body)', lineHeight: 1.4 }}>
                Peak activation metrics within visual motion and narrative integration parcellations.
              </p>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                aspectRatio: '4/3', backgroundColor: '#09090b', borderRadius: '8px',
                overflow: 'hidden', border: '1px solid var(--hairline)', position: 'relative'
              }}>
                <img src={snapshots.B} alt="Variant B Snapshot" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                <div style={{ position: 'absolute', bottom: 8, left: 8, color: '#fff', fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.8)', padding: '2px 8px', borderRadius: '3px' }}>
                  VARIANT B · PEAK BOLD
                </div>
              </div>
              <p style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--body)', lineHeight: 1.4 }}>
                Peak activation identifying sustained engagement in orbitofrontal reward hubs.
              </p>
            </div>
          </div>
        </section>

        {/* 4. Comparative Neural Metrics Chart */}
        <section style={{ marginBottom: '36px', pageBreakInside: 'avoid' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>
            4. COGNITIVE NETWORK COMPARISON
          </span>
          <div style={{ height: '220px', backgroundColor: 'var(--surface-soft)', border: '1px solid var(--hairline)', padding: '14px', borderRadius: '8px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.grid} />
                <XAxis dataKey="name" stroke={COLORS.muted} tickLine={false} tick={{ fontSize: 9.5, fontFamily: 'var(--font-body)' }} />
                <YAxis stroke={COLORS.muted} tickLine={false} tick={{ fontSize: 9.5, fontFamily: 'var(--font-mono)' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '10.5px', paddingTop: '8px', fontFamily: 'var(--font-mono)' }} />
                <Bar dataKey="A" name="Variant A" fill={COLORS.a} radius={[4, 4, 0, 0]} />
                <Bar dataKey="B" name="Variant B" fill={COLORS.b} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* 5. Global Cortical Trajectory */}
        <section style={{ marginBottom: '36px', pageBreakInside: 'avoid' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>
            5. WHOLE-BRAIN BOLD ACTIVATION TRAJECTORY
          </span>
          <div style={{ height: '200px', backgroundColor: 'var(--surface-soft)', border: '1px solid var(--hairline)', padding: '14px', borderRadius: '8px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overviewChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.grid} />
                <XAxis dataKey="time" stroke={COLORS.muted} tickLine={false} tick={{ fontSize: 9, fontFamily: 'var(--font-mono)' }} unit="s" />
                <YAxis stroke={COLORS.muted} tickLine={false} tick={{ fontSize: 9, fontFamily: 'var(--font-mono)' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)' }} />
                <Area type="monotone" dataKey="A" name="Variant A" stroke={COLORS.a} fill={COLORS.a} fillOpacity={0.12} strokeWidth={2.5} connectNulls />
                <Area type="monotone" dataKey="B" name="Variant B" stroke={COLORS.b} strokeWidth={2.5} strokeDasharray="4 4" fill="none" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Technical Methodology & Scientific Attestation */}
        <section style={{ marginTop: '40px', borderTop: '2px solid var(--hairline)', paddingTop: '20px' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
            SCIENTIFIC ATTESTATION & METHODOLOGY
          </span>
          <p style={{ fontSize: '10.5px', color: 'var(--body)', lineHeight: 1.6, margin: 0 }}>
            Rewire uses a deep learning brain-response model running on GPU clusters, paired with our proprietary synthetic demographic synthesis engine. All metrics represent an ensemble average of 200 virtual human subjects across 20,484 cortical surface vertices with empirical hemodynamic lag compensation (+3.0s Kids, +5.0s Older Adults), AR(1) pink noise autocorrelation, and sigmoidal saturation constraints.
          </p>
        </section>

      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background-color: #fff !important; }
          .report-overlay { position: static !important; padding: 0 !important; background-color: #fff !important; }
          .report-container { border: none !important; margin: 0 !important; width: 100% !important; padding: 20px !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
};

export default ReportView;
