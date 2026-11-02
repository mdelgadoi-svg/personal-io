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
- Goals: up to 10, each with a "why". Every task belongs to a goal. Default goal id `life` ("Keep life running").
- Priorities and limits on open tasks: ★! `both` max 2, ★ `important` max 3, ! `urgent` max 3, 🤔 `nice` ("Tasks for later") no limit.
- ★! and ! need a deadline today or tomorrow (`urgentWindowDays` 2). ★ tasks due that soon move up to ★! if there is room; if ★! is full the row offers "Change deadline" or "Move to 🤔".
- Tasks for later may skip the deadline. No two open tasks with the same name.
- A task saved earlier keeps its level and deadline without being blocked when rules change (the list shows a warning instead).
- Day plan: 3 slots (up to 7). Each task gets its own start time (`day.times[taskId]`) in the first free time that fits its length, around calendar events. The list follows the times.
- Talking or typing a note never creates tasks by itself. Only the word "task" (or "tarea") names one; Claude may suggest at most 3, unticked.

## Files

| File | Role |
|---|---|
| `index.html` | Shell: header, tabs, bottom nav, `<dialog id="modal">`, toasts |
| `css/app.css` | All styles. Palette from his design file: ground `#F3F6FD`, ink `#18243B`, primary `#3558C8`, gold `#F4C95D`, success `#216E52`, error `#B42318` |
| `js/app.js` | Every screen and action (large; one `actions` table, render functions return HTML strings) |
| `js/rules.js` | Pure logic, no DOM. Limits, validation, urgency, free time, overlap lanes, "task" detection. Tested |
| `js/store.js` | Load and save `localStorage` (quiet saves for housekeeping), sync bookkeeping, backup download and restore |
| `js/google.js` | Google sign-in (token client), Calendar v3 read/write, Drive appdata file, Gmail read-only on request |
| `js/ai.js` | Claude API from the browser with his own key (model `claude-sonnet-5-5`, effort medium). Always optional |
| `sw.js` | Offline cache. **Bump `VERSION` on every change to app files** |
| `tests/rules.test.js` | Unit tests for `rules.js` |
| `tests/e2e/` | Browser checks (Python Playwright) |
| `.claude/agents/personal-io-reviewer.md` | Independent reviewer agent |


## Data

Saved first in the browser's `localStorage`. While Google is connected, one copy also lives in his Google Drive (hidden app folder, file `personal-io-data.json`), so the computer and the phone share it. Code changes never erase it.

How sync works (v1.9, `syncNow` in `app.js`, decision in `R.syncDecision`):
- Every real change sets `savedAt` (always moves forward). Housekeeping saves (`save(state, { quiet: true })`: daily check, last open date, rebuilt times) do not, so opening the app on another device never counts as an edit.
- `personal-io:sync` keeps `{ base, fileId, at }`: `base` is the `savedAt` both sides had at the last sync. Changed here = `savedAt !== base`.
- Push 1.5 s after a change, and on connect, tab focus, closing a window, and every 2 minutes. Pull when Drive is newer and nothing changed here. If both changed, he picks a copy; the other goes to `personal-io:other-copy`.
- Nothing pulls while a task form or other window is open.
- The header pill shows the state: Sync (connect), Saving, Synced, Pick a copy, Sync problem.

- `personal-io:v1`: main JSON `{ settings, goals, tasks, events, days, log, journal, returns, lastOpenDate, lastDailyCheck }`
- Task: `id, status (open|done|trashed), title, goalId, priority, deadline, minutes, firstSteps[], computer, place (everywhere|silent|commute), fixedDate, fixedTime, eventRef, progress, needs[]`
- Day (key `YYYY-MM-DD`): `taskIds, times, slots, plan (rebuilt by syncPlan), set, planStale, googlePending, googleIds, reviewed (by task id)`
- Other keys: `personal-io:claude-key`, `google-client-id`, `google-calendar-id`, `google-session` (token for its hour, plus whether Drive was allowed), `google-events` (last Google events per day, shown after the hour), `sync`, `other-copy`, `v1-unreadable` (data that failed to load, kept instead of overwritten), `voice-lang`, `start-pic`
- Not synced (per device): Claude key, start picture, voice language. The phone gets the Client ID from the "Use it on your phone" link in Settings (`#connect=<client id>`).
- When changing the data shape, keep old data working (see `ensureTimes` for the pattern). Never require a reset.

## Connections (nothing else may be added)

- Google Calendar (`calendar.events` scope) with the Client ID from his personal Google Cloud project; he signs in with his Berkeley account.
- Google Drive (`drive.appdata` scope only, same sign-in) for the one copy of his data. Approved by him on Nov 2, 2026. Needs the Drive API enabled in his Cloud project.
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
- Google sign-in lasts about an hour; after that the header pill says Sync and one tap reconnects. Google events from the last connection stay on the calendar meanwhile.
- The Plan page opens on the day that has a plan (today if it has tasks, otherwise tomorrow if it has tasks); from 8 PM it opens on tomorrow.
- Dragging tasks works with a mouse; on a phone, buttons and the "Change time" window are used instead.
- The start screen opens by itself once when a planned task's time begins, only if the app is open.

## Open ideas (not approved, do not build without asking)

A "This week" usage card; a weekly review; splitting `app.js` into screen files; removing the in-app events on the Calendar tab; merging "Talk it out" into the capture box; a shorter task form with "More details".
