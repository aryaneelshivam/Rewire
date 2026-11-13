import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUp, Menu, Plus, X, Square, Check, Loader2, Clapperboard, UploadCloud, MessageCircle } from 'lucide-react';
import AudiencePicker from './AudiencePicker';
import * as api from './api';
import { buildInsights, routeQuestion, TOPICS } from './insights';
import { ANSWERS, Verdict } from './answers';
import Mascot from './Mascot';
import Peek from './Peek';
import { Compact } from './compact';
import ResultsView from './ResultsView';
import StartScreen from './StartScreen';

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
  // One look: Aura. The shared dashboard components get Arc's light theme and a matching accent.
  const theme = 'aura';
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
  // Wide screens (900px and up, as in the CSS) put the history and the conversation in sidebars.
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const update = () => setWide(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  const polling = useRef(null);
  const lastSent = useRef([]);           // the videos last sent, put back in the box if the analysis fails
  const [sentCount, setSentCount] = useState(1);
  const [uploadAgain, setUploadAgain] = useState(false);
  const [started, setStarted] = useState(false);       // past the 'what do you want to analyse?' screen
  const [results, setResults] = useState(null);        // what the player and timeline show
  const [chatOpen, setChatOpen] = useState(false);     // the conversation popover, over the results   // in a chat, the person asked for the upload box back

  useEffect(() => {
    // The chat's own look, plus the matching Arc theme and accent for the shared player and timeline.
    const root = document.documentElement;
    root.dataset.look = theme;
    root.dataset.theme = 'light';
    root.dataset.accent = 'orange';
    // The phone's status bar and browser chrome take the page's background.
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#b4ddd2');   // the gradient's top
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
    replayTopics.forEach(topic => add(
      { id: uid(), role: 'user', text: TOPICS.find(t => t.key === topic)?.label },
      { id: uid(), role: 'bot', kind: 'answer', topic, ins },
    ));
    // The player and timeline take the page; the conversation opens over them.
    setResults({ overview: data.overview, media: data.status.media, winner: ins.verdict.winner ?? 'A', key: id ?? data.status.run?.id ?? 'sample' });
    setChatOpen(true);
    return ins;
  };

  const remember = topic => {
    if (!runId) return;
    const key = `rewire-chat:topics:${runId}`;
    store.set(key, [...store.get(key, []).filter(t => t !== topic), topic]);
  };

  const ask = (topic, label) => {
    setChatOpen(true);
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
    setChatOpen(true);
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
    setFiles([]); setBusy(true); setSentCount(sent.length); setChatOpen(true);
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
    setMessages([GREETING]); setInsights(null); setRunId(null); if (!wide) setMenu(false); setNotice(null); setUploadAgain(false); setResults(null); setChatOpen(false); setStarted(false);
  };

  const openPast = async run => {
    if (busy) return;
    setStarted(true);
    if (!wide) setMenu(false);
    const msgId = uid();
    setMessages([{ id: msgId, role: 'user', text: run.title }]);
    setInsights(null); setResults(null);
    setBusy(true); setSentCount(0);
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
    setStarted(true);
    add({ id: uid(), role: 'user', text: 'Show me the sample' }, { id: uid(), role: 'bot', kind: 'typing' });
    setBusy(true); setSentCount(0);
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
  // Peek, in the greeting: leans in when a video is added, gets to work while it's analysed.
  const peekState = busy ? 'working' : files.length ? 'listening' : 'idle';

  const thread = (
    <div className="thread" ref={scroller}>
      <div className="thread-inner">
        {messages.map((m, i) => (
          <Message key={m.id} m={m} last={i === messages.length - 1} busy={busy} mood={mood} peekState={peekState}
            onAsk={ask} onSample={sample} onCancel={cancel} />
        ))}
      </div>
    </div>
  );

  const onStart = !started && !results && !busy;
  useEffect(() => {
    document.title = onStart ? 'Rewire · What do you want to analyse?' : insights?.title ? `${insights.title} · Rewire` : 'Rewire';
  }, [onStart, insights?.title]);

  // Desktop has room for the conversation beside the results; phones get it as a popover over them.
  const sideChat = wide && !!results;
  const composer = (
    <div className="composer-wrap">
      {results && !wide && (
        <ChatSheet open={chatOpen} onClose={() => setChatOpen(false)} mood={mood} busy={busy}>
          {thread}
        </ChatSheet>
      )}
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
            onFocus={() => setChatOpen(true)}
          />
          <div className="composer-row">
            <button type="button" className="new-video" onClick={() => setUploadAgain(true)} disabled={busy}>
              <Clapperboard size={16} aria-hidden="true" />New video
            </button>
            {results && !wide && (
              <button type="button" className="new-video" onClick={() => setChatOpen(o => !o)} aria-expanded={chatOpen}>
                <MessageCircle size={16} aria-hidden="true" />{chatOpen ? 'Hide chat' : 'Chat'}
              </button>
            )}
            <button type="submit" className="send" disabled={busy || !draft.trim()} aria-label="Send"><ArrowUp size={18} /></button>
          </div>
        </form>
      </Crossfade>
      <input ref={picker} type="file" accept={ACCEPT} multiple hidden onChange={e => { attach(e.target.files); e.target.value = ''; }} />
    </div>
  );

  return (
    <div className="app" data-results={!!results || undefined} data-history={menu || undefined} data-ai={(sideChat && chatOpen) || undefined}
      onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) { attach(e.dataTransfer.files); setUploadAgain(true); if (sideChat) setChatOpen(true); } }}>
      <aside className="side" data-open={menu || undefined} inert={!menu} aria-label="Your analyses">
        <div className="side-inner">
          <div className="side-head">
            <span className="brand"><Mascot mood={mood} size={26} />rewire</span>
            <button className="icon-btn" onClick={() => setMenu(false)} aria-label="Close sidebar"><X size={18} /></button>
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
        </div>
      </aside>
      {menu && !wide && <div className="scrim" onClick={() => setMenu(false)} />}

      <main className="chat" data-start={onStart || undefined}>
        {onStart ? (
          <StartScreen onVideo={() => setStarted(true)} onMenu={() => setMenu(o => !o)}
            onHelp={() => { setStarted(true); ask('how'); }} />
        ) : (<>
        <header className="chat-head">
          <button className="icon-btn" onClick={() => setMenu(o => !o)} aria-label={menu ? 'Close sidebar' : 'Open sidebar'} aria-expanded={menu}><Menu size={20} /></button>
          <span className="chat-title">{insights?.title || 'New chat'}</span>
          {sideChat && (
            <>
              {!chatOpen && (
                <button className="head-btn" onClick={() => { setUploadAgain(true); setChatOpen(true); }} disabled={busy}>
                  <Clapperboard size={16} aria-hidden="true" />New video
                </button>
              )}
              <button className="head-btn" data-on={chatOpen || undefined} onClick={() => setChatOpen(o => !o)} aria-expanded={chatOpen} aria-controls="ai-side">
                <MessageCircle size={16} aria-hidden="true" />Ask Rewire
              </button>
            </>
          )}
          {!sideChat && <button className="icon-btn" onClick={newChat} aria-label="New chat" disabled={busy}><Plus size={20} /></button>}
        </header>

        {results ? (
          <div className="results-scroll">
            <ResultsView key={results.key} overview={results.overview} media={results.media} winner={results.winner}
              runKey={results.key} ins={insights} onNewVideo={() => { setUploadAgain(true); setChatOpen(true); }} />
          </div>
        ) : thread}

        {!sideChat && composer}
        </>)}
      </main>

      {sideChat && (
        <aside id="ai-side" className="ai-side" data-open={chatOpen || undefined} inert={!chatOpen} aria-label="Chat about this result">
          <div className="ai-inner">
            <header className="ai-head">
              <Mascot mood={busy ? 'thinking' : mood} size={26} />
              <span className="sheet-title">Ask Rewire</span>
              <button type="button" className="icon-btn" onClick={() => setChatOpen(false)} aria-label="Hide chat"><X size={18} /></button>
            </header>
            <Compact.Provider value={true}>{thread}</Compact.Provider>
            {composer}
          </div>
        </aside>
      )}
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

function Message({ m, last, busy, mood, peekState, onAsk, onSample, onCancel }) {
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
            <Peek className="hello-mascot hello-peek" size={96} floor={0.4} state={last ? peekState : 'idle'} />
            <h2 className="verdict-head">Show me your video.</h2>
            <p>Drop it in the box below. I’ll show it to a simulated audience and tell you, moment by moment, whether the opening grabs them, where they drift and what to change. Add a second cut and I’ll tell you which one wins.</p>
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
    <div className="swap" style={height == null ? undefined : { height }}>
      {React.Children.map(children, child => {
        const on = child.key?.replace(/^\.\$/, '') === active || child.key === active;
        const key = child.key?.replace(/^\.\$/, '');
        return (
          <div className="swap-layer" data-active={on || undefined} inert={!on} ref={el => { refs.current[key] = el; }}>
            {child}
          </div>
        );
      })}
    </div>
  );
}

const fmtLen = s => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;

/** Where every analysis starts: drop or choose one video (or two to compare), pick the audience, analyse. */
// While it simulates, Peek splits into a small crowd, one per audience, each in its own tint.
const CROWD = [
  { key: 'kids', palette: { shell: '#e8b64a' } },
  { key: 'genz', palette: { shell: '#a08fe8' } },
  { key: 'adults', palette: { shell: '#e9946b' } },
  { key: 'older', palette: { shell: '#5fb99a' } },
];
function PeekCrowd() {
  return (
    <span className="peek-crowd" aria-hidden="true">
      {CROWD.map((c, i) => <Peek key={c.key} size={46} palette={c.palette} state="working" seed={i / 4} floor={0.35} interactive={false} intro={false} />)}
    </span>
  );
}

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
          {sentCount ? <PeekCrowd /> : <span className="upload-icon"><Loader2 size={20} className="spin" aria-hidden="true" /></span>}
          <span className="upload-text">
            <span className="upload-title">{sentCount ? `Showing ${sentCount === 2 ? 'your videos' : 'your video'} to ${viewers.toLocaleString('en')} viewers…` : 'Opening the analysis…'}</span>
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

/**
 * The conversation over a finished analysis: a popover anchored above the chat box, with a scrim over the player
 * and timeline. It opens when the results arrive and whenever the person asks something; the scrim, Escape or the
 * close button put it away, and the chat box brings it back.
 */
function ChatSheet({ open, onClose, mood, busy, children }) {
  useEffect(() => {
    if (!open) return;
    const close = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open, onClose]);
  return (
    <>
      <div className="sheet-scrim" data-open={open || undefined} onClick={onClose} aria-hidden="true" />
      <section className="sheet" data-open={open || undefined} role="dialog" aria-modal="false" aria-label="Chat about this result" inert={!open}>
        <header className="sheet-head">
          <Mascot mood={busy ? 'thinking' : mood} size={26} />
          <span className="sheet-title">Ask Rewire</span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Hide chat"><X size={18} /></button>
        </header>
        {children}
      </section>
    </>
  );
}
