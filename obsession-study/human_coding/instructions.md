# How to code the transcript (one page)

Plan about 90 minutes per interview. Code before looking at any AI scores. There are no right answers yet: your reasons are what improves the codebook.

## What you are doing
You will read one founder interview, cut into short passages, and mark what kind of language the founder uses about their own work. We are coding **what is said**, not judging the person.

## Before you start
1. Read `codebook.md` once (15 minutes). The parts that matter most: the definitions of PAS, HP and OP, and the "Decision rules for hard cases".
2. Open `coding_sheet.csv` in Excel or Google Sheets. Save your copy as `coding_sheet_<your initials>_<interview>.csv`. The four rows marked EXAMPLE show how a filled row looks. They are invented.
3. Put your initials in `coder_id` on every row you code.

## For each passage
Read the host question (context only), then the passage. Fill in, left to right:

1. **self_relevant** (0 or 1): is the founder talking about their own relationship to the work (why they do it, how it feels, what it costs, how it fits their life)? If it is only product, market or technology, put 0, put 0 in every other code, and go to the next passage. Most passages will be 0.
2. **PAS** (passion in general): do they say they love the work, that it matters to them personally, or that it is part of who they are? Present 0/1, then intensity 1 to 7.
3. **HP** (harmonious): do they describe the work as freely chosen, under their control, fitting with the rest of their life? Present 0/1, then intensity.
4. **OP** (obsessive): do they describe an urge they cannot control, work as the only thing, mood or self-worth depending on it, or the rest of life paying for it? Present 0/1, then intensity.
5. **OBS_word**: do they use the word obsessed, obsession or obsessive about themselves? If yes, write what it is aimed at in **OBS_target** (customer, product, problem, craft, mission, winning, metrics, the company, other).
6. Five quick flags (0/1), only about the founder: **EMO_POS** (says they are excited or enthusiastic), **EMO_NEG** (stressed, anxious, exhausted), **QUAL** (their own care and standards), **QUANT** (their own long hours or extra work), **IMM** (intense focus, losing track of time).
7. **PROMPTED** (0/1): did the host's question itself ask about passion, obsession, hours or sacrifice?
8. **key_quote**: copy the few words that made you decide.
9. **why**: one line in your own words. This is the most useful column.
10. **confidence**: 1 = guess, 2 = fairly sure, 3 = sure.

## Intensity, 1 to 7
1 = barely there, one weak phrase. 4 = clear, one explicit statement. 7 = the whole passage is about this, in strong words. Leave it empty when present is 0.

## Five rules that prevent most disagreements
- HP and OP are not opposites. A passage can be 1 on both, or 0 on both.
- The word "obsessed" alone is OBS, not OP.
- Long hours alone are QUANT, not OP.
- Code the founder, not the team, the company values or the investor.
- Code the content, not the energy. A calm sentence can be a 7.

## When you are stuck
Put 0, set confidence to 1, and write what made it hard in `notes`. Do not skip the passage.

## When you are done
Save the file in `human_coding/`. In `notes` on the last row, add two or three lines: which codes were hardest to tell apart, and anything in the interview that felt important but had no code.

## If someone else helps
The same page works for a second person. They code alone, without seeing your answers.
