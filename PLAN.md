# Personal IO: the plan (Nov 17, 2026)

Marcelo's decisions, written so every build session starts from the same page. Read `CLAUDE.md` first, then this file. Build one phase at a time, smallest version first, and stop after each phase for his review (screenshots on phone and computer, then he merges).

## The idea in one line

People with ADHD will procrastinate. Give that time a calm place inside the app (games that are active and end), and an agent that watches the whole day and walks the person back to the plan, kindly, before play turns into hours.

## The three sections (the new top level)

| Section | What is in it |
|---|---|
| **Procrastination** | Chess and Sudoku. Nothing else. |
| **Today's Planning** | Today (the next thing, the day's list, the day's calendar) and the "What matters" list (what is now the Plan tab). |
| **Life Planning** | The 90-day plan with his triangle (strengths, what you love, context), the scorecard, and Goals. |

The tab names are his: "Procrastination", "Today's Planning", "Life Planning". The app still opens on Today's Planning. Calendar stops being its own tab (the day's calendar is already on Today; the week view can sit behind a link).

## The Follower: the most important agent

One agent, always in the loop, across all three sections. Version 1 is plain rules inside the app (no AI key, no server). It only sees what happens in the app. Later it can become a plugin or use AI reading the same log.

**What it watches**
- Where he is and for how long, per day: minutes in Procrastination (by game), in Today's Planning, in Life Planning.
- In games: games in a row, wins and losses in a row, how fast he starts a new game.
- In planning: minutes planning without starting anything.
- From Today: the next task and its time, and whether a task was started.

**What it does** (one short line at a time, kind, always ending in one action; never blocks)
- **Play time:** at about 10, 25 and 45 minutes of play in a day, shown between games (never in the middle of one). In his words: "Good game, happy you are having a great time. Remember that [next task] is important. Want to plan when to play, or is there anything more?" Buttons: Start 1 minute (the next task), Plan my play (puts a play block in today's plan), Keep playing.
- **Streaks:** after 3 wins in a row, or 2 losses in a row, it suggests this is a good place to stop.
- **Lowering the level as play grows:** the more he has played that day, the calmer the next game: a weaker and slower computer player, shorter games (for Sudoku, a smaller or easier grid), and "New game" sits under today's next task instead of on top. (To confirm with him: this is my reading of "decreasing the levels or the type of players".)
- **Over-planning:** after about 10 minutes in Today's Planning, or about 20 in Life Planning, without starting anything: "You have planned enough. Start the first thing?"
- **Coming back:** leaving a game always lands on Today's next thing first.

**What it logs** (in `moments`, synced, for the self-test)
- Each session: section, minutes, games, results.
- Each nudge: which one, and what he did after (started a task, kept playing, planned play, closed the app).

## Phases

### Phase A: Procrastination + the Follower (next)
- The three sections in the header and bottom bar.
- **Chess** against a simple computer player with a few levels. No clock, no rating, a natural end. Rules from an open-license library copied into the repo as plain files (for example chess.js, BSD license, credited); the board and the computer player are our own small code.
- **Sudoku** with its own small generator (no outside code needed), easy to medium grids.
- **The Follower v1** as above, all rules in `rules.js` with unit tests.
- Done when: he can play both games on phone and computer, the nudges appear at the right moments and never mid-game, the level drops as play grows, and the numbers below are logged.

### Phase B: Today's Planning agent
- The day builds itself on the first open of the day and is written to Google Calendar without a tap, inside hours he sets once.
- Each reminder carries the first small step.
- **The Today harness** (no key): the app gives a prompt and a small file (today's calendar, what matters, how soon). He pastes both into his own AI (connected to his email). His AI returns a `.md` file in a fixed format (tasks, how soon, first step). He uploads it and the cards appear, unticked, for him to keep.
- A short setup guide so his fiancee and his friend can connect their own Google account.

### Phase C: Life Planning agent (90-day planner)
- A guided page with the triangle: strengths, what you love, context (his market notes go into context every 2 weeks).
- A personal scorecard with four sides (to confirm with him which four).
- **The 90-day harness** (no key): prompt plus file out, plan file back. The plan returns 3 to 5 goals with a why, one strength to keep, one behavior to change, and where to put the hours. Uploading it sets Goals, which already order "What matters" and Today.

### Phase D: later
- Real agents with an AI key (only if the tests work and he decides), the Follower as a plugin, information and advice (the third part of the original idea).

## What gets measured (each phase is used for about a week)
- Start delay (already logged since v2.2).
- Play minutes per day, and games per session.
- The share of play sessions followed by a task start within 10 minutes.
- What he did after each nudge.
- Minutes planning before the first start of the day.
- Outside the app, once a week: Instagram minutes from the phone's Digital Wellbeing (he notes it by hand).

## Testers
Marcelo, his fiancee, and one friend. Each uses their own copy (their own browser data and their own Google bridge). No shared server.

## Rules that still hold
No AI key and no server for now. Plain HTML, CSS and JavaScript, logic in `rules.js` with tests, old data keeps working. The calm look in `DESIGN.md`. Kind words, no shame, every message ends in one small action; the play nudges show the time spent (approved exception). No em dashes. Times in 12-hour AM/PM.
