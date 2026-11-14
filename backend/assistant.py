"""
The chat assistant: open-ended questions about the open analysis, answered by Claude with every number the backend
produced for it.

The data is handed over in creator words only. Internal names (cortical regions, hemispheres, vertices, the model
that predicts the response) never reach the model, and the instructions tell it to speak of a simulated audience,
attention and drivers, as the rest of the product does. Per-second series are re-indexed to video time (the response
lags the picture by about two seconds; the app labels moments the same way), so the seconds it names match the
player and the timeline.

Needs ANTHROPIC_API_KEY in the environment or backend/.env. With GEMINI_API_KEY as well, Gemini answers whenever
Claude can't (an exhausted credit balance, a bad key, rate limits, an outage): same instructions, same data, same
conversation. Either key alone is enough to turn the assistant on.
"""
import json
import os
import sys

LAG_S = 2                       # the response trails the picture by about this much; matches the chat frontend
MODEL = os.environ.get("REWIRE_CHAT_MODEL", "claude-opus-5-5")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
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


def _claude_key() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))


def _gemini_key() -> str:
    return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or ""


def configured() -> bool:
    """Whether either model has a key, so the assistant can answer."""
    return _claude_key() or bool(_gemini_key())


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


def _claude_stream(context: dict, turns: list):
    import anthropic

    client = anthropic.Anthropic()
    system = [
        {"type": "text", "text": SYSTEM},
        # The data, frozen for this analysis and cached, so follow-up questions don't pay for it again.
        {"type": "text", "text": _data_text(context), "cache_control": {"type": "ephemeral"}},
    ]
    with client.beta.messages.stream(
        model=MODEL,
        max_tokens=16000,
        system=system,
        messages=turns,
        output_config={"effort": "medium"},
        # If the model declines on a policy ground, the API retries on a fallback model inside the same request.
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    ) as stream:
        for text in stream.text_stream:
            yield text
        final = stream.get_final_message()
    if final.stop_reason == "refusal":
        yield "\n\nI can't help with that one. Ask me about this analysis instead."
    elif final.stop_reason == "max_tokens":
        yield "…"


def _gemini_stream(context: dict, turns: list):
    from google import genai

    client = genai.Client(api_key=_gemini_key())
    contents = [{"role": "user" if t["role"] == "user" else "model", "parts": [{"text": t["content"]}]} for t in turns]
    for chunk in client.models.generate_content_stream(
        model=GEMINI_MODEL,
        contents=contents,
        config={"system_instruction": f"{SYSTEM}\n\n{_data_text(context)}", "max_output_tokens": 8192},
    ):
        if chunk.text:
            yield chunk.text


def stream_answer(context: dict, messages: list):
    """Yields the answer's text as it arrives, from Claude, or from Gemini when Claude can't answer and a Gemini key is
    set. Raises ValueError for an empty conversation."""
    turns = _history(messages)
    if not turns or turns[-1]["role"] != "user":
        raise ValueError("Ask a question first.")
    if _claude_key():
        sent = False
        try:
            for text in _claude_stream(context, turns):
                sent = True
                yield text
            return
        except Exception as e:
            # Fall back only before anything reached the reader; a half answer from one model and the rest from
            # another would read as one confused reply.
            if sent or not _gemini_key():
                raise
            print(f"chat: Claude failed ({type(e).__name__}: {str(e)[:200]}); answering with Gemini", file=sys.stderr)
    yield from _gemini_stream(context, turns)
