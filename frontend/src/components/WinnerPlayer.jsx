import React, { useEffect, useRef, useState } from 'react';
import { Film, AudioLines, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/arc/button/button';
import { Slider } from '@/components/arc/slider/slider';
import { Tooltip } from '@/components/arc/tooltip/tooltip';
import { Badge } from '@/components/arc/badge/badge';
import { EmptyState } from '@/components/arc/empty-state/empty-state';
import { PlayPauseIcon } from '@/components/arc/icon-morph/icon-morph';
import './WinnerPlayer.css';

const SPEEDS = [1, 1.5, 2, 0.5];
const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * A large player for the variant in focus (the winner, until another is picked). It owns the playhead: its video
 * drives the time, and without a video the same controls step through the predictions second by second. When the
 * focus moves to another variant, the new video picks up at the same second, playing if the last one was.
 * `audio`: the file is sound only. It plays through an audio element over `poster` (its waveform), with the part
 * already played shaded, and starts unmuted, since sound is the whole point.
 */
export default function WinnerPlayer({ winner, focus = 'A', videoUrl, currentTime, duration, isPlaying, onTogglePlay, onSeek, onTimeUpdate, onPlayingChange, onAddVideo, peakTime, videoRef, resumeRef, audio = false, poster }) {
  const [muted, setMuted] = useState(!audio);
  const [speed, setSpeed] = useState(1);
  const fallbackRef = useRef(null);
  const ref = videoRef ?? fallbackRef;

  useEffect(() => { if (ref.current) ref.current.playbackRate = speed; }, [speed, ref, videoUrl]);
  useEffect(() => { if (ref.current) ref.current.muted = muted; }, [muted, ref, videoUrl]);

  // SINGLE: one creative was analysed, so there is no winner to announce.
  const single = winner === 'SINGLE';
  const label = single ? 'Your creative' : `Variant ${focus}`;
  const isWinner = !single && winner === focus;
  const nextSpeed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
  const max = Math.max(1, duration - 1);
  const media = {
    ref, src: videoUrl, muted, onTimeUpdate,
    onLoadedMetadata: e => {
      // A new variant's file: continue from the same second, and keep playing if the last one was.
      const resume = resumeRef?.current;
      if (!resume) return;
      resumeRef.current = null;
      const el = e.currentTarget;
      el.currentTime = Math.min(resume.time, Math.max(0, el.duration - 0.05));
      if (resume.play) el.play().catch(() => onPlayingChange(false));
    },
    onPlay: () => onPlayingChange(true),
    onPause: () => onPlayingChange(false),
    onEnded: () => onPlayingChange(false),
  };

  return (
    <section className="player-panel" aria-labelledby="player-title">
      <header className="player-head">
        <h2 id="player-title">{single ? label : <span className={focus === 'B' ? 'num-b' : 'num-a'}>{label}</span>}</h2>
        {!single && (winner === 'TIE'
          ? <Badge size="sm" tone="neutral">Evenly matched</Badge>
          : isWinner
            ? <Badge size="sm" tone="success">Winning creative</Badge>
            : <Badge size="sm" tone="neutral">{`Variant ${winner} won`}</Badge>)}
      </header>

      <div className="player-stage">
        {videoUrl && audio ? (
          <div className="player-audio" onClick={onTogglePlay} style={{ '--played': `${Math.min(1, currentTime / max) * 100}%` }}>
            {poster
              ? <><img className="wave-dim" src={poster} alt="" /><img className="wave-on" src={poster} alt="" /></>
              : <AudioLines size={40} strokeWidth={1.25} aria-hidden="true" />}
            <audio {...media} aria-label={`${label} audio`} />
          </div>
        ) : videoUrl ? (
          <video {...media} playsInline onClick={onTogglePlay} aria-label={`${label} video`} />
        ) : (
          <EmptyState
            icon={<Film width={24} height={24} strokeWidth={1.5} />}
            title={`No video for ${label} yet`}
            description="Add the MP4 to watch it in sync with the predictions. The controls below still move the playhead."
            action={<Button variant="secondary" onClick={onAddVideo}>Add video</Button>}
          />
        )}
      </div>

      <div className="player-controls">
        <Tooltip content={isPlaying ? 'Pause' : 'Play'}>
          <Button variant="secondary" className="round-btn" aria-label={isPlaying ? 'Pause' : 'Play'} aria-pressed={isPlaying} onClick={onTogglePlay}>
            <PlayPauseIcon state={isPlaying} size={18} />
          </Button>
        </Tooltip>
        <Tooltip content={muted ? 'Unmute' : 'Mute'}>
          <Button variant="secondary" className="round-btn" aria-label={muted ? 'Unmute' : 'Mute'} disabled={!videoUrl} onClick={() => setMuted(m => !m)}>
            {muted ? <VolumeX size={18} strokeWidth={1.75} aria-hidden="true" /> : <Volume2 size={18} strokeWidth={1.75} aria-hidden="true" />}
          </Button>
        </Tooltip>
        <Tooltip content={`Playback speed, next ${nextSpeed}×`}>
          <Button variant="secondary" className="round-btn speed-btn" aria-label={`Playback speed ${speed}×`} disabled={!videoUrl} onClick={() => setSpeed(nextSpeed)}>
            {speed}×
          </Button>
        </Tooltip>
        <Slider
          className="player-scrub"
          label="Playhead"
          min={0}
          max={max}
          value={Math.min(currentTime, max)}
          onValueChange={onSeek}
          format={fmtClock}
          marks={peakTime != null ? [{ value: Math.min(peakTime, max), label: 'Peak' }] : undefined}
        />
      </div>
    </section>
  );
}
