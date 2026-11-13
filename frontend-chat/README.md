# Rewire chat (experiment)

A second, conversational frontend for Rewire, for trying a simpler, consumer-style presentation. It talks to the
same API as `frontend/` and changes nothing there or in the backend.

Send one video (or two to compare) and Rewire answers with a plain-language verdict, a small attention chart and
follow-up questions: the opening, where people drift, what's working, who likes it most and what to change. It
shows no brain maps or analysis jargon.

## Run it

```bash
cd frontend-chat && npm install && npm run dev
```

It opens on http://localhost:5174 and calls the backend on http://127.0.0.1:8000 (set `VITE_API_URL` for another).
Sign-in isn't wired up yet, so run the backend with sign-in off: the `backend-noauth` or `backend-noauth-replay`
launch configurations (replay uses saved predictions instead of the GPU, which is free and quick for design work).

## Where things are

- `src/insights.js`: turns the API's numbers into findings and words. The rules are relative (the video against
  itself, or A against B), because scores have no benchmark yet.
- `src/answers.jsx`: the verdict and one reply per follow-up topic.
- `src/charts.jsx`: the minimal SVG charts.
- `src/styles.css`: three design systems (Soft, Night, Bold) as token sets, switched in the sidebar. Add another
  by adding one `[data-theme="..."]` block and a button in `App.jsx`.
- `src/Mascot.jsx`: a placeholder character for the assistant.
