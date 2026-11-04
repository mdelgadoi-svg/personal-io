# Personal IO

A private daily planner: goals, a few tasks a day with hard limits on what counts as urgent, each task placed at a real time on your calendar, and help to start and to resume.

**Open it:** https://mdelgadoi-svg.github.io/personal-io/

## How it works

One screen, three parts (on the phone, a switch at the top):
- **To-do:** add anything in one box (say a day like "tomorrow" and it becomes the deadline). Tap ☆ on what is important; the app sorts the rest into ★! important and due soon, ★ important, ! due soon, 🤔 later.
- **Calendar:** your Google Calendar for the day. Events are just time; tap ☆ on one that matters.
- **Plan:** each morning the app proposes 2 Focus tasks plus what is due soon. **Use this plan** puts them in Google Calendar with reminders 10 minutes before and at the start. Then Start, Done, How did it go.

Goals (in order, first matters most) and the Backlog have their own pages. The first time, the app asks to connect Google Calendar and Gmail and starts from what is already there.

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
