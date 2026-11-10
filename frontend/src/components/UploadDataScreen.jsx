import React, { useState } from 'react';
import { Button } from '@/components/arc/button/button';
import { Select } from '@/components/arc/select/select';
import { FileDropzone } from '@/components/arc/file-dropzone/file-dropzone';
import { Accordion } from '@/components/arc/accordion/accordion';
import { Alert } from '@/components/arc/alert/alert';
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
        setError("The backend finished but returned no results. Check the backend logs and try again.");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "The files could not be uploaded. Check that the backend is running and try again.");
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
        setError("The sample data loaded but returned no results. Try again.");
      }
    } catch (err) {
      console.error(err);
      setError("The sample data could not load. Check that brand_A_predictions.pkl is in the backend folder.");
    } finally {
      setIsLoadingSamples(false);
    }
  };

  const metaFields = (variant, meta, setMeta) => (
    <div className="meta-col">
      <h3 className="aside-title">Variant {variant}</h3>
      <Select label="Genre" options={GENRE_OPTIONS} value={meta.genre} onValueChange={v => setMeta({ ...meta, genre: v })} />
      <Select label="Format" options={CONTENT_TYPE_OPTIONS} value={meta.content_type} onValueChange={v => setMeta({ ...meta, content_type: v })} />
      <Select label="Pacing" options={PACING_OPTIONS} value={meta.pacing} onValueChange={v => setMeta({ ...meta, pacing: v })} />
      <Select label="Audio" options={AUDIO_OPTIONS} value={meta.audio_profile} onValueChange={v => setMeta({ ...meta, audio_profile: v })} />
    </div>
  );

  const dropzone = (variant, setFile) => (
    <div className="dropzone-col">
      <h3 className="aside-title">Variant {variant}</h3>
      <FileDropzone
        accept=".pkl"
        multiple={false}
        maxFiles={1}
        label={`Add Variant ${variant} predictions`}
        description="Drop the .pkl file or choose it from your device"
        note="One .pkl prediction file"
        onFilesChange={files => setFile(files[0] ?? null)}
      />
    </div>
  );

  return (
    <main className="onboard">
      <div className="onboard-card">
        <div className="onboard-brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" /><path d="M9 21h6" />
          </svg>
          Rewire
        </div>

        <div>
          <h1>Compare two creatives</h1>
          <p className="onboard-lede">Add the brain-response predictions for each video, or start with the sample pair.</p>
        </div>

        <section className="card onboard-form" aria-label="Prediction files">
          <div className="dropzones">
            {dropzone('A', setFileA)}
            {dropzone('B', setFileB)}
          </div>

          <Accordion
            defaultOpen={-1}
            items={[{
              title: 'Creative details (optional)',
              content: <div className="meta-grid">{metaFields('A', metaA, setMetaA)}{metaFields('B', metaB, setMetaB)}</div>,
            }]}
          />

          {error && <Alert tone="danger" title="The analysis did not run">{error}</Alert>}

          <div className="onboard-actions">
            <Button variant="secondary" loading={isLoadingSamples} disabled={isUploading} onClick={handleLoadSamples}>Use sample data</Button>
            <div className="onboard-actions-end">
              {onCancel && <Button variant="ghost" onClick={onCancel}>Back to results</Button>}
              <Button loading={isUploading} disabled={!fileA || !fileB || isLoadingSamples} onClick={handleUpload}>Run analysis</Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default UploadDataScreen;
