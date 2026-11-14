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
import re
import sys

LAG_S = 2                       # the response trails the picture by about this much; matches the chat frontend
MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
MAX_HISTORY = 6                 # messages kept from the conversation (three exchanges); older ones are dropped
MAX_QUESTION = 2000             # characters in one question
MAX_PAST_ANSWER = 1500          # characters kept from each earlier answer
MAX_ANSWER_TOKENS = 1200        # room reserved for the answer
# Groq's free tier allows 8,000 tokens a minute per model, and one request may not ask for more than that: the
# instructions, the data, the conversation and the room reserved for the answer together. The data gets what's left.
TOKEN_LIMIT = int(os.environ.get("GROQ_TOKEN_LIMIT", "8000"))
SAFETY_TOKENS = 400             # slack for message framing and estimation error
# Tokens counted the way tokenizers split text: a short word, up to three digits, or one symbol each. On this data it
# comes out 8-36% above the real tokenizer's count; Groq counts a little above that, so a tenth is added on top.
TOKEN_PIECES = re.compile(r"[A-Za-z]{1,8}|\d{1,3}|[^\sA-Za-z\d]")
TOKEN_MARGIN = 1.1

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
response every second, per audience (or, for long videos, averaged over audiences, with audience_response_by_second \
giving each audience's overall response).
- seconds_per_value: when present, per-second series are averaged into buckets of that many seconds (value i covers \
seconds i*n to i*n+n). Name moments by their bucket's start.
- audiences: each age group's overall response, the second they peak, and which group responds best.
- transcript_sentences: "start-end s text", times in seconds. transcript_words: [start second, word]. scene_changes: seconds where the picture cuts.
- comparison (two videos only): the overall winner, how much stronger in percent, how many audiences each wins, and \
per audience and driver which video (A or B, by the videos' "video" field) leads. Read the scores themselves from \
each video's drivers_by_audience."""


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
            sentences.append(f"{_r(t.get('start'), 1)}-{_r(t.get('stop'), 1)}s {text}")
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
            # Only who leads: the scores themselves are in each video's drivers_by_audience and audiences.
            "leader_by_audience_and_driver": {
                AUDIENCES.get(aud, aud): {
                    DRIVERS.get(d, "Overall"): {"A": "A", "B": "B"}.get(contest_winner(a[aud].get(d, 0), b[aud].get(d, 0)), "tie")
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
        role = m.get("role")
        text = str(m.get("content") or "").strip()[:MAX_QUESTION if role == "user" else MAX_PAST_ANSWER]
        if role in ("user", "assistant") and text:
            turns.append({"role": role, "content": text})
    while turns and turns[0]["role"] != "user":
        turns.pop(0)
    return turns


def _json(context: dict) -> str:
    return json.dumps(context, separators=(",", ":"), ensure_ascii=False)


def _estimate(text: str) -> int:
    return int(len(TOKEN_PIECES.findall(text)) * TOKEN_MARGIN) + 1


def _tokens(context: dict) -> int:
    return _estimate(_json(context))


def data_budget(turns: list) -> int:
    """Tokens left for the analysis data once the instructions, the conversation and the answer are counted."""
    used = _estimate(SYSTEM) + sum(_estimate(t["content"]) + 8 for t in turns)
    return max(600, TOKEN_LIMIT - MAX_ANSWER_TOKENS - SAFETY_TOKENS - used)


def _round_series(v, n):
    return [round(x, n) if isinstance(x, (int, float)) else x for x in v]


def _bucket(values, k):
    out = []
    for i in range(0, len(values), k):
        part = [x for x in values[i:i + k] if isinstance(x, (int, float))]
        out.append(round(sum(part) / len(part), 3) if part else None)
    return out


def fit(context: dict, budget: int = None) -> dict:
    """The data, shrunk only as far as needed to fit `budget` tokens. In order: drop the word-by-word transcript
    (sentences stay), round the per-second values, average the per-second drivers over audiences (keeping each
    audience's overall curve), then average seconds into ever larger buckets. Nothing is dropped outright until
    all of that fails."""
    import copy

    budget = budget or data_budget([])
    if _tokens(context) <= budget:
        return context
    c = copy.deepcopy(context)
    for v in c["videos"]:
        v.pop("transcript_words", None)
    if _tokens(c) <= budget:
        return c
    for v in c["videos"]:
        v["attention"] = _round_series(v["attention"], 3)
        v["drivers_by_second"] = {a: {d: _round_series(s, 2) for d, s in ds.items()} for a, ds in v["drivers_by_second"].items()}
    if _tokens(c) <= budget:
        return c
    for v in c["videos"]:
        per_aud = v["drivers_by_second"]
        drivers = sorted({d for ds in per_aud.values() for d in ds})
        n = max((len(s) for ds in per_aud.values() for s in ds.values()), default=0)
        def mean_at(series_list, t):
            vals = [s[t] for s in series_list if t < len(s) and isinstance(s[t], (int, float))]
            return round(sum(vals) / len(vals), 2) if vals else None
        v["drivers_by_second"] = {d: [mean_at([ds[d] for ds in per_aud.values() if d in ds], t) for t in range(n)] for d in drivers}
        v["audience_response_by_second"] = {a: [mean_at(list(ds.values()), t) for t in range(n)] for a, ds in per_aud.items()}
    if _tokens(c) <= budget:
        return c
    base = c
    for k in (2, 3, 4, 5, 6, 8, 10, 15, 20, 30):
        b = copy.deepcopy(base)
        for v in b["videos"]:
            if k >= 4:   # long videos: keep the first 40 lines of speech rather than coarsen the curves further
                v["transcript_sentences"] = v.get("transcript_sentences", [])[:40]
            v["seconds_per_value"] = k
            v["attention"] = _bucket(v["attention"], k)
            v["drivers_by_second"] = {d: _bucket(s, k) for d, s in v["drivers_by_second"].items()}
            v["audience_response_by_second"] = {a: _bucket(s, k) for a, s in v["audience_response_by_second"].items()}
        if _tokens(b) <= budget:
            return b
    for v in b["videos"]:     # last resort, for very long videos: the drivers' curves go, their totals stay
        v.pop("drivers_by_second", None)
        v["transcript_sentences"] = v.get("transcript_sentences", [])[:40]
    return b


def _data_text(context: dict, budget: int) -> str:
    return "ANALYSIS DATA (JSON):\n" + _json(fit(context, budget))


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
    budget = data_budget(turns)

    def ask(budget):
        return client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "system", "content": f"{SYSTEM}\n\n{_data_text(context, budget)}"}, *turns],
            stream=True,
            max_completion_tokens=MAX_ANSWER_TOKENS,
            temperature=0.3,                    # numbers read off the data, not invention
            **_reasoning_options(),
        )

    try:
        stream = ask(budget)
    except Exception as e:   # still too large by Groq's count: once more with half the data
        if getattr(e, "status_code", None) != 413:
            raise
        stream = ask(max(600, budget // 2))
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
