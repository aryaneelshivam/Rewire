"""
The chat assistant: open-ended questions about the open analysis, answered by a model on Groq with every number the
backend produced for it.

The data is handed over in creator words only. Internal names (cortical regions, hemispheres, vertices, the model
that predicts the response) never reach the model, and the instructions tell it to speak of a simulated audience,
attention and drivers, as the rest of the product does. Per-second series are re-indexed to video time (the response
lags the picture by about two seconds; the app labels moments the same way), so the seconds it names match the
player and the timeline.

Needs GROQ_API_KEY in the environment or backend/.env. The model is GROQ_MODEL (default openai/gpt-oss-120b).
"""
import json
import os
import sys

LAG_S = 2                       # the response trails the picture by about this much; matches the chat frontend
MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
MAX_HISTORY = 24                # turns kept from the conversation; older ones are dropped
MAX_QUESTION = 2000             # characters in one message

DRIVERS = {   # the backend's dimension names, in the words the app uses
    "visual": "Visuals", "auditory": "Sound", "reward": "Payoff", "memory": "Memorability", "attention": "Focus",
    "narrative": "Story", "personal": "Relatability", "action": "Urge to act",
}
SERIES = {    # the per-second groups, likewise
    "reward": "Payoff", "auditory": "Sound", "prefrontal": "Focus", "memory": "Memorability",
    "narrative": "Story", "personal": "Relatability", "action": "Urge to act",
}
AUDIENCES = {"kids": "Kids (6-12)", "genz": "Gen Z (13-24)", "adults": "Adults (25-54)", "older": "55+"}

SYSTEM = """You are Rewire's assistant, inside the chat beside a finished analysis. Rewire shows a video (or two, to \
compare) to a simulated audience in four age groups and measures, second by second, how strongly they respond and \
what drives it. People use it to make ads, reels and short films land better.

You have every number Rewire produced for this analysis, in the ANALYSIS DATA below. Answer from it:
- Ground every claim in the data. Name the seconds (as m:ss), the audiences and the drivers involved, and quote the \
numbers that matter. If the data can't answer something, say so plainly; never invent figures.
- Numbers are relative, not absolute: compare a moment with the rest of the video, one audience with another, or \
video A with video B. There is no benchmark of other ads yet, so don't call a score good or bad in general.
- Be concrete and useful to a creator: what's working, where attention sags and why, which audience it suits, and \
specific edits to try (cut, move, tighten, re-voice, add a visual change), tied to the moments in the video.
- Speak the product's language: a simulated audience, attention, response, drivers (Visuals, Sound, Payoff, \
Memorability, Focus, Story, Relatability, Urge to act) and audiences (Kids, Gen Z, Adults, 55+). Never mention \
brains, neurons, cortex, fMRI, neural or predictive models, model names or how Rewire works inside. If asked how it \
works, say it shows the video to a simulated audience and measures how they respond second by second.
- Keep answers tight: a short direct answer first, then the evidence. Use short paragraphs and simple lists; \
**bold** sparingly. No tables, no headings, no code.
- Stay on this analysis and on making the video better. Politely decline anything unrelated.

How to read the data:
- Every per-second series is indexed by video second (index 0 = 0:00). The audience's response trails the picture \
by about two seconds; the series are already shifted so each value lines up with what was on screen.
- attention: the overall response each second. Higher is stronger; compare values within the analysis.
- measures: hook (response to roughly the first five seconds), depth (average response after the opening build-up), \
peak (strongest three-second stretch), hold (share of seconds that stay at or above a typical level, 0 to 1).
- drivers: how much each driver contributes overall (per audience and averaged). drivers_by_second: each driver's \
response every second, per audience.
- audiences: each age group's overall response, the second they peak, and which group responds best.
- transcript: the words spoken, with start times in seconds. scene_changes: seconds where the picture cuts.
- comparison (two videos only): the overall winner, how much stronger in percent, how many audiences each wins, and \
per audience and driver which video leads."""


def _r(x, n=3):
    try:
        return round(float(x), n)
    except (TypeError, ValueError):
        return None


def _to_video_time(values):
    """A per-second response series re-indexed to video time (see LAG_S)."""
    vals = [_r(v) for v in values]
    return vals[LAG_S:] if len(vals) > LAG_S else vals


def _clock(s):
    s = max(0, int(round(s)))
    return f"{s // 60}:{s % 60:02d}"


def _video(key, c, name, rewire_score):
    score = c.setdefault("rewire_score", rewire_score(c["preds"]))
    measures = {k: _r(score["measures"][k]["value"]) for k in ("hook", "depth", "peak", "hold") if k in score.get("measures", {})}
    attention = _to_video_time(score.get("curve", []))
    peak_at = max(range(len(attention)), key=lambda i: attention[i] or 0) if attention else 0
    eng = c.get("engagement_scores", {})
    drivers_by_audience = {AUDIENCES.get(a, a): {DRIVERS[d]: _r(v) for d, v in s.items() if d in DRIVERS} for a, s in eng.items()}
    drivers_avg = {}
    for d, label in DRIVERS.items():
        vals = [s[d] for s in eng.values() if d in s]
        if vals:
            drivers_avg[label] = _r(sum(vals) / len(vals))
    audiences = {
        AUDIENCES.get(a, a): {
            "overall": _r(s.get("overall")),
            "peak_second": _clock(max(0, c.get("demo_peak_data", {}).get(a, {}).get("peak_timestep", 0) - LAG_S)),
        } for a, s in eng.items()
    }
    by_second = {
        AUDIENCES.get(a, a): {SERIES[g]: _to_video_time(vals) for g, vals in groups.items() if g in SERIES}
        for a, groups in c.get("demo_timeseries", {}).items()
    }
    words, sentences = [], []
    for t in c.get("transcript", []) or []:
        text = (t.get("text") or "").strip()
        if not text:
            continue
        if t.get("type") == "Word":
            words.append([_r(t.get("start"), 1), text])
        elif t.get("type") == "Sentence":
            sentences.append({"start": _r(t.get("start"), 1), "end": _r(t.get("stop"), 1), "text": text})
    profile = c.get("content_profile") or {}
    cuts = sorted({_clock(e["timestep"]) for e in profile.get("temporal_events", []) if e.get("type") == "scene_cut"})
    return {
        "video": key,
        "name": name or f"Video {key}",
        "length_seconds": c.get("n_timesteps"),
        "simulated_viewers": c.get("n_viewers"),
        "best_moment": _clock(peak_at),
        "measures": measures,
        "attention": attention,
        "drivers_overall": drivers_avg,
        "drivers_by_audience": drivers_by_audience,
        "audiences": audiences,
        "best_audience": AUDIENCES.get(c.get("best_demographic"), c.get("best_demographic")),
        "best_audience_is_clear": bool(c.get("best_demographic_clear", True)),
        "drivers_by_second": by_second,
        "transcript_sentences": sentences,
        "transcript_words": words,
        "scene_changes": cuts,
    }


def build_context(results: dict, info: dict, rewire_score, overall_verdict, contest_winner) -> dict:
    """Everything about the open analysis, in creator words, as one JSON-ready dict."""
    names = (info or {}).get("names") or {}
    stem = lambda n: os.path.splitext(n)[0] if n else None
    videos = [_video(k, c, stem(names.get(k)), rewire_score) for k, c in results.items()]
    data = {"title": (info or {}).get("title"), "mode": "compare" if len(results) > 1 else "single", "videos": videos}
    if len(results) > 1 and "A" in results and "B" in results:
        a, b = results["A"]["engagement_scores"], results["B"]["engagement_scores"]
        overall = overall_verdict(a, b)
        data["comparison"] = {
            "winner": {"A": videos[0]["name"], "B": videos[1]["name"]}.get(overall.get("winner"), "too close to call"),
            "lead_percent": _r(overall.get("lead_pct"), 1),
            "audiences_won": {videos[0]["name"]: overall.get("cohorts_led", {}).get("A"),
                              videos[1]["name"]: overall.get("cohorts_led", {}).get("B"),
                              "tied": overall.get("cohorts_led", {}).get("TIE")},
            "by_audience_and_driver": {
                AUDIENCES.get(aud, aud): {
                    DRIVERS.get(d, "Overall"): {"A": _r(a[aud].get(d)), "B": _r(b[aud].get(d)),
                                                "leader": {"A": "A", "B": "B"}.get(contest_winner(a[aud].get(d, 0), b[aud].get(d, 0)), "tie")}
                    for d in [*DRIVERS, "overall"]
                } for aud in a if aud in b
            },
        }
    return data


def _key() -> str:
    """The Groq key, trimmed: a key saved from an editor often ends in a newline, which no HTTP header may carry."""
    return (os.environ.get("GROQ_API_KEY") or "").strip()


def configured() -> bool:
    """Whether the assistant has a key to answer with."""
    return bool(_key())


def _history(messages):
    """The conversation as the API wants it: user/assistant turns, the newest MAX_HISTORY, starting with the user."""
    turns = []
    for m in messages[-MAX_HISTORY:]:
        role, text = m.get("role"), str(m.get("content") or "").strip()[:MAX_QUESTION]
        if role in ("user", "assistant") and text:
            turns.append({"role": role, "content": text})
    while turns and turns[0]["role"] != "user":
        turns.pop(0)
    return turns


def _data_text(context: dict) -> str:
    return "ANALYSIS DATA (JSON):\n" + json.dumps(context, separators=(",", ":"), ensure_ascii=False)


def _reasoning_options() -> dict:
    """For Groq's reasoning models only (GPT-OSS, Qwen): think briefly, and send the answer without the working."""
    if MODEL.startswith(("openai/gpt-oss", "qwen/")):
        return {"reasoning_effort": "low", "include_reasoning": False}
    return {}


def stream_answer(context: dict, messages: list):
    """Yields the answer's text as it arrives. Raises ValueError for an empty conversation."""
    from groq import Groq

    turns = _history(messages)
    if not turns or turns[-1]["role"] != "user":
        raise ValueError("Ask a question first.")
    client = Groq(api_key=_key(), timeout=120.0, max_retries=1)   # a firm limit, so a stuck call ends instead of holding the chat open
    stream = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "system", "content": f"{SYSTEM}\n\n{_data_text(context)}"}, *turns],
        stream=True,
        max_completion_tokens=4096,
        temperature=0.3,                    # numbers read off the data, not invention
        **_reasoning_options(),
    )
    finish = None
    for chunk in stream:
        if not chunk.choices:
            continue
        choice = chunk.choices[0]
        if choice.delta and choice.delta.content:
            yield choice.delta.content
        finish = choice.finish_reason or finish
    if finish == "length":
        yield "…"


HEARTBEAT = "\u200b"          # zero-width space: keeps the connection busy while a model thinks; the chat strips it


def with_heartbeat(chunks, every: float = 5.0):
    """Passes `chunks` through, sending HEARTBEAT whenever nothing has come for `every` seconds. A model can think for
    a while before its first word; some browsers and proxies drop a response that sends nothing, so the stream keeps
    talking until the answer starts."""
    import queue
    import threading

    q: "queue.Queue" = queue.Queue()
    done = object()

    def pump():
        try:
            for c in chunks:
                q.put(c)
        except BaseException as e:   # handed to the reader, which re-raises it in its own thread
            q.put(e)
        q.put(done)

    threading.Thread(target=pump, daemon=True).start()
    yield HEARTBEAT   # straight away, so the response starts before anything slow happens
    while True:
        try:
            item = q.get(timeout=every)
        except queue.Empty:
            yield HEARTBEAT
            continue
        if item is done:
            return
        if isinstance(item, BaseException):
            raise item
        yield item
