import React, { useState } from 'react';
import { Upload, CheckCircle2, Loader2, Copy, Check, Terminal, ChevronDown, Sliders } from 'lucide-react';
import { uploadPredictions, fetchStatus, loadSampleData } from '../api';

const GENRE_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'emotional', label: 'Emotional' },
  { value: 'humor', label: 'Humor' },
  { value: 'action', label: 'Action' },
  { value: 'informational', label: 'Informational' },
  { value: 'luxury', label: 'Luxury' },
];

const PACING_OPTIONS = [
  { value: 'fast_cut', label: 'Fast Cut (<2s avg)' },
  { value: 'medium', label: 'Medium' },
  { value: 'slow_burn', label: 'Slow Burn (>5s avg)' },
];

const AUDIO_OPTIONS = [
  { value: 'music_heavy', label: 'Music Heavy' },
  { value: 'dialogue_heavy', label: 'Dialogue Heavy' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'silent', label: 'Silent / Ambient' },
];

const CONTENT_TYPE_OPTIONS = [
  { value: 'video_ad', label: 'Video Ad' },
  { value: 'music_video', label: 'Music Video' },
  { value: 'trailer', label: 'Trailer' },
  { value: 'short_form', label: 'Short Form' },
];

const UploadDataScreen = ({ onUploadComplete, onCancel }) => {
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingSamples, setIsLoadingSamples] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);

  const [metaA, setMetaA] = useState({
    genre: 'general',
    content_type: 'video_ad',
    pacing: 'medium',
    audio_profile: 'mixed',
    brand_reveal_timestamp: -1,
  });
  const [metaB, setMetaB] = useState({
    genre: 'general',
    content_type: 'video_ad',
    pacing: 'medium',
    audio_profile: 'mixed',
    brand_reveal_timestamp: -1,
  });

  const snippetCmd = "curl -fsSL https://rewire.ai/eval | sh";

  const handleCopy = () => {
    navigator.clipboard.writeText(snippetCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpload = async () => {
    if (!fileA || !fileB) return;
    setIsUploading(true);
    setError(null);

    try {
      await uploadPredictions(fileA, fileB, metaA, metaB);
      const status = await fetchStatus();
      if (status.loaded) {
        onUploadComplete();
      } else {
        setError("Analysis failed. Backend returned uninitialized cache.");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Upload failed. Check backend logs.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLoadSamples = async () => {
    setIsLoadingSamples(true);
    setError(null);
    try {
      await loadSampleData();
      const status = await fetchStatus();
      if (status.loaded) {
        onUploadComplete();
      } else {
        setError("Sample loading completed without initialized state.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load sample dataset. Ensure brand_A_predictions.pkl exists in backend.");
    } finally {
      setIsLoadingSamples(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--canvas)',
      color: 'var(--ink)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '48px 24px 88px',
      fontFamily: 'var(--font-body)',
    }}>
      {/* Top Navigation Strip */}
      <div style={{
        width: '100%',
        maxWidth: '720px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '64px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Hand-drawn minimal mascot / icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
            <path d="M9 21h6" />
          </svg>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '16px' }}>Rewire</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a href="https://github.com/aryaneelshivam/Rewire" target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: 'var(--body)', textDecoration: 'none' }}>Docs</a>
          <a href="https://github.com/aryaneelshivam/Rewire" target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: 'var(--body)', textDecoration: 'none' }}>GitHub</a>
          {onCancel && (
            <button onClick={onCancel} className="btn-secondary" style={{ height: '32px', padding: '0 14px', fontSize: '13px' }}>
              Return to Dashboard
            </button>
          )}
        </div>
      </div>

      {/* Main Single Column (720px max-width) */}
      <div style={{ width: '100%', maxWidth: '720px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        
        {/* Llama-style central mascot ornament */}
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: 'var(--rounded-full)',
          border: '1px solid var(--hairline)',
          backgroundColor: 'var(--surface-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04" />
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04" />
          </svg>
        </div>

        {/* 36px Center-aligned SF Pro Rounded Headline */}
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '34px',
          fontWeight: 600,
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          color: 'var(--ink)',
          marginBottom: '12px',
        }}>
          The easiest way to predict neural resonance
        </h1>

        <p style={{
          fontSize: '16px',
          color: 'var(--body)',
          maxWidth: '540px',
          lineHeight: 1.5,
          marginBottom: '28px',
        }}>
          Simulate cortical activation and run biologically grounded A/B benchmarking across 200 synthetic brains before ad spend.
        </p>

        {/* Inline curl install snippet inside soft-gray pill */}
        <div
          onClick={handleCopy}
          className="install-snippet"
          style={{ marginBottom: '32px' }}
          title="Click to copy"
        >
          <span>{snippetCmd}</span>
          <span className="copy-btn">
            {copied ? <Check size={14} color="#000000" /> : <Copy size={14} />}
          </span>
        </div>

        {/* Terminal Mockup Card (Only product preview on landing) */}
        <div className="terminal-card" style={{ width: '100%', textAlign: 'left', marginBottom: '40px' }}>
          <div className="terminal-header">
            <div className="terminal-traffic-lights">
              <span className="traffic-dot red" />
              <span className="traffic-dot yellow" />
              <span className="traffic-dot green" />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--mute)' }}>rewire-cli — zsh</span>
          </div>
          <div className="terminal-body">
            <div><span className="comment"># Ingest fMRI predictions and run demographic synthesis</span></div>
            <div><span className="cmd">ollama run openclaw &amp;&amp; rewire evaluate \</span></div>
            <div>&nbsp;&nbsp;--variant-a brand_A_predictions.pkl \</div>
            <div>&nbsp;&nbsp;--variant-b brand_B_predictions.pkl \</div>
            <div>&nbsp;&nbsp;--mesh fsaverage5 --cohorts 200</div>
            <div style={{ marginTop: '8px', color: 'var(--charcoal)' }}>
              ✔ Meta Tribe v2 Z-scores loaded (20,484 vertices)<br />
              ✔ Temporal latency applied (+3s Kids, +5s Older)<br />
              ✔ Neural variance calibrated (AR(1) autocorrelation)
            </div>
          </div>
        </div>

        {/* Upload Slots Section */}
        <div style={{ width: '100%', marginBottom: '24px' }}>
          <div style={{ textAlign: 'left', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--charcoal)' }}>
              Select Model Predictions (.pkl)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Variant A */}
            <label style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '28px 16px',
              borderRadius: 'var(--rounded-lg)',
              border: fileA ? '1px solid var(--ink)' : '1px solid var(--hairline)',
              backgroundColor: fileA ? 'var(--surface-soft)' : 'var(--canvas)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}>
              <input
                type="file"
                accept=".pkl"
                onChange={e => setFileA(e.target.files[0])}
                style={{ display: 'none' }}
              />
              {fileA ? (
                <>
                  <CheckCircle2 size={24} color="#000000" style={{ marginBottom: '8px' }} />
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>Variant A</span>
                  <span style={{ fontSize: '12px', color: 'var(--body)', marginTop: '4px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {fileA.name}
                  </span>
                </>
              ) : (
                <>
                  <Upload size={22} color="var(--mute)" style={{ marginBottom: '8px' }} />
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)' }}>Choose Variant A</span>
                  <span style={{ fontSize: '12px', color: 'var(--mute)', marginTop: '2px' }}>brand_A_predictions.pkl</span>
                </>
              )}
            </label>

            {/* Variant B */}
            <label style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '28px 16px',
              borderRadius: 'var(--rounded-lg)',
              border: fileB ? '1px solid var(--ink)' : '1px solid var(--hairline)',
              backgroundColor: fileB ? 'var(--surface-soft)' : 'var(--canvas)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}>
              <input
                type="file"
                accept=".pkl"
                onChange={e => setFileB(e.target.files[0])}
                style={{ display: 'none' }}
              />
              {fileB ? (
                <>
                  <CheckCircle2 size={24} color="#000000" style={{ marginBottom: '8px' }} />
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>Variant B</span>
                  <span style={{ fontSize: '12px', color: 'var(--body)', marginTop: '4px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {fileB.name}
                  </span>
                </>
              ) : (
                <>
                  <Upload size={22} color="var(--mute)" style={{ marginBottom: '8px' }} />
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)' }}>Choose Variant B</span>
                  <span style={{ fontSize: '12px', color: 'var(--mute)', marginTop: '2px' }}>brand_B_predictions.pkl</span>
                </>
              )}
            </label>
          </div>
        </div>

        {/* Content Profile Accordion Button */}
        <div style={{ width: '100%', marginBottom: '24px' }}>
          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className="btn-secondary"
            style={{ width: '100%', justifyContent: 'space-between', height: '40px' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <Sliders size={14} />
              Advanced Content Profiles (Genre, Pacing, Audio)
            </span>
            <ChevronDown size={14} style={{ transform: showMetadata ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {showMetadata && (
            <div style={{
              marginTop: '12px',
              padding: '20px',
              borderRadius: 'var(--rounded-lg)',
              border: '1px solid var(--hairline)',
              backgroundColor: 'var(--surface-soft)',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              textAlign: 'left',
            }}>
              {/* Variant A Meta */}
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: '8px' }}>
                  Variant A Profile
                </span>
                <label style={{ fontSize: '11px', color: 'var(--body)', display: 'block', marginBottom: '4px' }}>Genre</label>
                <select
                  value={metaA.genre}
                  onChange={e => setMetaA({ ...metaA, genre: e.target.value })}
                  className="dark-input"
                  style={{ width: '100%', marginBottom: '8px' }}
                >
                  {GENRE_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>

                <label style={{ fontSize: '11px', color: 'var(--body)', display: 'block', marginBottom: '4px' }}>Pacing</label>
                <select
                  value={metaA.pacing}
                  onChange={e => setMetaA({ ...metaA, pacing: e.target.value })}
                  className="dark-input"
                  style={{ width: '100%', marginBottom: '8px' }}
                >
                  {PACING_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>

                <label style={{ fontSize: '11px', color: 'var(--body)', display: 'block', marginBottom: '4px' }}>Audio</label>
                <select
                  value={metaA.audio_profile}
                  onChange={e => setMetaA({ ...metaA, audio_profile: e.target.value })}
                  className="dark-input"
                  style={{ width: '100%' }}
                >
                  {AUDIO_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>

              {/* Variant B Meta */}
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: '8px' }}>
                  Variant B Profile
                </span>
                <label style={{ fontSize: '11px', color: 'var(--body)', display: 'block', marginBottom: '4px' }}>Genre</label>
                <select
                  value={metaB.genre}
                  onChange={e => setMetaB({ ...metaB, genre: e.target.value })}
                  className="dark-input"
                  style={{ width: '100%', marginBottom: '8px' }}
                >
                  {GENRE_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>

                <label style={{ fontSize: '11px', color: 'var(--body)', display: 'block', marginBottom: '4px' }}>Pacing</label>
                <select
                  value={metaB.pacing}
                  onChange={e => setMetaB({ ...metaB, pacing: e.target.value })}
                  className="dark-input"
                  style={{ width: '100%', marginBottom: '8px' }}
                >
                  {PACING_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>

                <label style={{ fontSize: '11px', color: 'var(--body)', display: 'block', marginBottom: '4px' }}>Audio</label>
                <select
                  value={metaB.audio_profile}
                  onChange={e => setMetaB({ ...metaB, audio_profile: e.target.value })}
                  className="dark-input"
                  style={{ width: '100%' }}
                >
                  {AUDIO_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Error Notification */}
        {error && (
          <div style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 'var(--rounded-md)',
            border: '1px solid var(--hairline)',
            backgroundColor: 'var(--surface-soft)',
            color: 'var(--ink)',
            fontSize: '13px',
            marginBottom: '16px',
            textAlign: 'left',
          }}>
            {error}
          </div>
        )}

        {/* Primary CTA Row: Black Pill Action */}
        <div style={{ width: '100%', display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={handleUpload}
            disabled={!fileA || !fileB || isUploading}
            className="button-primary"
            style={{
              flex: 1,
              height: '42px',
              fontSize: '14px',
              opacity: (!fileA || !fileB || isUploading) ? 0.4 : 1,
              cursor: (!fileA || !fileB || isUploading) ? 'not-allowed' : 'pointer',
            }}
          >
            {isUploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Synthesizing Neural Ensemble...
              </>
            ) : (
              'Run Analysis Engine'
            )}
          </button>

          {/* Quick Start with Built-in Samples */}
          <button
            onClick={handleLoadSamples}
            disabled={isLoadingSamples || isUploading}
            className="button-secondary"
            style={{
              height: '42px',
              fontSize: '14px',
            }}
            title="Load brand_A_predictions.pkl and brand_B_predictions.pkl"
          >
            {isLoadingSamples ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Loading...
              </>
            ) : (
              'Use Built-in Samples'
            )}
          </button>
        </div>

        {/* Footer Guarantee Strip */}
        <div style={{
          marginTop: '64px',
          paddingTop: '24px',
          borderTop: '1px solid var(--hairline)',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontSize: '13px',
          color: 'var(--body)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>Your prediction data stays local to your environment.</span>
        </div>
      </div>
    </div>
  );
};

export default UploadDataScreen;
