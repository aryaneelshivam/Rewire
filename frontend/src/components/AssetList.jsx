import React from 'react';
import { urlFor } from '@/lib/object-urls';
import { ArrowUpDown, X } from 'lucide-react';
import { Button } from '@/components/arc/button/button';
import { Tooltip } from '@/components/arc/tooltip/tooltip';

const MAX_VIDEO_SECONDS = 180;
const mb = bytes => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const clock = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** A video's first frame and length, read in the browser from a local object URL. */
function VideoThumb({ file, onDuration }) {
  const url = urlFor(file);
  return (
    <video
      className="asset-thumb"
      src={url}
      muted
      playsInline
      preload="metadata"
      aria-hidden="true"
      onLoadedMetadata={e => { onDuration(e.currentTarget.duration); e.currentTarget.currentTime = Math.min(1, e.currentTarget.duration / 2); }}
    />
  );
}

/**
 * The files dropped on the start screen, as they will be analysed: one is "Your video", two are Variant A and B in
 * the order they were added. Swap fixes the order; remove takes a file out.
 */
export default function AssetList({ files, durations = {}, onDuration, onSwap, onRemove }) {
  if (!files.length) return null;
  const single = files.length === 1;
  const labelFor = i => (single ? 'Your video' : `Variant ${i === 0 ? 'A' : 'B'}`);

  return (
    <div className="asset-list" aria-label="Videos to analyse">
      {files.map(({ id, file }, i) => {
        const seconds = durations[id];
        const tooLong = seconds > MAX_VIDEO_SECONDS;
        return (
          <React.Fragment key={id}>
            {i === 1 && (
              <div className="asset-swap">
                <Tooltip content="Swap which video is A and which is B">
                  <Button variant="ghost" size="sm" onClick={onSwap}><ArrowUpDown size={16} strokeWidth={1.75} aria-hidden="true" />Swap A and B</Button>
                </Tooltip>
              </div>
            )}
            <div className={`asset-row ${i === 1 ? 'is-b' : ''}`}>
              <VideoThumb file={file} onDuration={d => onDuration?.(id, d)} />
              <div className="asset-info">
                <strong className={single ? 'num-key' : i === 1 ? 'num-b' : 'num-a'}>{labelFor(i)}</strong>
                <span className="asset-name">{file.name}</span>
                <span className="asset-meta">
                  {[seconds ? clock(seconds) : 'Reading length', mb(file.size)].filter(Boolean).join(' · ')}
                </span>
                {tooLong && <span className="asset-warn">Runs over 3 minutes, the longest Rewire analyses. Trim it first.</span>}
              </div>
              <Tooltip content="Remove">
                <Button variant="ghost" size="sm" className="icon-only" aria-label={`Remove ${file.name}`} onClick={() => onRemove(id)}>
                  <X size={16} strokeWidth={1.75} aria-hidden="true" />
                </Button>
              </Tooltip>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
