import React, { useState } from 'react';
import { Upload, CheckCircle2, Loader2, Link2, Download, ChevronDown, Sparkles } from 'lucide-react';
import { uploadPredictions, fetchStatus } from '../api';

const GENRE_OPTIONS = [
  { value: 'general',       label: 'General',       icon: '📺' },
  { value: 'emotional',     label: 'Emotional',     icon: '💔' },
  { value: 'humor',         label: 'Humor',         icon: '😂' },
  { value: 'action',        label: 'Action',        icon: '💥' },
  { value: 'informational', label: 'Informational', icon: '📊' },
  { value: 'horror',        label: 'Horror',        icon: '👻' },
  { value: 'luxury',        label: 'Luxury',        icon: '✨' },
];

const PACING_OPTIONS = [
  { value: 'fast_cut',  label: 'Fast Cut (<2s avg)' },
  { value: 'medium',    label: 'Medium' },
  { value: 'slow_burn', label: 'Slow Burn (>5s avg)' },
];

const AUDIO_OPTIONS = [
  { value: 'music_heavy',    label: 'Music Heavy' },
  { value: 'dialogue_heavy', label: 'Dialogue Heavy' },
  { value: 'mixed',          label: 'Mixed' },
  { value: 'silent',         label: 'Silent / Ambient' },
];

const CONTENT_TYPE_OPTIONS = [
  { value: 'video_ad',    label: 'Video Ad' },
  { value: 'music_video', label: 'Music Video' },
  { value: 'trailer',     label: 'Trailer' },
  { value: 'short_form',  label: 'Short Form' },
  { value: 'documentary', label: 'Documentary' },
];

/* ─── Styled Select ─── */
const StyledSelect = ({ value, onChange, options, label, color }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
    <span style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {label}
    </span>
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          appearance: 'none',
          WebkitAppearance: 'none',
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${color ? `${color}30` : 'rgba(255,255,255,0.08)'}`,
          borderRadius: '6px',
          color: '#fff',
          padding: '0.45rem 1.8rem 0.45rem 0.6rem',
          fontSize: '0.72rem',
          fontWeight: 500,
          fontFamily: 'Inter, sans-serif',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          outline: 'none',
        }}
        onFocus={e => e.currentTarget.style.borderColor = color || 'rgba(255,255,255,0.25)'}
        onBlur={e => e.currentTarget.style.borderColor = color ? `${color}30` : 'rgba(255,255,255,0.08)'}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value} style={{ background: '#1a1a1a', color: '#fff' }}>
            {opt.icon ? `${opt.icon} ${opt.label}` : opt.label}
          </option>
        ))}
      </select>
      <ChevronDown size={12} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-tertiary)' }} />
    </div>
  </div>
);

/* ─── Number Input (brand reveal) ─── */
const StyledNumberInput = ({ value, onChange, label, color, placeholder }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
    <span style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {label}
    </span>
    <input
      type="number"
      min="-1"
      value={value}
      onChange={e => onChange(parseInt(e.target.value) || -1)}
      placeholder={placeholder}
      style={{
        width: '100%',
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${color ? `${color}30` : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '6px',
        color: '#fff',
        padding: '0.45rem 0.6rem',
        fontSize: '0.72rem',
        fontWeight: 500,
        fontFamily: 'Inter, sans-serif',
        outline: 'none',
        transition: 'all 0.2s ease',
      }}
      onFocus={e => e.currentTarget.style.borderColor = color || 'rgba(255,255,255,0.25)'}
      onBlur={e => e.currentTarget.style.borderColor = color ? `${color}30` : 'rgba(255,255,255,0.08)'}
    />
  </div>
);

/* ─── Metadata Panel for a single variant ─── */
const MetadataPanel = ({ variant, color, metadata, setMetadata }) => (
  <div style={{
    padding: '0.75rem',
    borderRadius: '8px',
    border: `1px solid ${color}18`,
    background: `${color}06`,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.1rem' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: '0.65rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Variant {variant} Profile
      </span>
    </div>
    
    <StyledSelect
      label="Genre"
      value={metadata.genre}
      onChange={v => setMetadata({ ...metadata, genre: v })}
      options={GENRE_OPTIONS}
      color={color}
    />
    <StyledSelect
      label="Content Type"
      value={metadata.content_type}
      onChange={v => setMetadata({ ...metadata, content_type: v })}
      options={CONTENT_TYPE_OPTIONS}
      color={color}
    />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
      <StyledSelect
        label="Pacing"
        value={metadata.pacing}
        onChange={v => setMetadata({ ...metadata, pacing: v })}
        options={PACING_OPTIONS}
        color={color}
      />
      <StyledSelect
        label="Audio"
        value={metadata.audio_profile}
        onChange={v => setMetadata({ ...metadata, audio_profile: v })}
        options={AUDIO_OPTIONS}
        color={color}
      />
    </div>
    <StyledNumberInput
      label="Brand Reveal (second)"
      value={metadata.brand_reveal_timestamp}
      onChange={v => setMetadata({ ...metadata, brand_reveal_timestamp: v })}
      color={color}
      placeholder="-1 = auto"
    />
  </div>
);


const UploadDataScreen = ({ onUploadComplete, onCancel }) => {
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [showMetadata, setShowMetadata] = useState(false);

  // V4: Content metadata state
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
        setError("Analysis failed. Backend returned empty state.");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Upload failed. Check backend logs.");
    } finally {
      setIsUploading(false);
    }
  };

  const UploadSlot = ({ variant, file, setFile, color }) => (
    <div style={{
      flex: 1,
      position: 'relative',
      padding: '1.25rem',
      borderRadius: '8px',
      border: `1px solid ${file ? color : 'rgba(255,255,255,0.08)'}`,
      background: file ? `${color}10` : 'transparent',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.3s ease',
      cursor: 'pointer'
    }}
    onMouseEnter={(e) => {
      if (!file) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
    }}
    onMouseLeave={(e) => {
      if (!file) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
    }}
    >
      <input 
        type="file" 
        accept=".pkl" 
        onChange={e => setFile(e.target.files[0])} 
        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', cursor: 'pointer' }}
      />
      
      {file ? (
        <>
          <CheckCircle2 size={24} color={color} style={{ marginBottom: '0.5rem' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color }}>Variant {variant}</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '0.2rem', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file.name}
          </span>
        </>
      ) : (
        <>
          <Upload size={20} color="var(--text-tertiary)" style={{ marginBottom: '0.5rem' }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Variant {variant} PKL</span>
        </>
      )}
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#050505', color: 'white', overflowY: 'auto' }}>
      
      <div style={{ 
        maxWidth: showMetadata ? '560px' : '440px', 
        width: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        padding: '2rem',
        transition: 'max-width 0.3s ease',
      }}>
        
        {/* Minimal Hero Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
          <div style={{ 
            width: '28px', height: '28px', 
            borderRadius: '6px', 
            background: 'linear-gradient(135deg, #E85D24, #7F77DD)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Link2 size={14} color="#fff" />
          </div>
          <span style={{ fontFamily: 'Outfit', fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
            Rewire Initialization
          </span>
        </div>

        {/* Upload Slots */}
        <div style={{ display: 'flex', gap: '1rem', width: '100%', marginBottom: '1rem' }}>
          <UploadSlot variant="A" file={fileA} setFile={setFileA} color="#E85D24" />
          <UploadSlot variant="B" file={fileB} setFile={setFileB} color="#7F77DD" />
        </div>

        {/* V4: Content Metadata Toggle */}
        <button
          onClick={() => setShowMetadata(!showMetadata)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            padding: '0.5rem',
            background: showMetadata ? 'rgba(255,255,255,0.04)' : 'transparent',
            border: `1px solid ${showMetadata ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: '8px',
            color: showMetadata ? '#fff' : 'var(--text-tertiary)',
            fontSize: '0.7rem',
            fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
            marginBottom: showMetadata ? '1rem' : '0.75rem',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; }}
          onMouseLeave={e => { if (!showMetadata) { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; } }}
        >
          <Sparkles size={12} />
          V4 Content Profile {showMetadata ? '(Active)' : '— Enhance Accuracy'}
          <ChevronDown size={12} style={{ transform: showMetadata ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.25s ease' }} />
        </button>

        {/* V4: Metadata Panels */}
        {showMetadata && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem',
            width: '100%',
            marginBottom: '1rem',
            animation: 'fadeIn 0.3s ease forwards',
          }}>
            <MetadataPanel variant="A" color="#E85D24" metadata={metaA} setMetadata={setMetaA} />
            <MetadataPanel variant="B" color="#7F77DD" metadata={metaB} setMetadata={setMetaB} />
          </div>
        )}

        {/* Action / Error */}
        <div style={{ width: '100%', height: '45px', position: 'relative' }}>
          {error && !isUploading && (
            <div style={{ 
              position: 'absolute', inset: 0, 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              color: '#FF6B6B', fontSize: '0.75rem', fontWeight: 500 
            }}>
              {error}
            </div>
          )}

          {(!error || isUploading) && (
            <div style={{ display: 'flex', gap: '0.75rem', height: '100%' }}>
              {onCancel && !isUploading && (
                <button 
                  onClick={onCancel}
                  style={{
                    flex: '0 0 auto',
                    padding: '0 1.5rem',
                    borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '0.85rem', fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                >
                  Cancel
                </button>
              )}
              <button 
                onClick={handleUpload}
                disabled={!fileA || !fileB || isUploading}
                style={{
                  flex: 1,
                  borderRadius: '8px', border: 'none',
                  background: (!fileA || !fileB || isUploading) ? 'rgba(255,255,255,0.04)' : '#fff',
                  color: (!fileA || !fileB || isUploading) ? 'rgba(255,255,255,0.3)' : '#000',
                  fontSize: '0.85rem', fontWeight: 600,
                  cursor: (!fileA || !fileB || isUploading) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  transition: 'all 0.2s',
                }}
              >
                {isUploading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Analyzing{showMetadata ? ' (V4 Engine)' : ''}
                  </>
                ) : (
                  showMetadata ? 'Run V4 Content-Aware Analysis' : 'Run Analysis Engine'
                )}
              </button>
            </div>
          )}
        </div>
        
        {/* Info badge when metadata is active */}
        {showMetadata && (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '6px',
            background: 'rgba(127, 119, 221, 0.06)',
            border: '1px solid rgba(127, 119, 221, 0.12)',
            fontSize: '0.62rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            textAlign: 'center',
          }}>
            🧠 V4 Engine applies <strong style={{ color: '#7F77DD' }}>genre-specific ROI modulation</strong>, <strong style={{ color: '#E85D24' }}>pacing-adaptive noise</strong>, and <strong style={{ color: '#1D9E75' }}>event-driven fatigue recovery</strong> for more accurate 200-brain simulation.
          </div>
        )}

        {/* Download Samples Link */}
        <div style={{ marginTop: '1.5rem' }}>
          <a
            href="/samples.zip"
            download="samples.zip"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              color: 'var(--text-tertiary)',
              fontSize: '0.8rem',
              fontWeight: 500,
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
          >
            <Download size={14} />
            Download Sample Files
          </a>
        </div>
      </div>
    </div>
  );
};

export default UploadDataScreen;
