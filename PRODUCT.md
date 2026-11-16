# Product

<!-- impeccable:product-schema 1 -->

Draft written Nov 15, 2026 from CLAUDE.md and Marcelo's own words. He confirms or corrects it in the pull request before it counts as final.

## Platform

web

## Users

- First user: the owner, Marcelo, who uses it every day on his Android phone and his computer.
- Target users later: adults with ADHD in the smartphone era. They seek dopamine, procrastinate, feel guilty about it, and the guilt makes starting even harder. Planning feels like progress, so big tasks get avoided. Getting into and out of hyperfocus or distraction is hard, and the usual way out is stress.

## Product Purpose

An environment that helps people with ADHD, in three parts:

1. A place to procrastinate with the lowest guilt possible (games and light entertainment). Not built yet.
2. A path out of it into real work. This is where the planner and the follow-up do their job. Built: goals, the morning proposal, calendar times, reminders, the start screen, calm return, Pause, breaks with an end.
3. A place to find information and direct advice made for that person. Not built yet.

Success: more of the time spent in the app turns into real work, with less stress and less shame on the way in.

## Positioning

Most focus apps block, warn or count streaks. Personal IO accepts that the user will procrastinate, makes that time guilt free, and then moves the reward from play to work little by little until the person is working. Easy to come back to, easy to leave toward work, never sticky.

## Operating Context

- Phone first (Chrome on Android, installed to the home screen) and Chrome on the computer.
- Typical moments: the morning plan, the minute before a planned task starts, coming back after days away, and escaping to Instagram or chess for hours.
- Reminders arrive through Google Calendar, so they ring with the app closed.

## Capabilities and Constraints

- Plain HTML, CSS and JavaScript. No framework, no build step. Hosted on GitHub Pages from `main`.
- All logic in `js/rules.js` with unit tests. Screens in `js/app.js`.
- Data in the browser plus one copy in his Google Drive. Old data must keep working after every change.
- Only the connections listed in CLAUDE.md. Everything works without a Claude key.
- Times are always 12-hour with AM/PM.
- Open decision: how the "adaptive dopamine" engine rewards people. The current voice rules ban streaks, points and red "not done". Any reward design must either respect that or change the rule with his approval.

## Brand Commitments

- Name: Personal IO.
- Voice: warm, short, no shame. Every message ends in one small action. "Not yet" instead of "not done". The start cat is never sad.
- No em dashes anywhere.

## Evidence on Hand

- Usage data from the 2-week test that started Nov 10, 2026 (`moments` in the data: breaks, pauses, starts).
- No testimonials, users or study results yet. Do not invent any.

## Product Principles

1. Fewer words, fewer steps, one action per screen.
2. Nothing blocks. Only a name is required.
3. Coming back after time away never shows a pile of what was missed.
4. Rules first, AI optional.
5. The app wins when the person leaves it to work.
