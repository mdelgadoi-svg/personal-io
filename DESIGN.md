---
name: Personal IO
description: A private day planner for a person with ADHD. The day is already made; one small step starts it.
colors:
  ground: "#F3F6FD"
  card: "#FFFFFF"
  ink: "#18243B"
  ink-2: "#526079"
  line: "#DCE3EF"
  line-2: "#E9EEF7"
  field: "#687DA8"
  primary: "#3558C8"
  primary-ink: "#24409E"
  primary-soft: "#EAF0FF"
  gold: "#F4C95D"
  gold-soft: "#FFF6D9"
  success: "#216E52"
  success-soft: "#EAF6EF"
  error: "#B42318"
  error-soft: "#FDECEA"
  on-dark-2: "#D5DDEC"
  on-dark-line: "#8A9AB8"
  gold-hover: "#FFDA7A"
typography:
  headline:
    fontFamily: "Figtree, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "Figtree, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Figtree, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  lead:
    fontFamily: "Figtree, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.3
  card-title:
    fontFamily: "Figtree, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
  label:
    fontFamily: "Figtree, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.45
  meta:
    fontFamily: "Figtree, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  sm: "8px"
  ctl: "12px"
  card: "16px"
  dialog: "20px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.ctl}"
    padding: "10px 16px"
    height: "48px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
    rounded: "{rounded.ctl}"
    padding: "10px 16px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.primary-ink}"
  button-success:
    backgroundColor: "{colors.success}"
    textColor: "{colors.card}"
    rounded: "{rounded.ctl}"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.ctl}"
    padding: "12px 14px"
    height: "52px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "16px 18px"
  chip:
    backgroundColor: "{colors.line-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  next-card:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
    rounded: "{rounded.dialog}"
    padding: "14px 20px"
  button-start:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink}"
    rounded: "{rounded.ctl}"
    height: "56px"
  button-start-hover:
    backgroundColor: "{colors.gold-hover}"
  add-line:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    height: "56px"
---

# Design System: Personal IO

Recorded Nov 16, 2026 from `css/app.css` and the running app at phone width, then updated the same day for v2.2 (the new Today, the add line, the Figtree typeface). The colors come from Marcelo's own design file. He confirms or corrects the wording in the pull request. Screens not yet redone (Plan, Tasks, Goals, Calendar, Settings, the task form) still carry older sizes, chips and symbols; bring each one to this file when it is next touched.

## Overview

**Creative North Star: "The day is already laid out"**

Personal IO should feel like a desk someone tidied for you before you sat down. The day is there, in order, and one thing is on top. The person using it arrives anxious and short on attention, so the screen has to be read in one look and has to offer one obvious thing to do. Nothing on it counts what was missed.

The look is cool and plain: a pale blue-grey ground, white surfaces, navy ink, one blue that means "you can tap this", and one gold that marks the single place to start. Shapes are soft and controls are large, because the phone is the main device and a thumb is the pointer.

**Key Characteristics:**
- One primary action per screen. On Today it is the gold "Start 1 minute" on the navy card; elsewhere it is solid blue. Everything else is quieter.
- Words are few and plain. Labels beat explanations.
- Large touch targets (48px buttons, 52px inputs).
- Flat surfaces. Depth is saved for windows that open over the page.
- No symbol code on Today: one drawn gold star for what matters, plain words for the rest.
- Times are always 12-hour with AM/PM.

## Colors

A cool, low-saturation base with one working blue and one warm gold.

### Primary
- **Working Blue** (`primary`): the one solid fill for the main action on a screen, the current tab, and links. Blue means "tap here".
- **Deep Working Blue** (`primary-ink`): hover and pressed state of the blue, and blue text on a pale blue fill.
- **Pale Blue** (`primary-soft`): a selected or highlighted area that is not itself a button.

### Secondary
- **Start Gold** (`gold`, hover `gold-hover`) and **Pale Gold** (`gold-soft`): the one place to start (the Start button on the navy card), the star on a task that matters, the break pill. Gold never carries text by itself on white.

### Tertiary
- **Done Green** (`success`, `success-soft`): finished things and "I already did it". Never a call to action for new work.
- **Alert Red** (`error`, `error-soft`): form errors, the "now" line on the calendar, and the "!" due-soon mark. Never used to say something was not done.

### Neutral
- **Cool Ground** (`ground`): the page.
- **Surface White** (`card`): cards, inputs, the bars, windows.
- **Navy Ink** (`ink`): all main text, and the fill of the one navy card on Today. On navy, secondary text is `on-dark-2` and quiet lines are `on-dark-line`.
- **Slate Ink** (`ink-2`): secondary text, meta lines, idle nav items.
- **Field Slate** (`field`): the 2px outline of inputs and plain buttons.
- **Hairline** (`line`, `line-2`): card borders and row dividers.

### Named Rules
**The One Blue Rule.** One solid blue button per screen. A second action is an outline or a text link.

**The One Navy Card Rule.** Only the next thing to do sits on navy, with the gold button. Nothing else on a screen is dark.

**The No Red Guilt Rule.** Red marks errors and time, never a task that was not done. The words are "Not yet".

## Typography

**Display Font:** Figtree (with system-ui, -apple-system, Segoe UI)
**Body Font:** Figtree (same stack)

**Character:** One friendly, round sans family for everything. The file ships with the app (`fonts/figtree.woff2`, one variable file, SIL Open Font License), so it works offline and nothing is fetched from another site. Hierarchy comes from size and weight.

### Hierarchy
- **Headline** (700, 28px, 24px on phones, 1.25): the page name on screens that have one.
- **Card title** (700, 24px, 1.2): the task on the navy card.
- **Title** (700, 20px, 1.25): section and card headings, window titles.
- **Lead** (700, 18px): the Start button, the short line of a quiet state.
- **Body** (400, 16px, 1.45): task names are 16px at weight 600.
- **Label** (600, 15px): buttons, times in the day list, the choices under the add line.
- **Meta** (400, 13px): lengths and status words under a task name.
- **Nav** (600, 11px): bottom bar labels and calendar hours.

### Named Rules
**The Six Sizes Rule.** New work uses 13, 15, 16, 18, 20, 24 and 28px only. Older screens still use more; fix them as they are redone.

**The No Shouting Rule.** No uppercase labels with letter spacing above a heading. The heading speaks for itself.

## Layout

One column on phones (breakpoint 760px), with 16px side padding and a fixed bottom bar. On a computer the page is up to 1400px wide and older screens split into 2 or 3 flexible columns (`.cols`) with a 20px gap. The header is sticky.

Today is one column, 560px at most, in this order: the date, the navy card with the next thing, the rest of the day as rows in time order (tasks and calendar events together), the add line. From 980px wide the hour calendar sits beside it. With three tasks the whole of Today fits one phone screen in about 40 words.

The bottom bar holds five items: Today, Plan, Calendar, Goals, Tasks.

## Elevation & Depth

Flat by default. Cards are white on the cool ground with a 1px hairline border and no shadow. Depth appears only when something floats.

### Shadow Vocabulary
- **Window** (`box-shadow: 0 20px 48px rgb(24 36 59 / 25%)`): the dialog, over a 40% navy backdrop.
- **Toast** (`box-shadow: 0 8px 24px rgb(0 0 0 / 20%)`): messages above the bottom bar.
- **Dragging** (`box-shadow: 0 10px 24px rgb(24 36 59 / 18%)`): a row while it is dragged.

## Shapes

Soft rectangles. Small focus shapes are 8px, controls 12px, cards and the add line 16px, windows and the navy card 20px. Chips and goal pills are full pills. Plain buttons and inputs carry a 1px slate outline. Rows in the Today list have no box at all: a hairline between them on the page ground. Older priority groups on Plan still use a 6px colored bar on the left edge; do not add new ones.

## Components

### Buttons
- **Shape:** soft rectangle (12px), 48px tall, 15px text at weight 600.
- **Primary:** solid Working Blue with white text (`.btn-dark`). Hover goes to Deep Working Blue.
- **Plain:** white with a 1px slate outline. Hover turns the outline blue.
- **Start:** solid Start Gold with navy text, 56px tall, full width, only on the navy card.
- **Success:** solid Done Green, used for "I already did it".
- **Small:** 44px tall, 14px text, used inside rows.
- **Link:** blue underlined text, 40px tall.
- **Focus:** 3px blue outline, 3px away from the control.

### Chips
- **Style:** full pill, 13px text at weight 600, pale fill. Used on older screens only. Today has no chips.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** white on the cool ground.
- **Shadow Strategy:** none; see Elevation.
- **Border:** 1px hairline on older cards. The proposal card and quiet states on Today are plain white with no border.
- **Internal Padding:** 16px by 18px; list rows 12px by 16px.

### Inputs / Fields
- **Style:** white, 1px slate outline, 12px corners, 52px tall, 16px text.
- **Focus:** blue border plus a 3px blue outline.
- **Error:** red border; messages in a pale red box with a red border.

### Navigation
- **Phone:** fixed bottom bar, icon above an 11px label, slate when idle and blue at weight 800 when current.
- **Computer:** text tabs in the header; the current tab is a solid blue pill.
- **Header:** the IO mark, the Now or Break pill, the sync pill, then Pause (with its word when there is room) and Settings. On a computer, Talk it out and Add task are there too.

### Next card (signature)
- The one navy surface. The task name (24px), its first small step in `on-dark-2`, the full-width gold "Start 1 minute", then a quiet foot: time and length on the left, "Done" as an underlined link on the right.

### Day list
- One row per task or calendar event, in time order. A task row is a round check on the left (tap for done, tap again to undo), then the time, the name and a 13px meta line; tapping the name starts it; three dots open it. A calendar event row has a small slate dot and regular weight. Done rows are struck through in slate.

### Add line
- One white field, 16px corners, with a mic and a send button inside. The send button turns blue once there is text. Three text choices appear under it only while he is in the box: Important (a star that fills gold), I already did it, Talk it out.

### Marks
- On Today: a drawn star, outlined in navy and filled gold, before the name of a task that matters. No other symbols.
- On older screens priority still shows as text marks: ★! (important and due soon), ★ (important), ! (due soon, in red), 🤔 (later). Replace them with the drawn star when those screens are redone.

### Start screen
- A centered window: the cat, the first step in 28px at weight 700, the task name in slate, a quiet one minute bar with no counting number, and one large blue button.

## Do's and Don'ts

### Do:
- **Do** keep one solid blue button per screen, and one gold button on the navy card.
- **Do** draw icons as SVG in one stroke weight.
- **Do** keep touch targets at 44px or more, 48px for main buttons.
- **Do** write times as 12-hour with AM/PM.
- **Do** say "Not yet" for unfinished work.
- **Do** check every screen at 390px wide first.

### Don't:
- **Don't** use red, counts or lists to show what was missed.
- **Don't** add streaks, points or scores.
- **Don't** put a card inside a card.
- **Don't** add uppercase labels above headings, colored side stripes, pill chips or text symbols to new work.
- **Don't** use em dashes in any text.
- **Don't** add a framework or a build step; the app is plain HTML, CSS and JavaScript.
