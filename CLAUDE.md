# Personal IO: instructions for Claude Code

Read this first in every session. It is the project's working memory.

## The person and how to work with him

- Owner: Marcelo (GitHub `mdelgadoi-svg`). It is his personal planner, built around how he starts and finishes work. He does not write code; he describes changes and reviews the result in the app.
- Write in plain words. Short answers. Lists only when they help.
- **Never use em dashes** anywhere: app text, code comments, commits, replies.
- Times in the app are always 12-hour with AM/PM.
- "Ask me and assess my points, but build based on what I tell you." Push back when a request adds complexity, then do what he decides.
- Before building a new feature, check it against the working agreement below.

## Working agreement (from the Nov 1, 2026 audit)

- The audit recommends a 14-day feature freeze starting Nov 1 so the app gets used before it grows: fix only real blockers, and batch other change requests into one weekly session.
- When a request is a new feature during the freeze, say so once, offer to note it for the weekly batch, and build it only if he confirms.
- Prefer removing and simplifying over adding. Fewer words on screen, fewer steps, fewer ways to do the same thing.

## What the app is

A private daily planner that runs fully in the browser. No server, no database, no build step.
Live site: https://mdelgadoi-svg.github.io/personal-io/ (GitHub Pages, publishes from `main`).

Core method (enforced in `js/rules.js`):
- Goals: up to 10, each with a "why". Every task belongs to a goal (default `life`, "Keep life running"). **Goal order matters**: the first goal is the most important (↑ on the Goals tab).
- **v2.0: he never picks a level.** He marks only what is **important** (one ☆/★ button on every task, in the capture box and the form). The **deadline** decides urgency (today, tomorrow or overdue, `urgentWindowDays` 2). `R.levelFields` computes `priority`: important + due soon = ★! `both`, important = ★ `important`, due soon = ! `urgent`, neither = 🤔 `nice`. `relevel()` in app.js runs on every render and save. Old tasks without `important` keep what ★! and ★ meant.
- Nothing ever blocks: only a name is required (`validateTask`), no level caps, no deadline rules. Deadlines can be said in the title ("tomorrow", "Friday", "by Nov 10", "mañana"), read by `R.parseDeadline` at the start or end only.
- Ranking (`R.rankTasks`): level, nearest deadline, goal order, oldest.
- **The day proposal** (`R.proposeDay`, card on Today and Plan): up to 2 **Focus** tasks from the important ones, then the rest of the slots from what is due soon; anything due that day or overdue always comes, even past 3 slots. Later tasks are only offered when nothing else is. Tomorrow's proposal leaves out today's tasks still ahead. After 8 PM, Today points to Plan tomorrow. `day.proposed` keeps what the proposal put in the day: "Update the plan" only swaps those (tasks he added himself stay), and the note only shows when the new proposal really differs.
- Sync merge compares tasks without the computed fields (`priority`, `promotionBlocked`; `important` via `isImportant`), so relevelling never looks like an edit. "Keep life running" always shows and ranks last on the Goals tab. Starred calendar items of that day come at their own time. "Use this plan" adds them and writes Google Calendar; "Change" opens the Plan page pre-filled. If he changes a star after that, "Your priorities changed. Update the plan" re-proposes (done tasks stay) and Google is only updated when he taps Update.
- **Calendar events are just time.** One ☆ makes an event matter (a linked task, important, due that day). "☆ Doesn't matter" removes the link.
- No two open tasks with the same name.
- Planned tasks written to Google Calendar get reminders 10 minutes before and at the start (Google Calendar app on Android, calendar.google.com on the computer).
- Day plan: 3 slots (up to 7). Each task gets its own start time (`day.times[taskId]`) in the first free time that fits its length, around calendar events. The list follows the times.
- **v2.1 (Nov 9, 2026): a calmer assistant.** Built during the freeze because he asked. His pattern: he drifts away, coming back brings anxiety and shame, and he escapes to Instagram or chess for hours. Goal: easy to come back to, easy to leave toward work (never "sticky").
  - **Calm return.** After `gentleGapDays` (2) or more days away, the welcome shows no counts, no dates, no list: "No catching up needed", one small thing (`R.gentlePick`: something due that day first, else the shortest of the 3 most pressing) and "Start 1 minute". The "did you already do these" list is folded in `<details>`. The return is recorded when the welcome opens (a real save after days away), so Esc, the back gesture, a reload or a sync never lose it; Esc keeps ticks and the note. The welcome, the auto start and the break check wait for the first sync (8 s at most). That day is a **gentle day** (`R.isGentleDay` from `returns`; coming back at 8 PM or later makes tomorrow gentle too): the proposal is that one thing, anything due that day and starred calendar items, without "overdue" labels. Overdue tasks are not pushed in. After the welcome he lands on Today.
  - **Pause button** (header): "What's going on?" with I want a break, I'm avoiding something, I'm anxious, I'm tired, Too much at once. Scripted answers in `R.PAUSE` (no Claude). Each ends in one action: start 1 minute (`nextTask()`), a planned break, or write the worry (a journal note with `source: 'pause'`, never a task).
  - **Breaks with an end.** What (optional) and 10/20/30 min. The end goes to Google Calendar as a 5-minute free-time event with one reminder at that minute (`remind: [0]`, `free`, no bridge change), so the phone rings with the app closed. The header pill shows the break. At the end a kind window shows the next task: Start 1 minute, 5 more minutes (moves the reminder), Not now. Tapping the pill before the end opens "Back already?" (Keep my break, End break, Start 1 minute). Finishing a break always removes its reminder, also one Google sends back late. Starting any task ends a running break; a new break replaces the old one. Back windows for a break answered elsewhere (other tab or device) close by themselves. The auto start waits 15 minutes after "Not now". A break unanswered for 6 hours closes quietly (`R.breakState`).
  - **Voice rules**: warm, short, no shame, every message ends in one small action. No streaks, points or red "not done" (it says "Not yet"). The start cat is never sad.
- Talking or typing a note never creates tasks by itself. Only the word "task" (or "tarea") names one; Claude may suggest at most 3, unticked.

## Files

| File | Role |
|---|---|
| `index.html` | Shell: header, tabs, bottom nav, `<dialog id="modal">`, toasts |
| `css/app.css` | All styles. Palette from his design file: ground `#F3F6FD`, ink `#18243B`, primary `#3558C8`, gold `#F4C95D`, success `#216E52`, error `#B42318` |
| `js/app.js` | Every screen and action (large; one `actions` table, render functions return HTML strings) |
| `js/rules.js` | Pure logic, no DOM. Limits, validation, urgency, free time, overlap lanes, "task" detection. Tested |
| `js/store.js` | Load and save `localStorage` (quiet saves for housekeeping), sync bookkeeping, backup download and restore |
| `js/google.js` | Google bridge transport, or Google sign-in (token client); Calendar v3 read/write, data file, Gmail read-only on request |
| `bridge/Code.gs` | The Apps Script he pastes into his Berkeley account (web app, runs as him). Settings copies it with his key filled in |
| `js/ai.js` | Claude API from the browser with his own key (model `claude-sonnet-5-5`, effort medium). Always optional |
| `sw.js` | Offline cache. **Bump `VERSION` on every change to app files** |
| `tests/rules.test.js` | Unit tests for `rules.js` |
| `tests/e2e/` | Browser checks (Python Playwright) |
| `.claude/agents/personal-io-reviewer.md` | Independent reviewer agent |


## Data

Saved first in the browser's `localStorage`, which his computer's Chrome can wipe on restart (Nov 3, 2026). The real copy lives in his Google Drive, so the computer and the phone share it and a wiped browser loses nothing. Code changes never erase it.

The Google bridge (v1.10, preferred): `bridge/Code.gs`, an Apps Script web app in his Berkeley account (execute as me, access Anyone), called with a secret key. Actions: `ping`, `info`, `read`, `write` (refuses with `conflict` if the copy changed since `expect`; script lock), `events`, `writeDay` (Advanced Calendar service, so event ids match the REST API). Data file: Drive folder "Personal IO", `personal-io-data.json` (trashed copies ignored); `savedAt` is read from the file itself, so a second copy of the script (set up again after a wipe) sees the same data. `writeDay` only deletes events tagged `personalIo`. Berkeley Web app URLs look like `/a/macros/berkeley.edu/s/<id>/exec`. Gmail reading still needs the Client ID. No sign-in and no hourly reconnect. `personal-io:bridge` keeps `{ url, key, account }`. "Your link" in Settings (`#bridge=<url>&k=<key>`) sets up any browser or phone and restores a wiped one; keep it private. The older Client ID sign-in path stays under "Other way" in Settings.

How sync works (v1.9, `syncNow` in `app.js`, decisions in `R.syncDecision` and `R.mergeData`):
- Every real change sets `savedAt` (always moves forward). Housekeeping saves (`save(state, { quiet: true })`: daily check, last open date, rebuilt times, closing the welcome without input, start screen shown, an automatic start) do not, so opening the app on another device never counts as an edit.
- `personal-io:sync` keeps `{ base, fileId, at }`: `base` is the `savedAt` both sides had at the last sync. `personal-io:sync-base` keeps that copy's content. Changed here = `savedAt !== base`.
- Push 1.5 s after a change, and on connect, tab focus, closing a window, and every 2 minutes. Pull when Drive is newer and nothing changed here. If both changed, `mergeData` joins them item by item (tasks, goals, events by id; days field by field, with a day's tasks merged as a set and an empty day counted as no day; log, journal, returns kept from both; without a base, done or trashed wins over open); the device's pre-join copy goes to `personal-io:other-copy`. No question is asked.
- Signing in with a different Google account starts a fresh join with that account's Drive copy.
- `save()` never writes older data over newer data saved by another window (compares `savedAt`): housekeeping takes the newer copy, a real change is joined to it. This caused the Nov 2, 2026 loss: an old tab saved its copy at midnight (`tests/e2e/e2e_tabs.py`).
- If something is typed while Drive answers, the sync starts over. Data from another tab (`storage` event) replaces this tab's, so an old tab never sends old data. Drive calls give up after 20 s.
- The screen is not redrawn while he types or a window is open; it redraws when the window closes.
- If Google refuses the sign-in, a toast offers "Calendar only" (`personal-io:calendar-only`): calendar without Drive. Tapping the "Sync off" pill tries Drive again.
- The header pill shows the state: Sync / Sync now (connect), Saving, Synced, Sync off, Sync problem.

- `personal-io:v1`: main JSON `{ settings, goals, tasks, events, days, log, journal, returns, moments, lastOpenDate, lastDailyCheck }`
- Task: `id, status (open|done|trashed), title, goalId, important, priority (computed), deadline, minutes, firstSteps[], computer, place (everywhere|silent|commute), fixedDate, fixedTime, eventRef, progress, needs[]`
- Day (key `YYYY-MM-DD`): `taskIds, times, slots, plan (rebuilt by syncPlan), set, planStale, googlePending, googleIds, reviewed (by task id), focus (ids from the proposal), prioChanged`
- `moments` (v2.1, synced, joined by id; a finished break wins, otherwise the copy with the latest `upd`): `{ id, at, upd, kind: 'break', what, minutes, endAt, taskId, googleId, googleDay, backAt, back: start|not_now|replaced|closed, extended }`, `{ kind: 'pause', feeling, chose: step|break|worry }`, `{ kind: 'start', taskId, auto }`. Returns now also keep `hour` (for the evening rule); a return after days away is a real save, other returns stay quiet. For the 2-week test (from Nov 10): breaks ending near `endAt`, days with a start, which feelings come up.
- Other keys: `personal-io:claude-key`, `google-client-id`, `google-calendar-id`, `google-session` (token for its hour, plus whether Drive was allowed), `google-events` (last Google events per day, shown after the hour), `sync`, `sync-base`, `other-copy`, `calendar-only`, `v1-unreadable` (data that failed to load, kept instead of overwritten), `voice-lang`, `start-pic`
- Also `personal-io:bridge`, `bridge-pending` (key made by "Copy my code", until Connect).
- Not synced (per device): Claude key, start picture, voice language. The phone gets the Client ID from the "Use it on your phone" link in Settings (`#connect=<client id>`).
- When changing the data shape, keep old data working (see `ensureTimes` for the pattern). Never require a reset.

## Connections (nothing else may be added)

- Google Calendar (`calendar.events` scope) with the Client ID from his personal Google Cloud project; he signs in with his Berkeley account.
- Google Drive (`drive.appdata` scope only, same sign-in) for the one copy of his data. Approved by him on Nov 2, 2026. Needs the Drive API enabled in his Cloud project.
- The Google bridge (Apps Script in his Berkeley account) for calendar and data without sign-in. Approved by him on Nov 3, 2026 (brief R5 option A). If Berkeley blocks "Anyone" access, the fallback is his personal Gmail account.
- Gmail read-only, only when he clicks "Read my last 2 weeks".
- Claude API with his own key. Everything must still work without it (templates as fallback).

## How to make a change

1. Read the relevant code first. Keep logic in `rules.js` and add a unit test for any rule change.
2. Edit. Escape all user text with `esc()` before putting it in HTML.
3. Bump `VERSION` in `sw.js`.
4. Run `node --test tests/*.test.js` (must pass).
5. Run `bash tests/e2e/run_all.sh` if Playwright and Chromium are available; if not, say so plainly.
6. For anything bigger than a small fix, run the `personal-io-reviewer` agent and fix what it finds before reporting.
7. Commit with a short message starting with the version, for example `v1.9: ...`.
8. The site publishes only from `main`. In a cloud session, finish by pushing and telling him to press **Create PR**, then merge it on GitHub (or merge it for him if he asks).
9. Reply with what changed in his words, what to do (usually "reload the app once"), and anything you could not test.

## Things that look like bugs but are by design

- Data differs between devices until each one taps Sync (Google sign-in) at least once.
- With the bridge there is no sign-in at all. Without it, Google sign-in lasts about an hour; after that the header pill says Sync and one tap reconnects. Google events from the last connection stay on the calendar meanwhile.
- The Plan page opens on the day that has a plan (today if it has tasks, otherwise tomorrow if it has tasks); from 8 PM it opens on tomorrow.
- Dragging tasks works with a mouse; on a phone, buttons and the "Change time" window are used instead.
- The start screen opens by itself once when a planned task's time begins, only if the app is open.

## His v2 brief (Nov 2, 2026)

He sent `PERSONAL_IO_V2_BRIEF.md`: one-box capture with zero required fields (R1), automatic priority (R2), calendar as front door with date ranges and linked blocks (R3), fewer words (R4), no reconnecting (R5), review screen (R6). Build in phases and stop after each for his go. Order he chose on Nov 3: R5 bridge first (done in v1.10), then Phase 1 (R1, R2, R4). v2.0 (Nov 4) did R1/R2 his way: one Important button plus the deadline, the morning proposal, star-only meetings, 10 and 0 minute reminders. Still open from the brief: splitting several tasks from one line, minutes from history, R3 date ranges, R4 word budget, R6 review. His answers: bridge in the Berkeley account; Work vs Personal by goal; no Claude API key (all inference with plain rules).

## Open ideas (not approved, do not build without asking)

An evening stopping point (write what is on your mind, see tomorrow's one thing, close; from his ADHD, anxiety and sleep research brief); Claude-powered empathy for Pause (needs a key; must still end in one action, no reassurance loops); small built-in games with a natural end (a chess puzzle); "Let's procrastinate together" with other people (needs a server: a separate product); a "This week" usage card; a weekly review; splitting `app.js` into screen files; removing the in-app events on the Calendar tab; merging "Talk it out" into the capture box; a shorter task form with "More details".
