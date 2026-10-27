# Personal IO

A personal planning app built around how an ADHD brain actually starts work.

**Open it:** https://mdelgadoi-svg.github.io/personal-io/

## How it works

1. **Goals** (up to 10) are the big outcomes, each with a one or two sentence *why*.
2. **Tasks** always serve a goal. Each has a priority, a deadline, a time estimate,
   a **first-minute step**, and where it can be done:
   *Everywhere*, *Requires silent space*, or *Requires commuting* (adds 30 min before).
3. **Priorities and limits** (open tasks):
   - ★! Important + urgent: max 3, deadline today or tomorrow
   - ★ Important: max 4
   - ! Urgent: max 3
   - 🤔 Nice to have: no limit
   - ★ tasks move up to ★! on their own when the deadline gets close (if there's room).
   - ★ tasks untouched for 21 days ask "still important?"
4. **Plan the day** (3 slots, open up to 7), then **Build my blocks**: tasks are packed into
   2 to 4 hour deep work blocks. Meetings with a fixed time stay put, with commute before them.
5. **End of block review**: Done / Still working / Not started, plus the reason.
   Unfinished tasks go back to the backlog, and everything is kept in the **Record**.

Calendar colors: **blue** do now, **green** should do (flexible), **yellow** might help,
**purple** commute.

## Data

Version 1 saves in the browser on each device. Use **Settings → Download backup** now and then.
Next version: Google Calendar and Google Tasks, so phone and computer share one plan.
Nothing else is connected.

## Install as an app

- **Computer (Chrome):** open the link, then the install icon at the right of the address bar.
- **Phone (Chrome on Android):** open the link, menu ⋮ → *Add to Home screen*.

## For maintenance

- Plain HTML, CSS and JavaScript. No build step.
- Rules (limits, urgency, blocks, review) live in `js/rules.js` and are tested:
  `node --test tests/*.test.js`
- When app files change, bump `VERSION` in `sw.js` so installed copies update.
