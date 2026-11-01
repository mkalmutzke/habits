You write my daily Canada news brief, focused on what could affect my job search, for my habits app. Work without asking questions; nobody is watching this run.

Rules for the whole run:
- This is a scheduled run, not a coding session: do not change, commit or push anything in any repository (the project's build-log rules do not apply), and do not create pull requests, comments or other scheduled tasks.
- Never print, echo or log the value of HABITS_BRIEF_AUTH. Use it only in the Authorization header below.
- You only read the web and call brief-ingest; do not create or change anything anywhere else.
- No legal or tax advice – just flag what is worth looking into.

Step 0 – Ask whether to run. Write {"action":"start","kind":"jobs"} to a file and send it:
curl -sS -X POST "$HABITS_BRIEF_URL" -H "Authorization: Bearer $HABITS_BRIEF_AUTH" -H "Content-Type: application/json" --data @start.json
If the answer has "run": false, stop here and end with one line saying why. If the call fails, try once more after 30 seconds, then stop and report the error.

Context about me: I'm an SAP Analytics consultant (SAP Analytics Cloud, embedded analytics, CDS views, BI architecture) with 10+ years of international experience, currently in Switzerland. I plan to move back to Canada and work there, ideally as a contractor with as much remote work as possible, possibly taking remote US contracts without travelling to the US. Full-time in-house or consulting roles are also of interest.

Step 1 – Research: use web search to find the most relevant Canadian news from the last 24 hours that could affect this plan. Cover, where there is news:
- Canadian job market and economy (employment data, Bank of Canada decisions, tech/IT hiring, layoffs or hiring at large employers and consultancies)
- SAP and enterprise analytics in Canada (SAP Canada news, big SAP/S/4HANA or analytics projects, government or public-sector IT contracts, SAP partner/consultancy moves)
- Contracting and self-employment rules (tax changes, incorporation, contractor classification rules, GST/HST for consultants)
- Rules on returning residents, work and cross-border remote work for US clients (Canada–US trade, tax treaty, cross-border work rules)
- Remote-work trends at Canadian employers
Skip anything that has no plausible link to my job search.

Step 2 – Output: a short list of headlines only, grouped under a few brief headings. Each item: one headline in your own words, one short line on why it matters for me, and a link to the source article. Aim for about 6–10 items, prioritizing what actually matters; skip duplicates and fluff. If it was a quiet day, say so and keep it short rather than padding (set "quiet": true and an intro line such as "A quiet day for your search.").

Step 3 – Send it: write this JSON to brief.json (valid JSON, real article URLs only – never invent a link) and send it with the same curl command as in Step 0, using --data @brief.json:
{"action":"store","kind":"jobs","brief":{"quiet":false,"sections":[{"heading":"…","items":[{"headline":"…","why":"…","url":"https://…","source":"site name"}]}]}}
Check that the answer says "stored": true. If it reports an error, fix the JSON and send it once more.

End with one line: how many items were stored, or what went wrong.
