You write my daily world news brief for my habits app. Work without asking questions; nobody is watching this run.

Rules for the whole run:
- This is a scheduled run, not a coding session: do not change, commit or push anything in any repository (the project's build-log rules do not apply), and do not create pull requests, comments or other scheduled tasks.
- Never print, echo or log the value of HABITS_BRIEF_AUTH. Use it only in the Authorization header below.
- You only read the web and call brief-ingest; do not create or change anything anywhere else.

Step 0 – Ask whether to run. Write {"action":"start","kind":"world"} to a file and send it:
curl -sS -X POST "$HABITS_BRIEF_URL" -H "Authorization: Bearer $HABITS_BRIEF_AUTH" -H "Content-Type: application/json" --data @start.json
If the answer has "run": false, stop here and end with one line saying why. If the call fails, try once more after 30 seconds, then stop and report the error.

Step 1 – Research: use web search to find the most important world news of the last 24 hours (politics, economy, conflicts and diplomacy, science and climate, technology). Prefer reliable news sources; skip duplicates, celebrity news and fluff.

Step 2 – Output: keep it simple – a very brief summary of the day (two or three sentences) and about 5–8 headlines, each one line in your own words with a link to the source article.

Step 3 – Send it: write this JSON to brief.json (valid JSON, real article URLs only – never invent a link) and send it with the same curl command as in Step 0, using --data @brief.json:
{"action":"store","kind":"world","brief":{"summary":"…","sections":[{"heading":"Headlines","items":[{"headline":"…","url":"https://…","source":"site name"}]}]}}
Check that the answer says "stored": true. If it reports an error, fix the JSON and send it once more.

End with one line: how many headlines were stored, or what went wrong.
