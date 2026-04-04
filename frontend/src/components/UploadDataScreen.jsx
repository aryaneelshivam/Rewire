import React, { useState } from 'react';
import { Upload, CheckCircle2, Loader2, Link2, Download } from 'lucide-react';
import { uploadPredictions, fetchStatus } from '../api';

const UploadDataScreen = ({ onUploadComplete, onCancel }) => {
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleUpload = async () => {
    if (!fileA || !fileB) return;

    setIsUploading(true);
    setError(null);

    try {
      await uploadPredictions(fileA, fileB);
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
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#050505', color: 'white' }}>
      
      <div style={{ 
        maxWidth: '440px', 
        width: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        padding: '2rem'
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

        {/* Inputs */}
        <div style={{ display: 'flex', gap: '1rem', width: '100%', marginBottom: '1.5rem' }}>
          <UploadSlot variant="A" file={fileA} setFile={setFileA} color="#E85D24" />
          <UploadSlot variant="B" file={fileB} setFile={setFileB} color="#7F77DD" />
        </div>

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
                    Analyzing
                  </>
                ) : (
                  'Run Analysis Engine'
                )}
              </button>
            </div>
          )}
        </div>
        
        {/* Download Samples Link */}
        <div style={{ marginTop: '2rem' }}>
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
