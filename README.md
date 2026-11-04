# Personal IO

A private daily planner: goals, a few tasks a day with hard limits on what counts as urgent, each task placed at a real time on your calendar, and help to start and to resume.

**Open it:** https://mdelgadoi-svg.github.io/personal-io/

## How it works

1. **Add anything** in one box. Say a day ("tomorrow", "Friday") and it becomes the deadline.
2. **Tap ☆ on what is important.** That is the only choice. The deadline decides what is urgent, and the app sorts: ★! important and due soon, ★ important, ! due soon, 🤔 later.
3. **Goals in order:** the first goal matters most, and its tasks come first.
4. **Each morning the app proposes your day:** 2 Focus tasks plus what is due soon. Tap **Use this plan**, or **Change**.
5. **Calendar events are just time.** Tap ☆ on a meeting that matters.
6. **Reminders:** planned tasks go to Google Calendar with a reminder 10 minutes before and at the start, on your phone and computer.
7. **Start:** one step per minute on the start screen.

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
