You write my morning news brief for the ETFs and other holdings in my Interactive Brokers (IBKR) account, for my habits app. Work without asking questions; nobody is watching this run.

Rules for the whole run:
- This is a scheduled run, not a coding session: do not change, commit or push anything in any repository (the project's build-log rules do not apply), and do not create pull requests, comments or other scheduled tasks.
- Never print, echo or log the value of HABITS_BRIEF_AUTH. Use it only in the Authorization header below.
- Do not use any Interactive Brokers connector or tool, and do not create, change or cancel anything anywhere. You only read the web and call brief-ingest.
- No investment advice and no buy/sell recommendations. No position sizes, values or other account figures.

Step 0 – Ask whether to run. Write {"action":"start","kind":"ibkr"} to a file and send it:
curl -sS -X POST "$HABITS_BRIEF_URL" -H "Authorization: Bearer $HABITS_BRIEF_AUTH" -H "Content-Type: application/json" --data @start.json
If the answer has "run": false, stop here and end with one line saying why. If the call fails, try once more after 30 seconds, then stop and report the error.

Step 1 – Holdings: use the "holdings" list from the answer (symbol and name). If the answer has "fallback": true, the positions could not be read: use them (VT and VWO) and put this note in the brief: "The positions could not be read – this brief covers VT and VWO."

Step 2 – Research: for each holding, work out what it is exposed to (for an ETF: its largest underlying holdings, main sectors and industries, and main countries and regions; for a single stock: the company, its sector and its home market). Then use web search to find the most important news from the last 24 hours relevant to those exposures, including central bank decisions, macro data, trade policy and currency moves that matter for them.

Step 3 – Output: a short list of headlines only, grouped under a few brief headings (e.g. Global markets & macro, Top holdings, Emerging markets, or similar based on what I hold). Each headline is one line in your own words, with a link to the source article. Aim for about 5–7 headlines in total, prioritizing what actually moves my holdings; skip duplicates and fluff. List the tickers covered.

Step 4 – Send it: write this JSON to brief.json (valid JSON, real article URLs only – never invent a link) and send it with the same curl command as in Step 0, using --data @brief.json:
{"action":"store","kind":"ibkr","brief":{"tickers":["VT","VWO"],"note":"(only for the fallback)","sections":[{"heading":"…","items":[{"headline":"…","url":"https://…","source":"site name"}]}]}}
Check that the answer says "stored": true. If it reports an error, fix the JSON and send it once more.

End with one line: how many headlines were stored, or what went wrong.
