/**
 * Video or audio: what each kind of creative accepts and how it's spoken of. One analysis is one kind; a comparison
 * of one video with one audio file isn't offered, since the two aren't measured alike.
 */
import { Clapperboard, AudioLines } from 'lucide-react';

export const MEDIA = {
  video: {
    accept: 'video/mp4,video/quicktime,video/webm,video/x-m4v,video/x-matroska,.mp4,.mov,.m4v,.webm,.mkv',
    test: f => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name),
    noun: 'video', nouns: 'videos', formats: 'MP4, MOV or WebM', Icon: Clapperboard,
    hello: 'Show me your video.', step: 'Watching it, frame by frame',
  },
  audio: {
    accept: 'audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg',
    test: f => f.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(f.name),
    noun: 'audio file', nouns: 'audio files', formats: 'MP3, WAV or M4A', Icon: AudioLines,
    hello: 'Play me your audio.', step: 'Listening to it, second by second',
  },
};

/** 'video', 'audio', or null for a file that is neither. */
export const mediumOf = file => (MEDIA.video.test(file) ? 'video' : MEDIA.audio.test(file) ? 'audio' : null);

/** Seconds of a video or audio file, read in the browser; null when it can't be read. */
export function mediaLength(file, medium) {
  return new Promise(resolve => {
    const el = document.createElement(medium === 'audio' ? 'audio' : 'video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => { resolve(el.duration); URL.revokeObjectURL(el.src); };
    el.onerror = () => resolve(null);
    el.src = URL.createObjectURL(file);
  });
}
