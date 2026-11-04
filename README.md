# Personal IO

A private daily planner: goals, a few tasks a day with hard limits on what counts as urgent, each task placed at a real time on your calendar, and help to start and to resume.

**Open it:** https://mdelgadoi-svg.github.io/personal-io/

## How it works

1. **Goals** (up to 10), each with a one or two sentence *why*. Every task serves a goal.
2. **Priorities, with limits on open tasks:**
   - ★! Important + urgent: max 2, deadline today or tomorrow
   - ★ Important: max 3
   - ! Urgent: max 3, deadline today or tomorrow
   - 🤔 Tasks for later: no limit, deadline optional
   - ★ tasks move up to ★! when the deadline gets close, if there is room.
3. **Plan today or tomorrow:** 3 slots (up to 7). Each task goes into the first free time that fits its length, around your Google Calendar. Drag it on the calendar or use "Change time". **Set plan** writes it to Google Calendar.
4. **Start:** one step per minute on the start screen.
5. **How did it go?** Done, still working, or not started, plus where you left off. Unfinished work goes back to the list.

## Your data

Saved in the browser first, and the real copy in your Google Drive, so the computer and the phone show the same data and a wiped browser loses nothing. Nothing is stored on GitHub.
- Set up once: **Settings > Google**, follow the 5 steps (a small script in your own Google account, the "bridge"). After that there is no Google sign-in.
- **Your link** in Settings: bookmark it and open it on the phone. If a browser ever loses your data, open the link.
- **Download backup** in Settings is still there as an extra copy.

## Install as an app

- **Computer (Chrome):** open the link, then the install icon at the right of the address bar.
- **Phone (Chrome on Android):** open the link, menu ⋮ → *Add to Home screen*.

## For maintenance

- Plain HTML, CSS and JavaScript. No build step. See `CLAUDE.md` for how the code is organized.
- Unit tests: `node --test tests/*.test.js`
- Browser checks: `bash tests/e2e/run_all.sh` (needs Python Playwright with Chromium)
- When app files change, bump `VERSION` in `sw.js` so installed copies update.
