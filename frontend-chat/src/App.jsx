import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUp, Menu, Plus, X, Square, Check, Loader2, Clapperboard, UploadCloud, MessageCircle } from 'lucide-react';
import AudiencePicker from './AudiencePicker';
import * as api from './api';
import { buildInsights, routeQuestion, TOPICS } from './insights';
import { ANSWERS, Verdict } from './answers';
import Mascot from './Mascot';

const THEMES = [
  { key: 'soft', label: 'Soft' },
  { key: 'night', label: 'Night' },
  { key: 'bold', label: 'Bold' },
];
const MAX_FILES = 2;
const MAX_SECONDS = 180;
const ACCEPT = 'video/mp4,video/quicktime,video/webm,video/x-m4v,video/x-matroska,.mp4,.mov,.m4v,.webm,.mkv';

// How each step of an analysis reads in the chat, in the backend's order (pipeline.STAGES).
const STEPS = {
  received: 'Got it',
  checked: 'Checking the {videos}',
  predicting: 'Watching it, frame by frame',
  synthesis: 'Showing it to {viewers} viewers',
  scoring: 'Comparing their reactions',
};
// Backend errors can name infrastructure; only plainly worded ones about the video are shown as they are.
const internal = /brain|tribe|fmri|cortex|modal|gpu|cuda|traceback|exception|predict/i;

const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* not kept; fine */ } },
};
const uid = () => Math.random().toString(36).slice(2, 10);
const GREETING = { id: 'hello', role: 'bot', kind: 'hello' };

function videoLength(file) {
  return new Promise(resolve => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => { resolve(el.duration); URL.revokeObjectURL(el.src); };
    el.onerror = () => resolve(null);
    el.src = URL.createObjectURL(file);
  });
}

export default function App() {
  const [theme, setTheme] = useState(() => store.get('rewire-chat:theme', 'soft'));
  const [messages, setMessages] = useState([GREETING]);
  const [insights, setInsights] = useState(null);
  const [runId, setRunId] = useState(null);
  const [runs, setRuns] = useState([]);
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState([]);           // [{ file, url, seconds }]
  const [viewers, setViewers] = useState(() => store.get('rewire-chat:viewers', 200));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [menu, setMenu] = useState(false);
  const [offline, setOffline] = useState(false);
  const scroller = useRef(null);
  const picker = useRef(null);
  const textRef = useRef(null);
  const polling = useRef(null);
  const lastSent = useRef([]);           // the videos last sent, put back in the box if the analysis fails
  const [sentCount, setSentCount] = useState(1);
  const [uploadAgain, setUploadAgain] = useState(false);   // in a chat, the person asked for the upload box back

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    store.set('rewire-chat:theme', theme);
    // The phone's status bar and browser chrome take the page's background.
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.body).backgroundColor);
  }, [theme]);
  useEffect(() => {
    if (!menu) return;
    const close = e => { if (e.key === 'Escape') setMenu(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menu]);
  useEffect(() => { store.set('rewire-chat:viewers', viewers); }, [viewers]);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }); }, [messages]);
  useEffect(() => () => clearTimeout(polling.current), []);

  const refreshRuns = useCallback(() => api.fetchRuns().then(r => { setRuns(r.runs ?? []); setOffline(false); }).catch(() => setOffline(true)), []);
  useEffect(() => { refreshRuns(); }, [refreshRuns]);
  // How credits are counted (per seconds of video, and the bigger-audience surcharge), for the audience picker.
  const [credits, setCredits] = useState(null);
  useEffect(() => { api.fetchStatus().then(s => setCredits(s.credits ?? null)).catch(() => {}); }, []);

  const add = (...msgs) => setMessages(m => [...m, ...msgs]);
  const patch = (id, change) => setMessages(m => m.map(x => (x.id === id ? { ...x, ...change } : x)));

  /** Loads whatever analysis the API has open and answers with its verdict. */
  const showResults = async (id, replayTopics = []) => {
    const data = await api.fetchResults();
    const ins = buildInsights(data);
    setInsights(ins);
    setUploadAgain(false);
    setRunId(id ?? data.status.run?.id ?? null);
    setMessages(m => m.filter(x => x.kind !== 'typing'));
    add({ id: uid(), role: 'bot', kind: 'verdict', ins });
    return ins;
    replayTopics.forEach(topic => add(
      { id: uid(), role: 'user', text: TOPICS.find(t => t.key === topic)?.label },
      { id: uid(), role: 'bot', kind: 'answer', topic, ins },
    ));
  };

  const remember = topic => {
    if (!runId) return;
    const key = `rewire-chat:topics:${runId}`;
    store.set(key, [...store.get(key, []).filter(t => t !== topic), topic]);
  };

  const ask = (topic, label) => {
    add({ id: uid(), role: 'user', text: label ?? TOPICS.find(t => t.key === topic)?.label });
    if (topic !== 'how' && !insights) {
      add({ id: uid(), role: 'bot', kind: 'text', text: 'Send me a video first, and I’ll tell you that and more.' });
      return;
    }
    add({ id: uid(), role: 'bot', kind: 'answer', topic, ins: insights });
    remember(topic);
  };

  const poll = (msgId, jobId) => {
    api.fetchJob(jobId).then(async job => {
      patch(msgId, { job, fetchedAt: Date.now() });
      if (job.status === 'running') { polling.current = setTimeout(() => poll(msgId, jobId), 1500); return; }
      setBusy(false);
      if (job.status === 'done') {
        try {
          await showResults(jobId);
        } catch (e) { add({ id: uid(), role: 'bot', kind: 'text', text: `The analysis finished, but I couldn’t open it: ${e.message}` }); }
        refreshRuns();
      } else if (job.status === 'cancelled') {
        setFiles(lastSent.current);
        add({ id: uid(), role: 'bot', kind: 'text', text: 'Stopped. Send it again whenever you like.' });
      } else {
        const why = job.error && !internal.test(job.error) ? job.error : 'Something went wrong on my side.';
        setFiles(lastSent.current);
        add({ id: uid(), role: 'bot', kind: 'text', text: `I couldn’t finish that one. ${why} Try sending it again.` });
      }
    }).catch(() => { polling.current = setTimeout(() => poll(msgId, jobId), 3000); });
  };

  /** A typed question about the open analysis. */
  const send = () => {
    const text = draft.trim();
    if (busy || !text) return;
    setDraft('');
    const topic = routeQuestion(text);
    if (topic) { ask(topic, text); return; }
    add({ id: uid(), role: 'user', text }, { id: uid(), role: 'bot', kind: 'menu', text: 'I can tell you about any of these:' });
  };

  /** Sends the videos in the upload box for analysis. */
  const analyse = async () => {
    if (busy || !files.length) return;
    setNotice(null);
    if (files.some(f => f.seconds > MAX_SECONDS)) { setNotice('Videos can be up to 3 minutes long.'); return; }
    const sent = files;
    lastSent.current = sent;
    setFiles([]); setBusy(true); setSentCount(sent.length);
    add({ id: uid(), role: 'user', text: sent.length === 2 ? 'Which one works better?' : '', videos: sent.map(f => ({ name: f.file.name, url: f.url })) });
    const msgId = uid();
    add({ id: msgId, role: 'bot', kind: 'progress', viewers, count: sent.length });
    try {
      const { job_id } = await api.createJob(sent.map(f => f.file), viewers);
      patch(msgId, { jobId: job_id });
      poll(msgId, job_id);
    } catch (e) {
      setBusy(false);
      setFiles(sent);
      patch(msgId, { kind: 'text', text: e.status === 402 ? e.message : `I couldn’t start that one. ${internal.test(e.message) ? '' : e.message}` });
    }
  };

  const attach = async list => {
    const picked = [...list].filter(f => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name));
    if (!picked.length) return;
    const room = MAX_FILES - files.length;
    if (picked.length > room) setNotice('Up to two videos: one to analyse, two to compare.');
    const added = await Promise.all(picked.slice(0, Math.max(0, room)).map(async file => ({ file, url: URL.createObjectURL(file), seconds: await videoLength(file) })));
    setFiles(f => [...f, ...added]);
  };

  const unattach = i => setFiles(f => { URL.revokeObjectURL(f[i].url); return f.filter((_, j) => j !== i); });

  const newChat = () => {
    if (busy) return;
    clearTimeout(polling.current);
    setMessages([GREETING]); setInsights(null); setRunId(null); setMenu(false); setNotice(null); setUploadAgain(false);
  };

  const openPast = async run => {
    if (busy) return;
    setMenu(false);
    const msgId = uid();
    setMessages([{ id: msgId, role: 'user', text: run.title }]);
    setInsights(null);
    setBusy(true);
    add({ id: uid(), role: 'bot', kind: 'typing' });
    try {
      await api.openRun(run.id);
      const ins = await showResults(run.id, store.get(`rewire-chat:topics:${run.id}`, []));
      patch(msgId, { thumbs: Object.values(ins.media).map(x => api.mediaUrl(x.thumb)).filter(Boolean) });
    } catch (e) {
      setMessages(m => m.filter(x => x.kind !== 'typing'));
      add({ id: uid(), role: 'bot', kind: 'text', text: `I couldn’t open that one: ${e.message}` });
    }
    setBusy(false);
  };

  const sample = async () => {
    if (busy) return;
    add({ id: uid(), role: 'user', text: 'Show me the sample' }, { id: uid(), role: 'bot', kind: 'typing' });
    setBusy(true);
    try { await api.loadSample(); await showResults('sample'); } catch (e) { setMessages(m => m.filter(x => x.kind !== 'typing')); add({ id: uid(), role: 'bot', kind: 'text', text: `The sample isn’t available: ${e.message}` }); }
    setBusy(false);
  };

  const cancel = jobId => api.cancelJob(jobId).catch(() => {});

  // The box at the bottom: an upload box until there's a result to talk about, then a chat box.
  const mode = !insights || uploadAgain ? 'upload' : 'chat';
  // With a keyboard and mouse, the chat box takes focus as it appears; on touch that would pop the keyboard up.
  useEffect(() => {
    if (mode === 'chat' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) setTimeout(() => textRef.current?.focus(), 380);
  }, [mode]);
  const mood = busy ? 'thinking' : insights ? 'happy' : 'idle';

  return (
    <div className="app" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) { attach(e.dataTransfer.files); setUploadAgain(true); } }}>
      <aside className="side" data-open={menu || undefined}>
        <div className="side-head">
          <span className="brand"><Mascot mood={mood} size={26} />rewire</span>
          <button className="icon-btn drawer-only" onClick={() => setMenu(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <button className="new-chat" onClick={newChat} disabled={busy}><Plus size={16} />New chat</button>
        <p className="side-label">Recent</p>
        <nav className="side-list">
          {offline && <p className="side-empty">Can’t reach Rewire. Is the backend running?</p>}
          {!offline && !runs.length && <p className="side-empty">Your chats will show up here.</p>}
          {runs.map(r => (
            <button key={r.id} className="side-item" data-current={r.id === runId || undefined} onClick={() => openPast(r)} disabled={busy}>
              <span className="side-title">{r.title}</span>
              <span className="side-meta">{r.mode === 'compare' ? 'Comparison' : 'One video'} · {new Date(r.created * 1000).toLocaleDateString('en', { day: 'numeric', month: 'short' })}</span>
            </button>
          ))}
        </nav>
        <div className="theme-pick" role="radiogroup" aria-label="Design">
          {THEMES.map(t => (
            <button key={t.key} role="radio" aria-checked={theme === t.key} onClick={() => setTheme(t.key)}>{t.label}</button>
          ))}
        </div>
      </aside>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}

      <main className="chat">
        <header className="chat-head">
          <button className="icon-btn drawer-only" onClick={() => setMenu(true)} aria-label="Open menu"><Menu size={20} /></button>
          <span className="chat-title">{insights?.title || 'New chat'}</span>
          <button className="icon-btn drawer-only" onClick={newChat} aria-label="New chat" disabled={busy}><Plus size={20} /></button>
        </header>

        <div className="thread" ref={scroller}>
          <div className="thread-inner">
            {messages.map((m, i) => (
              <Message key={m.id} m={m} last={i === messages.length - 1} busy={busy} mood={mood}
                onAsk={ask} onSample={sample} onCancel={cancel} />
            ))}
          </div>
        </div>

        <div className="composer-wrap">
          {notice && <p className="notice" role="status">{notice}<button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={14} /></button></p>}
          <Crossfade active={mode}>
            <UploadBox
              key="upload"
              files={files} busy={busy} sentCount={sentCount} viewers={viewers} setViewers={setViewers} credits={credits}
              onPick={() => picker.current?.click()} onDropFiles={list => attach(list)} onRemove={unattach}
              onAnalyse={analyse} onBack={insights ? () => setUploadAgain(false) : null}
            />
            <form key="chat" className="composer" onSubmit={e => { e.preventDefault(); send(); }}>
              <textarea
                ref={textRef}
                rows={1}
                value={draft}
                placeholder="Ask about this result"
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                aria-label="Ask about this result"
              />
              <div className="composer-row">
                <button type="button" className="new-video" onClick={() => setUploadAgain(true)} disabled={busy}>
                  <Clapperboard size={16} aria-hidden="true" />New video
                </button>
                <button type="submit" className="send" disabled={busy || !draft.trim()} aria-label="Send"><ArrowUp size={18} /></button>
              </div>
            </form>
          </Crossfade>
          <input ref={picker} type="file" accept={ACCEPT} multiple hidden onChange={e => { attach(e.target.files); e.target.value = ''; }} />
        </div>
      </main>
    </div>
  );
}

function Chips({ onAsk, mode }) {
  return (
    <div className="chips">
      {TOPICS.filter(t => t.key !== 'how' || mode === 'any').map(t => <button key={t.key} className="chip" onClick={() => onAsk(t.key)}>{t.label}</button>)}
    </div>
  );
}

function Message({ m, last, busy, mood, onAsk, onSample, onCancel }) {
  if (m.role === 'user') {
    return (
      <div className="msg msg-user">
        {m.videos?.length > 0 && (
          <div className="msg-videos">
            {m.videos.map((v, i) => (
              <figure key={v.url}>
                <video src={`${v.url}#t=0.5`} muted preload="metadata" playsInline controls={false} onClick={e => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())} />
                {m.videos.length === 2 && <span className="attachment-tag">{i === 0 ? 'A' : 'B'}</span>}
              </figure>
            ))}
          </div>
        )}
        {m.thumbs?.length > 0 && (
          <div className="msg-videos">
            {m.thumbs.map((src, i) => (
              <figure key={src}><img src={src} alt="" />{m.thumbs.length === 2 && <span className="attachment-tag">{i === 0 ? 'A' : 'B'}</span>}</figure>
            ))}
          </div>
        )}
        {m.text && <p className="bubble">{m.text}</p>}
      </div>
    );
  }
  return (
    <div className="msg msg-bot">
      <span className="avatar"><Mascot mood={last ? mood : 'idle'} size={30} /></span>
      <div className="msg-body">
        {m.kind === 'hello' && (
          <div className="answer hello">
            <span className="hello-mascot"><Mascot mood={last ? mood : 'idle'} size={64} /></span>
            <h2 className="verdict-head">Hi! Show me a video.</h2>
            <p>I’ll tell you how people are likely to react to it, moment by moment: whether the opening grabs them, where they drift and what to change. Send two and I’ll tell you which one wins.</p>
            {last && !busy && (
              <div className="chips">
                <button className="chip chip-strong" onClick={onSample}>Try a sample comparison</button>
                <button className="chip" onClick={() => onAsk('how')}>How does this work?</button>
              </div>
            )}
          </div>
        )}
        {m.kind === 'typing' && <div className="typing" aria-label="Thinking"><span /><span /><span /></div>}
        {m.kind === 'text' && <div className="answer"><p>{m.text}</p></div>}
        {m.kind === 'menu' && <div className="answer"><p>{m.text}</p><Chips onAsk={onAsk} mode="any" /></div>}
        {m.kind === 'progress' && <Progress m={m} onCancel={onCancel} />}
        {m.kind === 'verdict' && (
          <>
            <Verdict ins={m.ins} />
            {last && <Chips onAsk={onAsk} />}
          </>
        )}
        {m.kind === 'answer' && (() => {
          const Answer = ANSWERS[m.topic];
          return (
            <>
              <Answer ins={m.ins} />
              {last && m.ins && <Chips onAsk={onAsk} />}
            </>
          );
        })()}
      </div>
    </div>
  );
}

function Progress({ m, onCancel }) {
  const job = m.job;
  const [now, setNow] = useState(() => Date.now());
  const running = !job || job.status === 'running';
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  const stages = (job?.stages ?? []).filter(s => STEPS[s.key]);
  const done = stages.filter(s => s.state === 'done').length;
  // Server clock for the start, plus the time since the last poll while it runs.
  const elapsed = job ? Math.max(0, Math.round((job.finished ?? job.now) - job.created + (running && m.fetchedAt ? (now - m.fetchedAt) / 1000 : 0))) : 0;
  const label = key => STEPS[key].replace('{viewers}', (job?.viewers ?? m.viewers).toLocaleString('en')).replace('{videos}', m.count === 2 ? 'videos' : 'video');
  return (
    <div className="answer progress">
      <p className="progress-head">
        {!job ? `Uploading ${m.count === 2 ? 'your videos' : 'your video'}…` : job.status === 'done' ? 'Done.' : job.status === 'running' ? 'On it.' : job.status === 'cancelled' ? 'Stopped.' : 'That didn’t work.'}
        {job && <span className="progress-time">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>}
      </p>
      <div className="progress-bar"><span style={{ width: `${stages.length ? (done / stages.length) * 100 : 4}%` }} /></div>
      {stages.length > 0 && (
        <ol className="steps">
          {stages.map(s => (
            <li key={s.key} data-state={s.state}>
              <span className="step-icon" aria-hidden="true">
                {s.state === 'done' ? <Check size={13} /> : s.state === 'running' && running ? <Loader2 size={13} className="spin" /> : null}
              </span>
              {label(s.key)}
            </li>
          ))}
        </ol>
      )}
      {job?.status === 'running' && <button className="chip" onClick={() => onCancel(job.id)}><Square size={11} />Stop</button>}
    </div>
  );
}

/**
 * Two layers in one spot, crossfading: the active one fades and settles in while the other fades out, and the box
 * eases its height from one to the other. The hidden layer is inert, so it can't be tabbed to or clicked.
 */
function Crossfade({ active, children }) {
  const refs = useRef({});
  const [height, setHeight] = useState(null);
  useLayoutEffect(() => {
    const el = refs.current[active];
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [active]);
  return (
    <div className="stage" style={height == null ? undefined : { height }}>
      {React.Children.map(children, child => {
        const on = child.key?.replace(/^\.\$/, '') === active || child.key === active;
        const key = child.key?.replace(/^\.\$/, '');
        return (
          <div className="stage-layer" data-active={on || undefined} inert={!on} ref={el => { refs.current[key] = el; }}>
            {child}
          </div>
        );
      })}
    </div>
  );
}

const fmtLen = s => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;

/** Where every analysis starts: drop or choose one video (or two to compare), pick the audience, analyse. */
function UploadBox({ files, busy, sentCount, viewers, setViewers, credits, onPick, onDropFiles, onRemove, onAnalyse, onBack }) {
  const [drag, setDrag] = useState(false);
  const depth = useRef(0);
  const lengths = files.length && files.every(f => f.seconds > 0) ? files.map(f => f.seconds) : [];
  const dragProps = {
    onDragEnter: e => { e.preventDefault(); depth.current += 1; setDrag(true); },
    onDragOver: e => e.preventDefault(),
    onDragLeave: () => { depth.current -= 1; if (depth.current <= 0) { depth.current = 0; setDrag(false); } },
    onDrop: e => { e.preventDefault(); e.stopPropagation(); depth.current = 0; setDrag(false); if (!busy) onDropFiles(e.dataTransfer.files); },
  };
  return (
    <div className="upload-box" data-drag={drag || undefined} data-busy={busy || undefined} {...dragProps}>
      {busy ? (
        <div className="upload-busy" role="status">
          <span className="upload-icon"><Loader2 size={20} className="spin" aria-hidden="true" /></span>
          <span className="upload-text">
            <span className="upload-title">Analysing {sentCount === 2 ? 'your videos' : 'your video'}…</span>
            <span className="upload-sub">When it’s done, this turns into a chat about the results.</span>
          </span>
        </div>
      ) : files.length === 0 ? (
        <button type="button" className="upload-zone" onClick={onPick}>
          <span className="upload-icon"><UploadCloud size={22} aria-hidden="true" /></span>
          <span className="upload-text">
            <span className="upload-title">{drag ? 'Drop it here' : 'Drop a video, or choose one'}</span>
            <span className="upload-sub">Add two to compare · MP4, MOV or WebM · up to 3 minutes</span>
          </span>
        </button>
      ) : (
        <div className="upload-files">
          {files.map((f, i) => (
            <div key={f.url} className="upload-file">
              <video src={`${f.url}#t=0.5`} muted preload="metadata" playsInline />
              {files.length === 2 && <span className="upload-tag" data-v={i === 0 ? 'A' : 'B'}>{i === 0 ? 'A' : 'B'}</span>}
              <span className="upload-file-text">
                <span className="upload-file-name">{f.file.name.replace(/\.[^.]+$/, '')}</span>
                <span className="upload-file-meta" data-long={f.seconds > MAX_SECONDS || undefined}>
                  {f.seconds > 0 ? fmtLen(f.seconds) : '…'}{f.seconds > MAX_SECONDS ? ' · over 3 minutes' : ''}
                </span>
              </span>
              <button type="button" className="icon-btn" onClick={() => onRemove(i)} aria-label={`Remove ${f.file.name}`}><X size={16} /></button>
            </div>
          ))}
          {files.length === 1 && (
            <button type="button" className="upload-add" onClick={onPick}><Plus size={15} aria-hidden="true" />Add a second video to compare</button>
          )}
        </div>
      )}
      <div className="upload-row">
        <AudiencePicker value={viewers} onChange={setViewers} disabled={busy} credits={credits} lengths={lengths} />
        {onBack && !busy && (
          <button type="button" className="upload-back" onClick={onBack} aria-label="Back to chat">
            <MessageCircle size={18} aria-hidden="true" /><span className="upload-back-text">Back to chat</span>
          </button>
        )}
        <button type="button" className="analyse" onClick={onAnalyse} disabled={busy || !files.length}>
          {files.length === 2 ? 'Compare' : 'Analyse'}<ArrowUp size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
