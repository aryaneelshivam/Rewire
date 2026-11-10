import React, { useEffect, useRef, useState } from 'react';
import { Film, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/arc/button/button';
import { Slider } from '@/components/arc/slider/slider';
import { Tooltip } from '@/components/arc/tooltip/tooltip';
import { Badge } from '@/components/arc/badge/badge';
import { EmptyState } from '@/components/arc/empty-state/empty-state';
import { PlayPauseIcon } from '@/components/arc/icon-morph/icon-morph';

const SPEEDS = [1, 1.5, 2, 0.5];
const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * A large player for the winning creative. It owns the playhead: its video drives the time,
 * and without a video the same controls step through the predictions second by second.
 */
export default function WinnerPlayer({ winner, videoUrl, currentTime, duration, isPlaying, onTogglePlay, onSeek, onTimeUpdate, onPlayingChange, onAddVideo, peakTime, videoRef }) {
  const [muted, setMuted] = useState(true);
  const [speed, setSpeed] = useState(1);
  const fallbackRef = useRef(null);
  const ref = videoRef ?? fallbackRef;

  useEffect(() => { if (ref.current) ref.current.playbackRate = speed; }, [speed, ref, videoUrl]);
  useEffect(() => { if (ref.current) ref.current.muted = muted; }, [muted, ref, videoUrl]);

  const label = winner === 'TIE' ? 'Variant A' : `Variant ${winner}`;
  const nextSpeed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
  const max = Math.max(1, duration - 1);

  return (
    <section className="player-panel" aria-labelledby="player-title">
      <header className="player-head">
        <h2 id="player-title">{winner === 'TIE' ? 'Variant A' : <span className={winner === 'B' ? 'num-b' : 'num-a'}>{label}</span>}</h2>
        <Badge size="sm" tone={winner === 'TIE' ? 'neutral' : 'success'}>{winner === 'TIE' ? 'Evenly matched' : 'Winning creative'}</Badge>
      </header>

      <div className="player-stage">
        {videoUrl ? (
          <video
            ref={ref}
            src={videoUrl}
            playsInline
            muted={muted}
            onClick={onTogglePlay}
            onTimeUpdate={onTimeUpdate}
            onPlay={() => onPlayingChange(true)}
            onPause={() => onPlayingChange(false)}
            onEnded={() => onPlayingChange(false)}
            aria-label={`${label} video`}
          />
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
