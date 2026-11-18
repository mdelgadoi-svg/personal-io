# Codebook: passion and obsession in founder speech

Draft 1, Nov 18, 2026. For human coders and, later, for the LLM prompts (the prompts will reuse this wording). Not final until Marcelo and Prof. Bailey have reviewed it and the pilot is done.

## What we are coding

We code what founders **say** in public interviews. We are measuring expressed language, not what the founder privately feels and not a diagnosis of the person. A founder can talk like this in one passage and not in the next.

The key idea from the literature: **obsession is not the opposite of passion.** In Vallerand's model, harmonious passion and obsessive passion are two kinds of passion. Both involve loving the work, and one person can show both. So every passage gets a separate answer for each code. A passage can be 1 on harmonious and 1 on obsessive at the same time.

## Unit of analysis

- **A passage is one founder answer**, shown together with the host question that came before it. The question is context only. We never code the host's words.
- Long answers are split at sentence ends into passages of **about 200 words (150 to 300)**. Answers shorter than 40 words are joined to the next answer on the same question, or left out if they stand alone ("Yeah, exactly").
- Why this size: it is about one to two minutes of speech, long enough to hold one thought, short enough that a "1" points to something specific. It matches the paragraph-length units used in LLM coding studies, and it lets us report rates per passage and per 1,000 words.
- Only the founder's speech is coded. Co-founders are coded separately. Passages by hosts, investors or others are dropped.

## Rating format

For each passage:

1. **Self-relevant? (0/1).** Is the founder talking about their own relationship to the work: why they do it, how it feels, what it costs, how it fits in their life? If the passage is only about the product, the market or the technology, mark 0 and leave every other code at 0. Most passages will be 0. That is expected.
2. For **PAS, HP and OP**: presence (0/1) and, if present, intensity 1 to 7.
3. For **OBS** and the five **expression flags**: presence (0/1) only.
4. A **key quote** (the exact words that made you decide), a one-line **why**, and your **confidence** (1 = guess, 2 = fairly sure, 3 = sure).

**Intensity anchors (same for PAS, HP, OP)**

| Score | Meaning |
|---|---|
| 1 | Barely there. One weak or indirect phrase |
| 2 to 3 | Present but mild, or said in passing |
| 4 | Clear. One explicit statement |
| 5 to 6 | Strong. Explicit, repeated or elaborated |
| 7 | The whole passage is about this, in strong words |

Leave intensity empty when presence is 0.

**General rules**
- Code the founder's own experience. Not the team's ("our engineers work nights"), not the company's values ("we are customer obsessed" on a slide), not what an investor said about them.
- Code what is said, not how lively it sounds. An excited tone with no content about the founder's relationship to work is not passion. A calm sentence can be a 7.
- A story about the past counts ("in the first year I could not stop").
- When unsure, mark 0 with low confidence and say why. Your reasoning is what improves this codebook.

---

## Core constructs

### PAS: Passion (general)

**Definition.** The founder expresses a strong inclination toward their work: they like or love it, it is personally important to them, and they give it time and energy. (Vallerand et al., 2003; Jachimowicz et al., 2018: "a strong feeling toward a personally important value/preference".) This is the shared base of both kinds of passion.

**Language indicators**
- Love, enjoyment, excitement about the work itself ("I love this problem", "it's the most fun I've had").
- Personal importance or meaning ("this matters to me because...", a personal story behind the mission).
- Identity ("I'm a builder", "this is who I am").
- Strong feeling on behalf of the cause, including anger or frustration at the problem.

**Include** first-person statements of caring, loving, being drawn to the work.
**Exclude** market enthusiasm ("this is a huge opportunity"), product praise ("our product is amazing"), and polite enthusiasm for the interview.

**Draft examples** (from the short quotes in the Excel, not yet checked against the recordings)
- Biorce, Pedro Coelho (row 95): "When my father was diagnosed with cancer, we were lucky... Our goal is to make clinical trials 50% faster so all patients get that chance". PAS = 1, intensity about 5. Personal importance. Nothing here says harmonious or obsessive.
- Rillet, Nicolas Kopp (row 225): "Not everybody jumps out of bed wanting to build an ERP from the ground up." PAS = 1, intensity about 3. Implies he does.

### HP: Harmonious passion language

**Definition.** The founder describes engaging in the work **by free choice**, as something that **fits with the rest of their life** and that they **stay in control of**. (Vallerand et al., 2003: "an autonomous internalization that leads individuals to choose to engage in the activity that they like".)

**Language indicators** (the first four follow Passion Scale item wording)
- Harmony with other parts of life: family, health, friends, other interests are named as present and protected.
- Choice and control: "I get to do this", "I chose this", "I can switch off", "a passion I still manage to control".
- Discovery and variety: learning, new experiences, curiosity as the reward.
- Self-expression: the work reflects qualities they like in themselves.
- Flexible persistence (our extension): working hard while other things also matter; stepping back, changing course or letting go without feeling worthless.

**Include** statements that pair commitment with balance, choice or openness.
**Exclude** balance talk aimed at employees ("we want the team to rest"); generic wellness advice; passion with no information about choice or fit (that is PAS only).

**Draft examples.** The Excel has no founder quote that clearly shows harmonious passion (its snippets are too short). Until real transcripts are in, these are **invented illustrations, not real quotes**:
- "I love this work, and I also coach my daughter's team on Saturdays. I'm better at the company because I have a life outside it." HP = 1, intensity about 6.
- "We killed the first product after a year. It stung, but I was more curious about what was true than attached to being right." HP = 1, intensity about 4 (flexible persistence).

### OP: Obsessive passion language

**Definition.** The founder describes an **internal pressure or urge** to work that is **hard to control**, work that **crowds out or conflicts with** the rest of life, or **self-worth or mood that depends** on the work. (Vallerand et al., 2003: "a controlled internalization of an activity in one's identity that creates an internal pressure to engage in the activity that the person likes".) The founder still loves the work. What marks OP is loss of control, exclusivity, dependence or conflict.

**Language indicators** (the first five follow Passion Scale item wording)
- Urge and loss of control: "I can't help myself", "I can't stop", "it kept bugging me", "I couldn't not do it".
- Exclusivity: "it's the only thing I care about", "if I could, I would only do this".
- Dependence: "I can't imagine my life without it", "my mood depends on how the company is doing".
- Being controlled: "the company runs me", "it consumes me".
- Contingent self-worth: "if this fails, I'm nothing", needing the win to feel acceptable.
- Conflict and cost: relationships, health or other goals paying for the work, said as fact or regret.
- Rigid persistence: continuing regardless of conditions, "whatever it takes".
- (Our extension, not in the scale) guilt or anxiety when not working; giving up sleep or health as a necessity.

**Include** first-person statements of compulsion, exclusivity, dependence, conflict or contingent worth.
**Exclude**
- The word "obsessed" by itself. "We're obsessed with our customers" is OBS, not OP, unless one of the indicators above is also present.
- Long hours alone. Time and effort are part of all passion. Code QUANT.
- Stress alone. Code EMO-NEG.
- Ambition, competitiveness or confidence alone.
- Hiring demands ("we want people who go all in"). That is about others.

**Draft examples** (from the Excel, not yet checked against the recordings)
- Paid, Manny Medina (rows 176 and 254): "the problem kept on bugging me... you hedgehog into it and become the best at that one thing." OP = 1, intensity about 3. An urge he could not put down, plus narrowing to one thing. Mild: no conflict or dependence is stated.
- Delphi, Dara Ladjevardian (row 194): "the first year was so painful because no one believed in our product" and being "complete in grind mode". Borderline. Painful persistence and total work mode suggest OP at about 2, but nothing says he could not stop or that life outside paid for it. A good passage to discuss as a group.

**An invented illustration of a clear case, not a real quote:** "I haven't taken a day off in three years. When I'm not working I feel sick about it. If this company dies, I honestly don't know who I am." OP = 1, intensity 7.

### OBS: Obsession vocabulary

**Definition.** The founder uses the words obsessed, obsession, obsessive, obsess (or close synonyms used the same way: "maniacal about", "fanatical about") about themselves or their own way of working.

**Why it is separate.** Investors and founders use "obsessed" as praise. The literature gives no evidence that this word means obsessive passion: the one Passion Scale item that uses the word also goes with harmonious passion (Tóth-Király et al., 2017). Coding the word separately lets the study test what it actually goes with.

**Also record the target** in one or two words: customer, product, problem, craft or detail, mission, winning, metrics, the company itself, other.

**Include** "I'm obsessed with latency"; "I've always been an obsessive person".
**Exclude** the host's use of the word (code that under PROMPTED); "obsessed" about someone else.

**Draft examples** (from the Excel, not yet checked against the recordings)
- Freed, Erez Druk (row 262): the Excel describes him as a self-described lifelong serial obsessor ("saxophone, board game champion, then obsessed with startups"). OBS = 1, target = the company itself / startups. The wording is the Excel's paraphrase, so check the recording.
- Adaptive, Brian Long (row 187): the Excel says he "obsesses over Net Promoter Score". OBS = 1 only if he uses the word himself; target = metrics. This shows why the target matters: the Excel's own label for him is "Harmonious Passion".

---

## Expression flags (from the PEBS, presence only)

Krautter, Büchner and Jachimowicz (2025) list seven ways people express passion at work. Five can leave a trace in a transcript. Mark 1 when the founder says it about themselves. These flags describe the **channel** of expression. They do not say whether the passion is harmonious or obsessive.

| Code | PEBS factor | Mark 1 when the founder... | PEBS items it follows |
|---|---|---|---|
| EMO-POS | Positive emotions | says they are excited, enthusiastic, energized or motivated by their work | "I am enthusiastic about my work." "I am excited about my work." |
| EMO-NEG | Negative emotions | says they are stressed, anxious, strained or exhausted by their work | "I am stressed about my work." "I feel strained and exhausted." |
| QUAL | Quality of work | talks about their own care, craft, standards or attention to detail | "I put a lot of care into my work." |
| QUANT | Quantity of work | talks about their own long hours, weekends, extra work, no time off | "I work longer hours than expected without being told so." |
| IMM | Immersion | talks about intense focus, being carried away, losing track of time | "I get carried away by my work." "I lose my sense of time." |

**Not coded**
- **Body language and voice** ("I show animated facial expressions", "I vary the tone and pitch of my voice"): a transcript cannot show them. This is a stated limit of the study.
- **Social interactions** ("I become more talkative in conversations about my work"): in an interview everyone is talking about their work, so it cannot tell founders apart. Talk time is measured by the pipeline as a control.

**Draft examples** (from the Excel, not yet checked against the recordings)
- QUANT: Mirendil (row 119), hiring text quoted in the Excel: "an intense, all-in role with long hours at frontier-lab pace". This is about the role they hire for, not the founder's own behavior, so QUANT = 0 by our rule. A useful boundary case.
- EMO-NEG: Delphi (row 194): "the first year was so painful". EMO-NEG = 1.
- QUAL, IMM, EMO-POS: no clear founder quote in the Excel yet.

---

## Context codes

| Code | What to mark |
|---|---|
| PROMPTED (0/1) | The host's question itself invites passion or obsession talk ("What are you obsessed with?", "How many hours do you work?", "What did you sacrifice?"). Research on pitch Q&A shows founders answer in the frame of the question, so prompted and unprompted passages will be analyzed separately |

**Optional module, to decide with Prof. Bailey: adaptation.** The research question asks about founders who need to adapt, and the Excel has no adaptation outcome. Two extra flags could be coded from the same passages: **ADAPT** (the founder describes changing course because of evidence or feedback) and **RIGID** (the founder describes holding course against evidence or advice, and presents that as right). They are left out of the first coding round to keep the task small.

---

## Decision rules for hard cases

1. **"Obsessed" with no other marker** → OBS = 1, OP = 0. PAS depends on the rest of the passage.
2. **Long hours stated with pride and nothing else** → QUANT = 1, PAS probably 1, OP = 0.
3. **Long hours plus "I couldn't stop" or "my family paid for it"** → QUANT = 1 and OP = 1.
4. **"This company is who I am"** → PAS = 1 (identity). OP only if worth or mood depends on it ("if it fails, I'm nothing").
5. **Sacrifice told as a past phase the founder has since changed** ("I burned out, now I protect my weekends") → code both: OP for the past, HP for the present. Say so in the why field.
6. **Persistence through rejection** ("everyone said no") → PAS if tied to caring. OP only with "whatever it takes", compulsion or cost. Persistence alone is neither.
7. **Killing a product or pivoting calmly** → HP (flexible persistence) only if the founder links it to how they relate to the work. A plain business account of a pivot is self-relevant = 0.
8. **Humor and exaggeration** ("I basically live at the office, ha") → code at low intensity and flag low confidence.
9. **Company slogans** ("customer obsession is one of our values") → not the founder's own state. All 0, unless the founder adds a first-person statement.

---

## Confounds and how each is handled

| Confound | Why it matters | Control |
|---|---|---|
| Extraversion and expressiveness | Extraverts are rated as more passionate at the same felt passion, and speak more (Krautter et al., 2025; Spitzley et al., 2022) | Code content, not liveliness (rule above). Report rates per passage and per 1,000 words. Use words spoken, share of talk time and positive-emotion word rate as controls. No Big Five inference, per the advisor |
| Talk time and length | More speech gives more chances for a code to appear | Fixed passage size. Minimum words per founder (proposed: 1,500 words of founder speech). Shares and rates, never raw counts |
| Host questions | Answers mirror the question's frame (Kanze et al., 2018) | PROMPTED flag. Analyze unprompted passages as the main result. Keep the question text with every passage |
| Interview format and audience | The investor's own podcast is partly marketing for the investment. Edited shows are a selected sample of what was said | Record for each appearance: show, host type (investor-owned or independent), live or edited, solo or with co-founder, length. Use show type as a control and report results by host type |
| Timing | After a deal, founders may echo the investor's language. Passion also shifts with results (Lee et al., 2024) | Record the appearance date against the deal date. Report pre-deal and post-deal appearances separately |
| Self-presentation | Public talk is displayed passion, and presentation skill drives the gap from felt passion (Lucas et al., 2016) | Name the measure "expressed passion language". Do not claim inner states |
| Transcript quality | Automatic transcripts carry errors that differ by speaker and can move scores (Miner et al., 2020; Zolnoori et al., 2024) | Record the transcript source. Hand-check a sample and report the error rate and wrong-speaker rate |
| Selection | Founders who are interviewed differ from those who are not | Start from the list of deals, not from the list of podcasts. Report who has no appearance and compare the two groups on deal size, stage and sector |
| Coder expectations | Knowing the hypothesis or the company's success can color coding | The human coder codes before seeing the AI's scores, and does not look at deal size, valuation or the Excel's old labels while coding |

---

## How this codebook will be refined

Pilot first, on 2 or 3 interviews (see `process_map.md`).

1. Marcelo codes the passages of one interview by hand, using `human_coding/coding_sheet.csv` and `human_coding/instructions.md`, before seeing any AI scores.
2. The AI codes the same passages. Every disagreement is read, and the written reasons are used to tighten definitions and decision rules. Changes go in `decisions_log.md`.
3. With only one human coder there is no agreement between people to report. Two ways to get a check: (a) ask one other person (Prof. Bailey, a classmate) to code 30 to 40 of the same passages, or (b) Marcelo codes a random 30 passages a second time a week later, without looking at the first answers.
4. The draft examples above are replaced with real passages from the pilot.

## Sources for the constructs

- Vallerand, R. J., et al. (2003). Les passions de l'âme: On obsessive and harmonious passion. Journal of Personality and Social Psychology, 85(4), 756-767. https://doi.org/10.1037/0022-3514.85.4.756 (definitions; abstract read)
- Passion Scale item wording as reprinted in Tóth-Király et al. (2017), https://doi.org/10.3389/fpsyg.2017.01968, and Zhu, He & Qiang (2025), https://doi.org/10.3389/fpsyg.2025.1697231 (both read in full). The scale's own validation paper is Marsh et al. (2013), https://doi.org/10.1037/a0032573 (abstract read).
- Jachimowicz, J. M., Wihler, A., Bailey, E. R., & Galinsky, A. D. (2018). PNAS, 115(40), 9980-9985. https://doi.org/10.1073/pnas.1803561115 (read in full)
- Krautter, K., Büchner, A., & Jachimowicz, J. M. (2025). Personality and Social Psychology Bulletin, 51(7), 1159-1172. https://doi.org/10.1177/01461672231211843 (accepted manuscript read in full, https://osf.io/43vh8; items in `research/source_notes/q1b_krautter_pebs_full_text.md`)
- Mageau, G. A., Carpentier, J., & Vallerand, R. J. (2011). European Journal of Social Psychology, 41(6), 720-729. https://doi.org/10.1002/ejsp.798 (contingent self-worth; abstract read)
- Full reasoning and quotes: `research/literature_memo.md` and `research/source_notes/`.
