import React from 'react';

/**
 * The little markdown the assistant writes: paragraphs, bulleted and numbered lists, and **bold**. Built as React
 * elements, never as HTML, so nothing in a reply can inject markup. Anything else shows as plain text.
 */
function inline(text, key) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') && p.length > 4
    ? <strong key={`${key}-${i}`}>{p.slice(2, -2)}</strong>
    : p.replace(/`([^`]+)`/g, '$1')));
}

export default function Markdown({ text }) {
  const blocks = [];
  let list = null;
  const flush = () => { if (list) { blocks.push(list); list = null; } };
  text.replace(/\r/g, '').split('\n').forEach(raw => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const number = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (bullet || number) {
      const type = bullet ? 'ul' : 'ol';
      if (!list || list.type !== type) { flush(); list = { type, items: [] }; }
      list.items.push(bullet ? bullet[1] : number[2]);
      return;
    }
    if (!line.trim()) { flush(); blocks.push(null); return; }
    const heading = line.replace(/^#{1,6}\s+/, '');
    flush();
    const last = blocks[blocks.length - 1];
    if (last && last.type === 'p') last.lines.push(heading);
    else blocks.push({ type: 'p', lines: [heading] });
  });
  flush();
  return (
    <div className="md">
      {blocks.filter(Boolean).map((b, i) => {
        if (b.type === 'p') return <p key={i}>{b.lines.map((l, j) => <React.Fragment key={j}>{j > 0 && <br />}{inline(l, `${i}-${j}`)}</React.Fragment>)}</p>;
        const List = b.type;
        return <List key={i}>{b.items.map((it, j) => <li key={j}>{inline(it, `${i}-${j}`)}</li>)}</List>;
      })}
    </div>
  );
}
