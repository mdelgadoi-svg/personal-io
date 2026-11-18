# Literature memo: obsession, passion, and how to code them in founder speech

Study: "Obsessed Enough to Fund? Obsession, Passion and How Venture Capital Selects Founders." Prepared Nov 18, 2026.

**How to read the citations.** Every source cited was opened in this session. The tag shows how far I got: **[full]** = full text read, **[abstract]** = abstract only (publisher sites blocked automated access, so several classics are abstract only), **[preprint]** = not peer reviewed. The checkable quote behind each claim is in `research/source_notes/`. Papers I found but could not read are listed at the end and support no claim here.

## 1. How the literature defines and measures passion vs obsession

**Obsession is not the opposite of passion. Obsessive passion is one of two kinds of passion.** Vallerand defines passion as "a strong inclination toward an activity that people like, that they find important, and in which they invest time and energy." Harmonious passion (HP) is "an autonomous internalization that leads individuals to choose to engage in the activity." Obsessive passion (OP) is "a controlled internalization of an activity in one's identity that creates an internal pressure to engage in the activity that the person likes" [Vallerand 2003, abstract]. Both involve loving the work. They differ in control and in fit with the rest of life: OP brings an "uncontrollable urge" [Vallerand 2021, full], "negative affect and rigid persistence" [Vallerand 2003], conflict with other parts of life [Tóth-Király 2017, full] and self-esteem that depends on the activity [Mageau 2011, abstract].

**The Passion Scale** has two 6-item subscales, validated on 3,571 people across activities [Marsh 2013, abstract; Vallerand 2021]. Item wording, as reprinted in open papers [Tóth-Király 2017; Zhu 2025, full]: HP "in harmony with the other activities in my life", "a passion, that I still manage to control"; OP "The urge is so strong. I can't help myself", "My mood depends on me being able to do", "If I could, I would only do my activity". Three facts shape the coding:
1. **HP and OP go together** (r = .59 to .72 in one sample [Tóth-Király 2017]; .40 in another [Peixoto 2023, full]). Score them as two dimensions, not two ends of one line.
2. **The word "obsessed" is a weak marker.** The one item that uses it ("almost an obsessive feeling") also loads on HP [Tóth-Király 2017].
3. **Long hours are not OP.** Time and energy are part of all passion.

**Jachimowicz et al.** define passion as "a strong feeling toward a personally important value/preference that motivates intentions and behaviors to express that value/preference", not limited to positive emotion [Jachimowicz 2018, full; Prof. Bailey is a co-author]. Observers reward expressed passion with status and support [Jachimowicz 2019, abstract].

**Krautter's PEBS** [Krautter 2025, accepted manuscript read in full]. Earlier work looked only at animated displays. The Passion Expressions and Behaviors Scale has 21 items in seven factors: quality of work, positive emotions, body language and voice, quantity of work, negative emotions, social interactions, immersion. Extraverts are rated as more passionate at the same felt passion because they express it more often and in more ways; five factors correlate with extraversion (r = .16 to .29), immersion does not. A transcript cannot show body language and voice. It can show emotions in words and the founder's own account of quality, quantity and immersion. Observers rated positive emotions and quality of work as the most telling signs, body language less so.

**Cardon** defines entrepreneurial passion as "consciously accessible intense positive feelings experienced by engagement in entrepreneurial activities associated with roles that are meaningful and salient to the self-identity of the entrepreneur" [Cardon 2009, abstract; definition as reprinted in Li 2022, full], measured as positive feelings plus identity ("an important part of who I am") for inventing, founding and developing [Zhou 2022, full]. Chen et al. found "preparedness, not passion, positively impacted decisions to fund ventures" [Chen 2009, abstract].

**"Obsession" as investors use it** has no peer-reviewed definition that I could find; one conceptual paper says it still needs defining [Fisher 2013, abstract]. Observers read OP as moral suspicion mixed with "dedication, drive" [Gamez-Djokic 2026, abstract].

| Framework | Language markers visible in a transcript | Basis |
|---|---|---|
| Harmonious passion | free choice, harmony with other parts of life, staying in control, discovery | Scale wording |
| Obsessive passion | cannot stop, "the only thing", mood or self-worth depends on it, the work controls them, other parts of life pay for it | Scale wording and definitions |
| OP, extended | guilt when not working, giving up sleep or health | My inference, in no scale item |
| PEBS | enthusiasm; stress and exhaustion; care and craft; long hours; intense focus | The 21 items, as self-description |
| Cardon | excitement about inventing, founding, growing; "this is who I am" | Item wording |
| Lay "obsession" | the words obsessed or obsession, and their target | No source; own code |

## 2. Best practice for LLM coding of psychological constructs

- **Prompts.** Rathje et al. kept prompts "as close as possible to the instructions that human annotators were provided", one construct per call, with a short definition and a fixed scale [Rathje 2024, full]. A separate prompt per code raised kappa from .60 to .68; asking for a short rationale raised it from .59 to .68 [Dunivin 2024, preprint].
- **Accuracy.** GPT matched eight human raters at Spearman .59 to .77 on 1 to 7 ratings (dictionaries: .22 to .30). On harder constructs F1 fell below .20: "GPT may struggle more with more complex or difficult-to-define constructs" [Rathje 2024]. HP vs OP is that kind of construct, and Rathje's texts were tweets and headlines, not long answers.
- **Zero-shot vs few-shot.** Mixed: an example "sometimes did increase, but other times decreased performance" [Rathje 2024]; examples interfered with paragraph-length passages [Dunivin 2024]; few-shot helped on moral language [Abdurahman 2024, full]. Test both.
- **Codebook in the prompt.** Structured entries (definition, clarification, what does not count, examples) beat a raw codebook, but models leaned on the label more than the definition [Halterman & Keith 2025, full]. Short definitions are followed best [Törnberg 2024, preprint].
- **Validation.** Human labels first; tune on one part, freeze, report on a held-out part [Pangakis 2023, preprint; Törnberg 2024]. Report precision, recall, F1 and kappa for presence and Spearman for intensity, next to agreement among humans. Sizes: 111 passages [Dunivin 2024], 250 to 1,250 recommended [Pangakis 2023], at least 20 to 30 per category [Törnberg 2024].
- **Reliability.** "Even when the temperature is set to 0 ... GPT is not completely deterministic"; two runs a day apart agreed at kappa .93 to .99 [Rathje 2024]. Rewording a prompt can change answers [Reiss 2023, preprint]. Fix and record the model version.
- **Biases.** Over-labelling: recall beat precision in 20 of 27 tasks [Pangakis 2023]. Models are consistent even when wrong [Ziems 2024, full].
- **Regressions.** Using LLM labels directly biases estimates "even with high surrogate accuracy of 80-90%" [Egami 2023, full]; prompt and model choices alone flipped conclusions in about 31% of tested hypotheses [Baumann 2025, preprint].

## 3. Studies of founder and CEO language, and their confounds

I found no peer-reviewed study that codes founder podcast interviews and none that codes passion vs obsession with an LLM (a limited search, so "not found", not "does not exist").

| Study | Text and measure | Confounds handled |
|---|---|---|
| Freiberg & Matz 2023 [full] | Tweets of 10,541 founders; Big Five by machine learning | Pre-founding text only; minimum 50 tweets; year, industry, state controls |
| McCarthy 2023 [full] | Tweets, 21,187 startups; Big Five by a commercial tool | Minimum length. Names self-presentation and survivor bias as unsolved |
| Kanze 2018 [abstract] | Investor questions and founder answers at TechCrunch Disrupt | The question is the predictor: founders "tend to respond with matching regulatory focus" |
| Mesquiti & Seraj 2023 [full] | 19,536 earnings calls; dictionary | Unscripted speech only; rates, not counts |
| Chen 2009; Lucas 2016 [abstracts] | Pitches; rated passion and preparedness | Passion kept apart from preparedness; felt and perceived passion showed "a large misalignment" |
| Hu & Ma 2025 [abstract] | Pitch videos; visual, vocal, verbal positivity | Channels measured separately. Passionate pitches were funded more, then underperformed |
| Katcharovski & Maxwell 2025 [preprint] | 600 Shark Tank transcripts; LLM rubric | Human check on only 31 pitches |

Confounds this study must handle: **host questions** (answers mirror the question [Kanze 2018]); **self-presentation** (displayed is not felt passion [Lucas 2016]); **extraversion and talk time** ("Extraverts speak more" [Spitzley 2022, full]; [Krautter 2025]); **length** (minimums and rates [Freiberg 2023]); **format** (aired pitches are cut from an hour to 10 minutes [Pai 2025, full]; no study compares investor-hosted with independent shows); **transcript quality** (25% average word error in one study [Miner 2020, full]); **timing** (only pre-deal speech can speak to selection [Freiberg 2023]); **selection** into who is interviewed [McCarthy 2023].

## 4. Obsessive vs harmonious passion and rigidity, adaptation, pivoting

**Strong as theory, supported outside startups, untested for pivots.** I found no study with passion type as predictor and pivoting or adaptation in startups as outcome. The hypothesis is open.

- **Theory.** OP hinders adaptation "by causing negative affect and rigid persistence" [Vallerand 2003]. Here "rigid" means staying in the activity at a cost to the rest of life, not refusing to change strategy inside the venture. A pivot keeps the founder in the venture, so OP may predict refusing to quit more than refusing to pivot.
- **Support.** In five lab studies OP, not HP, predicted suppressing alternative goals [Bélanger 2013a, abstract]. Six studies with over 3,000 people tie rigid persistence to OP and flexible persistence to HP [Vallerand 2023, abstract]; in 400 workers OP correlated .52 with rigid persistence, but HP also .34 [Peixoto 2023]. HP went with flexibility in later-career transitions [Bonneville-Roussy 2026, abstract].
- **Founders.** The closest study is qualitative: 36 interviews link HP to "adaptive internationalization" and OP to "rigid internationalization" [Streeb 2026, abstract]. Pivot research shows identity limits revision [Grimes 2018, abstract] but does not measure passion type.
- **Against.** Leaders' OP predicted more job creation "particularly under increasing environmental dynamism" [Patel 2015, abstract]. In founders OP related positively to performance [Tu 2023, full] and to persisting [Fisher 2018, abstract]. OP also rises after firm results, good or bad [Lee 2024, full], so reverse causation is possible.

## 5. Public appearances for founders without a transcript

Saved in `data/appearance_candidates.csv` (all 286 deals).
- **The Excel holds no transcripts**, only links and quotes of up to 303 characters. The transcripts and papers folders were not in this session.
- **Founder names are often missing or wrong**: 140 deals say only "<Company> Team", and in at least 35 more the name is the investor who led the deal.
- **37 deals have a direct link.** The 30 YouTube links are real videos with matching titles (one, DualEntry, is a promo clip).
- **Web search** found real founder names for 228 deals and a candidate appearance for 108 more deals (67 high confidence): 145 deals now have a candidate, 141 have none.
- **Limits.** Search-found links were not opened; about 55 deals carry an "uncertain" note. Treat the file as leads to check.

## Implications for my design

1. **Score three things**: Vallerand's HP, Vallerand's OP, and the lay vocabulary of obsession with its target. Then the question "is investor obsession really obsessive passion?" becomes testable.
2. **Add five PEBS flags that text can show** (positive emotion, negative emotion, quality, quantity, immersion). State that body and voice are not measured.
3. **Call the measure "expressed passion language"**, not the founder's passion type.
4. **One construct per prompt**, wording that mirrors the coder instructions, a short rationale and a supporting quote. Choose zero-shot or few-shot on development data only.
5. **Grow the validation set.** One transcript gives about 40 to 60 passages; the literature suggests 100 to 250 and 20 to 30 positive cases per construct. OP language may be rare, so sample passages from several founders.
6. **Temperature 0 is not available** on current Claude models (they reject the setting; checked in the API reference bundled with this session, to confirm on Anthropic's site). Reliability must come from repeat runs, a fixed model version and test-retest agreement.
7. **Protect the outcome analysis**: main test on human-coded data where possible, results shown across prompt wordings, analysis plan written before looking at outcomes.
8. **Treat the host question as data**, and record host type, date against the deal, length and transcript source for every appearance.
9. **Control for talkativeness**: words spoken, share of talk time, positive-emotion rate.
10. **Do not use the Excel column "Obsession vs. Passion Coding".** It has no codebook behind it and mixes investor wording with founder wording.

## Open questions for Prof. Bailey

1. **Comparison group.** All 286 deals were funded by the seven firms, so the data cannot show these firms select for obsession. Compare with founders backed by others, compare across the seven firms, or restate the question as descriptive?
2. **Outcome.** The Excel has deal size and valuation (147 of 286). Neither measures a good bet, and nothing measures adaptation. Should adaptation be coded from the transcripts (how founders describe changing course)?
3. **Timing.** Most appearances probably follow the investment, often on the investor's own show. Is post-deal speech acceptable if framed as description?
4. **Which obsession** is the construct of interest: Vallerand's OP, the investors' lay idea, or the gap between them?
5. **Rigidity.** In the model, rigid persistence means not letting go of the activity. Is "does not pivot" a fair reading, given Patel et al. 2015?
6. **Extraversion.** Without Big Five inference, is controlling for talk time and positive-emotion rate enough?
7. **Validation.** Is one transcript with four coders enough for a first check? Resolve disagreements by majority, discussion or mean?
8. **Unit.** Founder or company, when several founders exist and one appears?
9. **Ground truth.** Is it worth asking a few founders to fill in the 12-item Passion Scale?
10. **PEBS in text.** The PEBS is a self-report of behavior. Is coding founders' descriptions of those behaviors a fair use?
11. **Ethics.** The speech is public, but the study attaches psychological labels to named people. IRB review, or aggregate reporting only?

## References

Opened in full
- Abdurahman, S., et al. (2024). Perils and opportunities in using large language models in psychological research. PNAS Nexus, 3(7), pgae245. https://doi.org/10.1093/pnasnexus/pgae245
- Baumann, J., et al. (2025). Large Language Model Hacking: Quantifying the Hidden Risks of Using LLMs for Text Annotation. Preprint. https://arxiv.org/abs/2509.08825
- Dunivin, Z. O. (2024). Scalable Qualitative Coding with LLMs. Preprint. https://arxiv.org/abs/2401.15170
- Egami, N., Hinck, M., Stewart, B. M., & Wei, H. (2023). Using Imperfect Surrogates for Downstream Inference. NeurIPS 2023. https://arxiv.org/abs/2306.04746
- Freiberg, B., & Matz, S. C. (2023). Founder personality and entrepreneurial outcomes: A large-scale field study of technology startups. PNAS, 120(19), e2215829120. https://doi.org/10.1073/pnas.2215829120
- Halterman, A., & Keith, K. A. (2025). Codebook LLMs. Political Analysis, 34(2). https://doi.org/10.1017/pan.2025.10017 (read as https://arxiv.org/abs/2407.10747)
- Jachimowicz, J. M., Wihler, A., Bailey, E. R., & Galinsky, A. D. (2018). Why grit requires perseverance and passion to positively predict performance. PNAS, 115(40), 9980-9985. https://doi.org/10.1073/pnas.1803561115
- Katcharovski, Y., & Maxwell, A. L. (2025). Predicting Business Angel Early-Stage Decision Making Using AI. Preprint. https://arxiv.org/abs/2507.03721
- Krautter, K., Büchner, A., & Jachimowicz, J. M. (2025). Extraverts Reap Greater Social Rewards From Passion Because They Express Passion More Frequently and More Diversely. Personality and Social Psychology Bulletin, 51(7), 1159-1172. https://doi.org/10.1177/01461672231211843 (read as the accepted manuscript, https://osf.io/43vh8)
- Lee, S., Lee, Y., & Park, K. M. (2024). Performance feedback and obsessive passion. PLOS ONE, 19(4), e0302180. https://doi.org/10.1371/journal.pone.0302180
- Li, M., Makino, S., Luo, L., & Jiang, C. (2022). Entrepreneurial passion and organizational innovation. Asia Pacific Journal of Management. https://doi.org/10.1007/s10490-022-09853-6
- McCarthy, P. X., et al. (2023). The impact of founder personalities on startup success. Scientific Reports, 13, 17200. https://doi.org/10.1038/s41598-023-41980-y
- Mesquiti, S., & Seraj, S. (2023). The psychological impacts of the COVID-19 pandemic on business leadership. PLOS ONE, 18(10), e0290621. https://doi.org/10.1371/journal.pone.0290621
- Miner, A. S., et al. (2020). Assessing the accuracy of automatic speech recognition for psychotherapy. npj Digital Medicine, 3, 82. https://doi.org/10.1038/s41746-020-0285-8
- Pai, J., Chou, E. Y., & Halevy, N. (2025). The Humor Advantage. Personality and Social Psychology Bulletin, 51(8), 1330-1344. https://doi.org/10.1177/01461672231214462
- Pangakis, N., Wolken, S., & Fasching, N. (2023). Automated Annotation with Generative AI Requires Validation. Preprint. https://arxiv.org/abs/2306.00176
- Peixoto, E. M., et al. (2023). Psychometric properties and measurement invariance of the Rigid and Flexible Persistence Scale. Psicologia: Reflexão e Crítica, 36(1). https://doi.org/10.1186/s41155-022-00240-0
- Rathje, S., Mirea, D.-M., Sucholutsky, I., Marjieh, R., Robertson, C. E., & Van Bavel, J. J. (2024). GPT is an effective tool for multilingual psychological text analysis. PNAS, 121(34), e2308950121. https://doi.org/10.1073/pnas.2308950121
- Reiss, M. V. (2023). Testing the Reliability of ChatGPT for Text Annotation and Classification. Preprint. https://arxiv.org/abs/2304.11085
- Spitzley, L. A., et al. (2022). Linguistic measures of personality in group discussions. Frontiers in Psychology, 13, 887616. https://doi.org/10.3389/fpsyg.2022.887616
- Törnberg, P. (2024). Best Practices for Text Annotation with Large Language Models. Preprint. https://arxiv.org/abs/2402.05129
- Tóth-Király, I., Bőthe, B., Rigó, A., & Orosz, G. (2017). An Illustration of the Exploratory Structural Equation Modeling Framework on the Passion Scale. Frontiers in Psychology, 8, 1968. https://doi.org/10.3389/fpsyg.2017.01968
- Tu, Y., et al. (2023). Obsessive passion, opportunity recognition, and entrepreneurial performance. Frontiers in Psychology, 13, 1037250. https://doi.org/10.3389/fpsyg.2022.1037250
- Vallerand, R. J., Paquette, V., & Richard, C. (2021). The Role of Passion in Psychological and Cardiovascular Responses. Frontiers in Psychology, 12, 744629. https://doi.org/10.3389/fpsyg.2021.744629
- Zhou, X., Zhang, L., & Su, X. (2022). Entrepreneurial Institutional Environment and Entrepreneurial Orientation. Frontiers in Psychology, 13, 840548. https://doi.org/10.3389/fpsyg.2022.840548
- Zhu, M., He, K., & Qiang, Z. (2025). Why does job insecurity influence employees proactivity differently? Frontiers in Psychology, 16, 1697231. https://doi.org/10.3389/fpsyg.2025.1697231
- Ziems, C., et al. (2024). Can Large Language Models Transform Computational Social Science? Computational Linguistics, 50(1). https://doi.org/10.1162/coli_a_00502

Abstract only (read the full paper through the Haas library before citing details)
- Bélanger, J. J., Lafrenière, M.-A. K., Vallerand, R. J., & Kruglanski, A. W. (2013a). When passion makes the heart grow colder. Journal of Personality and Social Psychology, 104(1), 126-147. https://doi.org/10.1037/a0029679
- Bonneville-Roussy, A., Perrier, L., Houlfort, N., & Vallerand, R. J. (2026). Navigating later-life transitions. Psychology and Aging, 41(6), 684-701. https://doi.org/10.1037/pag0000975
- Cardon, M. S., Wincent, J., Singh, J., & Drnovsek, M. (2009). The nature and experience of entrepreneurial passion. Academy of Management Review, 34(3), 511-532. https://doi.org/10.5465/amr.2009.40633190
- Chen, X.-P., Yao, X., & Kotha, S. (2009). Entrepreneur Passion and Preparedness in Business Plan Presentations. Academy of Management Journal, 52(1), 199-214. https://doi.org/10.5465/amj.2009.36462018
- Fisher, R., Maritz, A., & Lobo, A. (2013). Obsession in Entrepreneurs. Entrepreneurship Research Journal, 3(2). https://doi.org/10.1515/erj-2012-0009
- Fisher, R., Merlot, E., & Johnson, L. W. (2018). The obsessive and harmonious nature of entrepreneurial passion. International Journal of Entrepreneurial Behavior & Research, 24(1), 22-40. https://doi.org/10.1108/ijebr-01-2017-0011
- Gamez-Djokic, M., & Kouchaki, M. (2026). Passion as a Moral Cue. Personality and Social Psychology Bulletin. https://doi.org/10.1177/01461672261436552
- Grimes, M. G. (2018). The Pivot. Academy of Management Journal, 61(5), 1692-1717. https://doi.org/10.5465/amj.2015.0823
- Hu, A., & Ma, S. (2025). Persuading Investors: A Video-Based Study. The Journal of Finance, 80(5), 2639-2688. https://doi.org/10.1111/jofi.13471
- Jachimowicz, J. M., To, C., Agasi, S., Côté, S., & Galinsky, A. D. (2019). The gravitational pull of expressing passion. Organizational Behavior and Human Decision Processes, 153, 41-62. https://doi.org/10.1016/j.obhdp.2019.06.002
- Kanze, D., Huang, L., Conley, M. A., & Higgins, E. T. (2018). We Ask Men to Win and Women Not to Lose. Academy of Management Journal, 61(2), 586-614. https://doi.org/10.5465/amj.2016.1215
- Lucas, K., Kerrick, S. A., Haugen, J., & Crider, C. J. (2016). Communicating Entrepreneurial Passion. IEEE Transactions on Professional Communication, 59(4), 363-378. https://doi.org/10.1109/tpc.2016.2607818
- Mageau, G. A., Carpentier, J., & Vallerand, R. J. (2011). The role of self-esteem contingencies in the distinction between obsessive and harmonious passion. European Journal of Social Psychology, 41(6), 720-729. https://doi.org/10.1002/ejsp.798
- Marsh, H. W., et al. (2013). Passion: Does one scale fit all? Psychological Assessment, 25(3), 796-809. https://doi.org/10.1037/a0032573
- Patel, P. C., Thorgren, S., & Wincent, J. (2015). Leadership, Passion and Performance. British Journal of Management, 26(2), 211-224. https://doi.org/10.1111/1467-8551.12092
- Streeb, M. N., Drack, N., & Baum, M. (2026). Harmonious and obsessive passion as microfoundations of new venture internationalization. Journal of World Business, 61(5), 101746. https://doi.org/10.1016/j.jwb.2026.101746
- Vallerand, R. J., et al. (2003). Les passions de l'âme: On obsessive and harmonious passion. Journal of Personality and Social Psychology, 85(4), 756-767. https://doi.org/10.1037/0022-3514.85.4.756
- Vallerand, R. J., Chichekian, T., Verner-Filion, J., & Bélanger, J. J. (2023). The two faces of persistence. Motivation Science, 9(3), 175-192. https://doi.org/10.1037/mot0000303

Found but not read (no claim in this memo rests on them; worth getting)
- Cardon, M. S., Gregoire, D. A., Stevens, C. E., & Patel, P. C. (2013). Measuring entrepreneurial passion. Journal of Business Venturing, 28(3), 373-396. https://doi.org/10.1016/j.jbusvent.2012.03.003
- Curran, T., Hill, A. P., Appleton, P. R., Vallerand, R. J., & Standage, M. (2015). The psychology of passion: A meta-analytical review. Motivation and Emotion, 39(5), 631-655. https://doi.org/10.1007/s11031-015-9503-0
- Feuerriegel, S., et al. (2026). A reporting checklist for large language models in behavioural science. Nature Human Behaviour, 10(7), 1182-1186. https://doi.org/10.1038/s41562-026-02492-7 (two authors of Rathje et al. are co-authors; likely the checklist reviewers will expect)
- Pollack, J. M., Ho, V. T., O'Boyle, E. H., & Kirkman, B. L. (2020). Passion at work: A meta-analysis. Journal of Organizational Behavior, 41(4), 311-331. https://doi.org/10.1002/job.2434 (abstract read; tables not)
- Sirén, C., Patel, P. C., & Wincent, J. (2016). How do harmonious passion and obsessive passion moderate the influence of a CEO's change-oriented leadership on company performance? The Leadership Quarterly, 27(4), 653-670. https://doi.org/10.1016/j.leaqua.2016.03.002 (by its title, the closest quantitative design to your hypothesis)
- Warnick, B. J., Murnieks, C. Y., McMullen, J. S., & Brooks, W. T. (2018). Passion for entrepreneurship or passion for the product? Journal of Business Venturing, 33(3), 315-332. https://doi.org/10.1016/j.jbusvent.2018.01.002

The full list of everything opened (about 120 sources), with a checkable quote for each claim, is in `research/source_notes/`.
