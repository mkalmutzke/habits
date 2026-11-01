# Daily briefs – how they are made (v3.6)

Three Claude **scheduled tasks** on the owner's Claude plan write the briefs every morning, at no extra cost:

| Brief | Prompt | Runs (owner's time zone) | Icon in the app |
|---|---|---|---|
| IBKR morning brief | [`ibkr.md`](ibkr.md) | Tuesday–Saturday, ready by 08:00 | 📰 on the IBKR card |
| Canada jobs brief | [`jobs.md`](jobs.md) | every day, ready by 08:00 | 💼 in the header |
| World news | [`world.md`](world.md) | every day, ready by 08:00 | 🌐 in the header |

## How one run works

1. The task starts a fresh Claude cloud session in the owner's cloud environment (about 07:40).
2. It asks the Edge Function `brief-ingest` whether to run (`action: start`). If the brief is switched off in Settings, or today isn't one of its days, the answer is `run: false` and the task stops at once – no research, almost no usage.
3. It researches with web search and builds the brief as JSON (see below).
4. It sends the brief to `brief-ingest` (`action: store`), which checks and trims it and stores it as today's brief, replacing the previous one. The app shows an amber dot until the brief is opened that day.

The IBKR brief never connects to the IBKR account: `brief-ingest` hands it the holdings of the newest stored IBKR report – symbol and name only, never quantities or values. If there are none, it gets VT and VWO with `fallback: true`, and the brief adds a note at the top.

## What the owner sets up once

- **Supabase dashboard** (Edge Functions → Secrets), in the project the briefs should go to: `BRIEF_INGEST_TOKEN` – a long random password (at least 32 characters) made by the owner.
- **Claude cloud environment** (the environment menu → Edit → environment variables):
  - `HABITS_BRIEF_URL` = `https://<project-ref>.supabase.co/functions/v1/brief-ingest`
  - `HABITS_BRIEF_AUTH` = the same password as above
- **Network access** of that environment must allow `<project-ref>.supabase.co`.

The password is never written into chat, code, logs or tests.

## The JSON a brief sends

```json
{
  "action": "store",
  "kind": "ibkr | jobs | world",
  "brief": {
    "intro": "one optional line (e.g. tickers covered, or 'Quiet day')",
    "note": "optional warning line shown on top (IBKR fallback)",
    "summary": "world news only: two or three sentences",
    "tickers": ["VT", "VWO"],
    "quiet": false,
    "sections": [
      { "heading": "Global markets & macro",
        "items": [ { "headline": "one line in own words", "why": "jobs brief only: why it matters", "url": "https://…", "source": "Reuters" } ] }
    ]
  }
}
```

Only `http(s)` links are kept; items without a headline or link are dropped; texts are capped. Changing a prompt: edit the file here, then update the scheduled task with the new text.
