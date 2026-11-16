---
name: Personal IO
description: A calm place for the day. It looks like a printed invitation, and one small step starts the work.
colors:
  ground: "#F1EEE6"
  card: "#FBF9F4"
  ink: "#33372F"
  ink-2: "#63675B"
  line: "#DDD8CB"
  line-2: "#E8E3D8"
  field: "#85887A"
  primary: "#55624A"
  primary-ink: "#434E3A"
  primary-soft: "#E6E8DC"
  band: "#5F6A4F"
  on-band: "#FBF9F4"
  on-band-2: "#E4E6D8"
  on-band-line: "#A9B19A"
  gold: "#E3C77A"
  gold-soft: "#F6EFD9"
  gold-cream: "#F0DDA8"
  success: "#4B6B4F"
  success-soft: "#E4EBDF"
  clay: "#8A4034"
  error: "#9A3B2E"
  error-soft: "#F6E5E0"
typography:
  headline:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1.25
  band-title:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: 1.25
  title:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.25
  body:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.09em"
  meta:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  sm: "8px"
  ctl: "12px"
  card: "14px"
  dialog: "18px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  band: "44px"
components:
  button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 20px"
    height: "44px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-band}"
    rounded: "{rounded.pill}"
    padding: "8px 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.primary-ink}"
  button-start:
    backgroundColor: "{colors.on-band}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.pill}"
    padding: "0 26px"
    height: "44px"
  button-start-hover:
    backgroundColor: "{colors.gold-cream}"
  band:
    backgroundColor: "{colors.band}"
    textColor: "{colors.on-band}"
    padding: "44px 24px 30px"
  add-line:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "54px"
  due-pill:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "40px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "16px 18px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.ctl}"
    padding: "12px 14px"
    height: "52px"
---

# Design System: Personal IO

Rewritten Nov 16, 2026 for v2.3. Marcelo sent the wedding invitation his fiancee made and said: "I feel really calm when I see it." This look comes from that page: its colors, its air, its flow. He did not want its typefaces, so the type is plain Roboto. He confirms or corrects this file in the pull request.

## Overview

**Creative North Star: "A printed invitation"**

Personal IO should feel like a card someone made with care and left on your desk. Warm paper, one soft green, a little gold. Things sit in the middle of the page with room around them. Nothing shouts, nothing counts what was missed, and each screen asks for one small thing.

The person using it arrives anxious and short on attention. Calm is the feature: few words, thin lines instead of boxes, small buttons that sit where the eye already is.

**Key Characteristics:**
- Warm paper ground, sage green for anything you can tap, soft gold for what matters.
- One green band per screen at most, edge to edge, like a section of the invitation. It holds the next thing to do.
- Content sits in a centered column (640px) on a phone and on a computer alike.
- Small pill buttons. No full-width buttons.
- Light type weights (400 and 500). Small labels and the tabs are capitals with wide spacing.
- Times are always 12-hour with AM/PM.

## Colors

Paper, sage and a little gold, taken from the invitation.

### Primary
- **Sage** (`primary`, hover `primary-ink`): every control you can tap, links, the current choice, headings on paper.
- **Band Green** (`band`): the one filled band on Today, and the Now pill in the header.

### Secondary
- **Soft Gold** (`gold`, `gold-soft`): the star on what matters, a gentle highlight.
- **Gold Cream** (`gold-cream`): the heading on the green band only.

### Tertiary
- **Terracotta** (`clay`, and `error` for form errors): the "now" line on the calendar and error text. Used very little. Never to say something was not done.
- **Done Green** (`success`, `success-soft`): the filled check of a finished task.

### Neutral
- **Paper** (`ground`): the page, the header and the bottom bar.
- **Sheet** (`card`): cards, the add line, windows.
- **Ink** (`ink`) and **Soft Ink** (`ink-2`): text and secondary text.
- **Hairlines** (`line`, `line-2`) and **Field** (`field`): dividers, and the outline of buttons and inputs.
- On the band: `on-band` for text and the Start button, `on-band-2` for quiet text, `on-band-line` for outlines.

### Named Rules
**The One Band Rule.** At most one green band on a screen, and it holds the next thing to do. Everything else is paper.

**The No Red Guilt Rule.** Terracotta marks time and form errors, never a task that was not done. The words are "Not yet".

## Typography

**Display Font:** Roboto (with system-ui, -apple-system, Segoe UI, Arial)
**Body Font:** Roboto (same stack)

**Character:** One plain, familiar sans, which is what he asked for. The file ships with the app (`fonts/roboto.woff2`, one variable file, SIL Open Font License), so it looks the same on the phone and the computer and nothing is fetched from another site. Calm comes from light weights and air, not from a fancy face.

### Hierarchy
- **Headline** (400, 30px, 26px on phones): the page name, in deep sage, centered on the new screens.
- **Band title** (400, 28px, 24px on phones): the task on the green band, in gold cream.
- **Title** (500, 20px): headings of older sections and windows.
- **Body** (400, 16px, line height 1.55).
- **Label** (400, 13px, capitals, 0.09em spacing): the tabs, the date on Today, small section heads, the two buttons on the band.
- **Meta** (400, 13px): lengths, times, status words.

### Named Rules
**The Light Hand Rule.** Weights are 400 and 500. Nothing is bold.

**The Capitals Are Small Rule.** Capitals with wide spacing are only for labels of 13px or less. Never for a sentence.

## Layout

One centered column, 640px at most, on every screen size. On a phone the side padding is 16px and there is a fixed bottom bar with four items: Today, Plan, Calendar, Goals. On a computer the same four are in the header, centered, as spaced capitals with a thin line under the current one, like the head of the invitation.

Today, top to bottom: the date as a small label, the green band (edge to edge, text centered), the rest of the day as rows, the add line. Plan: the title, the add line, what matters, everything else, today's calendar. Sections are separated by space and hairlines, not by boxes.

Older screens (the day builder, Goals, Calendar, Settings, the task form) still use their wider layouts with cards. They carry the new colors, type and buttons.

## Elevation & Depth

Flat. Depth appears only when something floats over the page.

### Shadow Vocabulary
- **Window** (`box-shadow: 0 20px 48px rgb(51 55 47 / 22%)`): the dialog, over a 35% ink backdrop.
- **Toast** (`box-shadow: 0 8px 24px rgb(0 0 0 / 20%)`): messages above the bottom bar.

## Shapes

Buttons, the add line and the "how soon" choice are full pills with a 1px outline. Cards are 14px, windows 18px, inputs 12px. The band has square corners and runs edge to edge. The logo is a thin circle with the letters IO inside.

## Components

### Buttons
- **Shape:** pill, 44px tall, 15px text at weight 400, 1px outline in `field`. They are as wide as their words, never full width.
- **Primary:** filled Sage with paper text. One per screen.
- **On the band:** "Start 1 minute" is a paper pill with sage text; "Done" is an outline pill. Both use the small spaced capitals.
- **Link:** sage text with a thin underline.
- **Focus:** a 2px sage outline, 3px away (gold cream on the band).

### The band (signature)
- Band Green, edge to edge, text centered: the task in gold cream, its first small step, the two pills, then the time and length in a quiet line.

### Day list
- One row per task or calendar event, in time order, hairlines between. A round check on the left (tap for done, tap again to undo), the time, the name, a meta line. Tapping the name starts it; three dots open it. Events have a small dot and no check.

### Plan list
- One row per task: a star (tap to say it matters), the name, and a "how soon" pill with plain choices (No date, Today, Tomorrow, This week, Next week, Pick a date). Starred rows are on top; the app orders the rest.

### Add line
- One pill-shaped field with a mic and a round send button. The send button turns sage once there is text. Three text choices appear under it only while he is in the box.

### Cards and inputs (older screens)
- Cards are sheets (`card`) with a faint hairline. Inputs are 52px tall with a 1px outline and 12px corners.

### Navigation
- **Phone:** bottom bar on paper, icon above an 11px label, sage when current.
- **Computer:** spaced capitals in the header, a thin line under the current one.

### Marks
- A drawn star, filled soft gold, for what matters. Older screens still show text symbols (★!, !, 🤔); replace them when those screens are redone.

## Do's and Don'ts

### Do:
- **Do** keep content in the centered 640px column on new screens.
- **Do** keep buttons small pills, as wide as their words.
- **Do** use one green band at most per screen.
- **Do** draw icons as SVG in one stroke weight.
- **Do** write times as 12-hour with AM/PM, and say "Not yet" for unfinished work.
- **Do** check every screen at 390px and at 1366px.

### Don't:
- **Don't** use bold type, full-width buttons, or boxes inside boxes.
- **Don't** use red, counts or lists to show what was missed.
- **Don't** add streaks, points or scores.
- **Don't** add pill chips, colored side stripes or text symbols to new work.
- **Don't** use em dashes in any text.
- **Don't** add a framework or a build step; the app is plain HTML, CSS and JavaScript.
