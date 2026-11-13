import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WinnerPlayer from '@/components/WinnerPlayer';
import CreativeTimeline from '@/components/CreativeTimeline';
import { EVENT_TYPES } from '@/lib/timeline-events';
import { mediaUrl } from './api';

// The dashboard's markers, worded for creators: attention, not brain response.
const CHAT_EVENT_TYPES = {
  ...EVENT_TYPES,
  rise: { label: 'Attention rises', source: 'A sharp rise in predicted attention' },
  fall: { label: 'Attention drops', source: 'A sharp drop in predicted attention' },
  peak: { label: 'Peak attention', source: 'The strongest predicted moment' },
};

/**
 * A finished analysis, front and centre: the dashboard's own player (the winner first) and, under it, its detailed
 * timeline (filmstrip, scenes, dialogue, sound, markers, ranges and notes), sharing one playhead. Wired the way the
 * dashboard wires them (frontend/src/App.jsx), without the analysis tabs.
 */
export default function ResultsView({ overview, media, winner, runKey, onNewVideo }) {
  const variants = Object.keys(overview);
  const single = variants.length === 1;
  const [focus, setFocus] = useState(single || winner !== 'B' ? 'A' : 'B');
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopRange, setLoopRange] = useState(null);
  const playerRef = useRef(null);
  const resumeRef = useRef(null);

  const videoUrl = v => mediaUrl(media?.[v]?.video);
  const focusVideo = videoUrl(focus);
  const maxTimesteps = Math.max(...variants.map(v => overview[v].n_timesteps));

  const seek = t => {
    const clamped = Math.max(0, Math.min(t, maxTimesteps - 1));
    if (playerRef.current) playerRef.current.currentTime = clamped;
    setCurrentTime(clamped);
  };
  const togglePlayback = () => {
    const video = playerRef.current;
    if (video) { if (video.paused) video.play(); else video.pause(); return; }
    setIsPlaying(p => !p);
  };
  // Moving the focus keeps the second (clamped to the other video's length) and whether it was playing.
  const changeFocus = useCallback(next => {
    if (next === focus) return;
    const at = Math.max(0, Math.min(currentTime, (overview[next]?.n_timesteps ?? 1) - 1));
    resumeRef.current = videoUrl(next) ? { time: at, play: isPlaying } : null;
    setCurrentTime(at);
    setFocus(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, currentTime, isPlaying, overview, media]);

  // A looped range sends the playhead back to its start at the end.
  useEffect(() => {
    if (loopRange && (currentTime >= loopRange.end || currentTime < loopRange.start)) seek(loopRange.start);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, loopRange]);
  const playRange = span => {
    setLoopRange(span);
    if (!span) return;
    seek(span.start);
    if (playerRef.current) playerRef.current.play(); else setIsPlaying(true);
  };
  // Without a video (the sample), the playhead steps through the seconds.
  useEffect(() => {
    if (!isPlaying || focusVideo) return;
    const n = overview[focus]?.n_timesteps ?? 1;
    const id = setInterval(() => setCurrentTime(t => (t + 1) % n), 1000);
    return () => clearInterval(id);
  }, [isPlaying, focusVideo, focus, overview]);

  const tracks = useMemo(() => variants.map(v => ({
    variant: v, overview: overview[v], videoUrl: videoUrl(v), isWinner: v === (winner === 'B' ? 'B' : 'A'),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [overview, media, winner]);

  return (
    <div className="results">
      <WinnerPlayer
        winner={single ? 'SINGLE' : winner}
        focus={focus}
        videoUrl={focusVideo}
        videoRef={playerRef}
        resumeRef={resumeRef}
        currentTime={currentTime}
        duration={overview[focus].n_timesteps}
        peakTime={overview[focus].peak_timestep}
        isPlaying={isPlaying}
        onTogglePlay={togglePlayback}
        onSeek={seek}
        onTimeUpdate={e => setCurrentTime(Math.floor(e.target.currentTime))}
        onPlayingChange={setIsPlaying}
        onAddVideo={onNewVideo}
      />
      <CreativeTimeline
        duration={maxTimesteps}
        currentTime={currentTime}
        onSeek={seek}
        tracks={tracks}
        focus={focus}
        onFocusChange={changeFocus}
        onPlayRange={playRange}
        loopRange={loopRange}
        storageKey={`rewire-chat-notes:${runKey}`}
        eventTypes={CHAT_EVENT_TYPES}
      />
    </div>
  );
}
