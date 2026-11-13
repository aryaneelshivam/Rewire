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
Run `npm install` in `frontend/` too: the results view reuses the dashboard's player and timeline.

Sign-in and credits are shared with the dashboard. The chat reads its env from `frontend/` (`.env.local`, and
`.env.production` for builds), so with `VITE_CLERK_PUBLISHABLE_KEY` set it uses the same Clerk app, the same
invite-only sign-in and the same credits; each request carries the person's session token. The backend accepts the
chat's address (port 5174) by default; a deployed chat needs its address in `CLERK_AUTHORIZED_PARTIES`.

To work without sign-in, use the `chat-noauth` and `backend-noauth` (or `backend-noauth-replay`, which replays saved
predictions instead of using the GPU) launch configurations.

## Where things are

- `src/insights.js`: turns the API's numbers into findings and words. The rules are relative (the video against
  itself, or A against B), because scores have no benchmark yet.
- `src/answers.jsx`: the verdict and one reply per follow-up topic.
- `src/charts.jsx`: the minimal SVG charts.
- `src/styles.css`: phone-first (base styles are for a phone; 640px and 900px add the avatar column and the fixed
  sidebar), in the Aura look: a mint-to-peach gradient for arriving, a solid workspace once results load.
- `src/AuthGate.jsx` and `src/AccountMenu.jsx`: sign-in (the dashboard's flow) and the account and credits menu.
- `mascots/peek.ts` and `src/Peek.jsx`: Peek, the Wobnimo mascot; `src/Mascot.jsx` is its flat icon.
