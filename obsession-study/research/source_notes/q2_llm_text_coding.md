# Q2 notes: best practice for LLM coding of psychological constructs in text (2023 to 2026)

Prepared 17 Nov 2026. Every citation detail below comes from a page or API response retrieved in this session. Quotes are verbatim and under 40 words. Preprints are marked. Nothing here is cited from memory.

Access note: OpenAlex search was out of budget for the day (single DOI lookups still worked), Semantic Scholar search was rate limited, and nature.com, hal.science and osf.io downloads were blocked. Discovery therefore ran through Crossref search, Europe PMC search, arXiv abstract pages and 2 web searches.

---

## 1. Answer

**Prompt design.** Start from the instructions the human coders get, then add a fixed answer format. Rathje et al. kept prompts "as close as possible to the instructions that human annotators were provided" and asked for a number only [Rathje2024]. Pangakis et al. and Gilardi et al. also give humans and the model the same codebook [Pangakis2023] [Gilardi2023]. Code one construct per call: agreement rose from kappa 0.60 to 0.68 when each code had its own prompt [Dunivin2024], and Chew et al. iterate code by code for codes that can co-occur [Chew2023]. Put the passage first, the question after it, state the allowed answers, and ask for JSON when more than one field comes back [Ziems2024] [Tornberg2024].

**Zero-shot vs few-shot.** The evidence is mixed, so test both on development data. Rathje found one example "sometimes did increase, but other times decreased performance" [Rathje2024]. Ziems found few-shot gains "spotty and inconsistent" [Ziems2024]. Dunivin found examples interfered with paragraph-long passages [Dunivin2024]. Abdurahman et al. found few-shot helped on moral language (F1 0.22 to 0.32) [Abdurahman2024], and Baumann et al. recommend few-shot [Baumann2025]. A 2026 benchmark found popular prompt techniques have "inconsistent and sometimes negative effects" [McLaren2026].

**Codebook in the prompt.** A structured codebook (label, one-sentence definition, clarification, what does not count, positive and negative examples) beat the original codebook format on 2 of 3 datasets, but small open models still followed it poorly, leaned on the label name more than the definition, and changed answers when category order changed [HaltermanKeith2025]. Keep definitions short [Dunivin2024] [Tornberg2024]. Harmonious vs obsessive passion is a theory-specific distinction, the kind of expert taxonomy LLMs find hard [Ziems2024] [Rathje2024], so the definition must carry the meaning, not the label.

**Reasoning or a supporting quote.** Asking for a short justification before the code raised mean kappa from 0.59 to 0.68 [Dunivin2024]. Treat the rationale as an audit aid, not as proof of how the model decided [Chew2023] [Tornberg2024]. No opened source tested a verbatim supporting quote specifically.

**Validation design and metrics.** Human labels come first, then the model, task by task [Pangakis2023] [Abdurahman2024] [Tornberg2024]. Split the human-coded set: tune the prompt on one part, freeze it, then report on a held-out part [Pangakis2023] [Tornberg2024] [McLaren2026]. Report precision, recall and F1, not accuracy alone, plus Cohen's kappa or Krippendorff's alpha, and Spearman correlation for 1 to 7 intensity ratings against the mean of the human coders [Rathje2024] [Tornberg2024]. Compare model-human agreement with human-human agreement [Tornberg2024] [Gilardi2023]. Sample sizes used: 213 headlines rated by 8 annotators [Rathje2024], 111 gold passages [Dunivin2024], 100 documents per dataset [Chew2023], 250 to 1,250 recommended [Pangakis2023], at least 20 to 30 per category [Tornberg2024].

**Reliability.** Temperature 0 was the norm in the GPT-era studies but "GPT is not completely deterministic" [Rathje2024]; a 2026 tutorial saw the same [CarmonaDiaz2026]. Run the full coding twice and report kappa (Rathje: 0.93 to 0.99 one day apart). Test prompt paraphrases [Reiss2023] [Barrie2024]. Use one fixed model version and record it with all parameters [Tornberg2024] [Baumann2025]. Repeating each item and taking the modal answer flags hard cases [Pangakis2023].

**Known biases and failure modes.** Over-labelling: recall beat precision in 20 of 27 tasks [Pangakis2023]; zero-shot ChatGPT over-predicted moral content [Abdurahman2024]; GPT-4 pushed neutral texts to positive or negative [Rathje2024]. Agreement skewed toward some annotator profiles [Abdurahman2024]. Order effects [HaltermanKeith2025] [Pezeshkpour2023]. High self-consistency even when wrong [Ziems2024]. High human agreement does not predict safe automation [Baumann2025].

**Using imperfect labels in regressions.** Plugging LLM labels straight into a regression biases estimates even at 80 to 90% accuracy [Egami2023] [FongTyler2021] [TeBlunthuis2024]. Prompt and model choices alone produced wrong conclusions in about 31% of tested hypotheses for the best models [Baumann2025]. Keep a randomly sampled human-coded subset, use a correction (DSL, CDI, or the Fong and Tyler approach when the label is a predictor), or run the main test on human labels only, and pre-register the configuration [Egami2023] [Gligoric2024] [Baumann2025].

---

## 2. Sources opened

Access levels: FULL TEXT, ABSTRACT ONLY, METADATA ONLY (listed in section 3, not used for claims).

### A. Full text retrieved and read

**[Rathje2024]** Rathje S, Mirea D-M, Sucholutsky I, Marjieh R, Robertson CE, Van Bavel JJ. (2024). GPT is an effective tool for multilingual psychological text analysis. Proceedings of the National Academy of Sciences USA, 121(34), e2308950121. DOI 10.1073/pnas.2308950121. PMCID PMC11348013. Peer reviewed. FULL TEXT.
Retrieved: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11348013/fullTextXML
- Constructs: sentiment, discrete emotions, offensiveness, moral foundations; tweets, news headlines, Reddit comments; 12 languages; models GPT-3.5 Turbo, GPT-4, GPT-4 Turbo. Sample size is printed as n = 47,925 in the abstract and table note and n = 47,912 in the overview; the paper also says both "15 datasets" and "16 different datasets".
- Prompt style (quote): "Is the sentiment of this text positive, neutral, or negative? Answer only with a number: 1 if positive, 2 if neutral, and 3 if negative. Here is the text: [tweet, news headline or Reddit comment text]"
- Likert prompt (quote): "How much [emotion] is present in this headline on a 1 to 7 scale? Answer only with a number, with 1 being "no [emotion]" and 7 being "a great deal of [emotion]." Here is the headline:"
- Moral foundations prompt, one construct per call with a definition (quote): "Does the following Reddit comment express the moral foundation of [moral foundation] (i.e., [definition of moral foundation])? Please answer only with a number: 1 if yes and 0 if no."
- Mirroring human instructions (quote): "In most cases, we kept the GPT prompts as close as possible to the instructions that human annotators were provided". For moral foundations they also named the foundation "after pretesting found that this slightly improved accuracy".
- Metrics: accuracy and macro-averaged F1 for categories, Spearman correlation for Likert ratings. Zero-shot results, English sentiment: GPT-3.5 Turbo accuracy 0.673, F1 0.685; GPT-4 F1 0.633; GPT-4 Turbo F1 0.615. English discrete emotions F1: 0.720, 0.779, 0.782. English offensiveness F1 0.725 to 0.746. Average F1 across tasks: GPT-3.5 0.571, GPT-4 0.603, GPT-4 Turbo 0.653.
- Likert data: 213 headlines; "Manual annotations were made on a 1 to 7 scale by eight annotators, and averaged for each construct." Spearman with human ratings, GPT-4 Turbo: sentiment 0.77, anger 0.64, fear 0.59, joy 0.70, sadness 0.64 (average 0.67); GPT-4 average 0.69; GPT-3.5 Turbo average 0.63.
- Dictionaries (LIWC 2015 for sentiment, NRC for emotions, with negation handling): Spearman 0.22 to 0.30, average 0.28; all differences from GPT significant (all Ps < 0.001). Dictionary and GPT outputs correlated only 0.12 to 0.38 with each other.
- Complex constructs: moral foundations accuracy 0.899 to 0.980 but driven by true negatives; F1 for care 0.534 (GPT-4), proportionality 0.174, purity 0.192. Quote: "Thus, GPT may struggle more with more complex or difficult-to-define constructs."
- Few-shot: one example from the same dataset was added to the prompt (GPT-4, first 6 datasets). Quote: "finding this sometimes did increase, but other times decreased performance". The numbers are in SI Table S2, which I could not open.
- Temperature (quote): "We used a temperature of 0 to obtain the highest probability predictions of the models." Reliability (quote): "Even when the temperature is set to 0 (which provides GPT's most deterministic output), GPT is not completely deterministic". Two GPT-4 Turbo runs 1 day apart: weighted Cohen's kappa 0.93 to 0.99. They note "other work has reported lower reliability if GPT runs are several months apart".
- Version drift: Spearman between model versions on the same items 0.67 to 0.79 (GPT-3.5 Turbo vs GPT-4) and 0.76 to 0.86 (vs GPT-4 Turbo).
- Bias noted: "GPT-4 was more likely to classify "neutral" tweets as either "positive" or "negative" compared to GPT-3.5 Turbo".
- Limitations they list: validation is only against human annotators, not against what the writer felt ("One limitation of our work is that we only compare GPT's responses to the judgments of human annotators."); human gold standard is imperfect and annotators disagree; no annotator demographics; black box ("it is difficult to know why it is producing the responses it provides"); zero-shot usually below fine-tuned models; possible cultural and in-group biases; API cost; privacy of text sent to the API; model changes over time; possible training-data contamination for public datasets; LIWC was not built to match annotator sentiment.

**[Gilardi2023]** Gilardi F, Alizadeh M, Kubli M. (2023). ChatGPT outperforms crowd workers for text-annotation tasks. Proceedings of the National Academy of Sciences USA, 120(30), e2305016120. DOI 10.1073/pnas.2305016120. PMCID PMC10372638. Peer reviewed (brief report). FULL TEXT.
Retrieved: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10372638/fullTextXML
- n = 6,183 tweets and news articles; tasks: relevance, stance, topics, frames; model gpt-3.5-turbo; gold standard from 3 trained political science students.
- Quote: "the zero-shot accuracy of ChatGPT exceeds that of crowd workers by about 25 percentage points on average". Absolute accuracy was moderate (relevance tasks 59% to 83%).
- Same instructions for all coders (quote): "We used the exact same wordings for ChatGPT and MTurk."
- Temperature and consistency (quote): "intercoder agreement is about 56% for MTurk, 79% for trained annotators, 91% for ChatGPT with temperature = 1, and 97% for ChatGPT with temperature = 0.2". Agreement is percent agreement, not chance corrected.

**[Ziems2024]** Ziems C, Held W, Shaikh O, Chen J, Zhang Z, Yang D. (2024). Can Large Language Models Transform Computational Social Science? Computational Linguistics, 50(1). DOI 10.1162/coli_a_00502. Peer reviewed. FULL TEXT (arXiv v3, which carries the journal typesetting).
Retrieved: https://arxiv.org/pdf/2305.03514 ; DOI checked through https://api.crossref.org/works?query.bibliographic=...
- 13 language models, 25 English benchmarks (the body text also says 24 tasks). Quote: "LLMs fail to outperform the best fine-tuned models but still achieve fair levels of agreement with humans".
- Quote: "Human validation is key to avoiding a replication crisis in CSS caused by LLM hallucinations and inaccuracies."
- Few-shot (3 and 5 examples, FLAN models), Table 5 caption: "Few-shot Classification does not uniformly improve performance across our selected CSS benchmark tasks."
- Prompt guidelines (Table 1): give instructions after the text, list the options one per line, state what to do when uncertain, and "When the answer should contain multiple pieces of information, request responses in JSON format."
- Self-agreement is not accuracy (quote): "LLMs demonstrate high internal agreement, even when inaccurate".
- Expert taxonomies with "specialized or nonstandard definitions of colloquial terms" are named as a main challenge.

**[Pangakis2023]** Pangakis N, Wolken S, Fasching N. (2023). Automated Annotation with Generative AI Requires Validation. arXiv:2306.00176 (v1, 31 May 2023). PREPRINT. FULL TEXT.
Retrieved: https://arxiv.org/pdf/2306.00176
- GPT-4, 27 annotation tasks from 11 non-public datasets from published articles. Quote: "we report a median accuracy of 0.850 and a median F1 of 0.707". Quote: "nine of the 27 tasks had either precision or recall below 0.5". Recall exceeded precision in 20 of 27 tasks.
- Workflow: codebook, expert coding of a random subset by at least two subject matter experts, model codes a first part, refine the codebook, final test on the rest. Quote: "Performance on this held-out data should be used to determine whether an LLM can be effectively utilized for automated annotation."
- Sample size (quote): "the number of samples annotated should range between 250 and 1,250 random text samples".
- Consistency score: each item coded at least 7 times at temperature 0.6. Quote: "accuracy is 19.4 percentage points higher for text samples labeled with a consistency score of 1.0".
- Prompt refinement helped only a little (quote): "the subtleties of prompt construction do not appear to be a significant lever on performance".

**[Tornberg2024]** Törnberg P. (2024). Best Practices for Text Annotation with Large Language Models. arXiv:2402.05129 (5 Feb 2024). PREPRINT (no journal version verified). FULL TEXT.
Retrieved: https://arxiv.org/pdf/2402.05129
- Held-out validation (quote): "it is not acceptable to use the validation data to improve the prompts, as this may lead to falsely reporting higher precision".
- Sample size (quote): "The practical minimum is to have at least 20-30 samples of each category for a basic level of confidence in the performance metrics".
- Metrics: accuracy alone is not enough; F1 with precision and recall, weighted F1, ROC-AUC or Cohen's kappa for classes; correlation, MAE or MSE for numeric ratings. Human benchmark (quote): "Ideally, the LLM should approach the reliability achieved among the human coders."
- Reproducibility (quote): "use a fixed version of the LLM throughout the project, document the version". Parameters must be stated even when default. Prompt stability (quote): "create several paraphrases of the prompt, and run the analysis for a subset of the data".
- Prompt length (quote): "While specificity in a prompt can lead to higher accuracy, performance can fall with longer prompts."
- Also recommends asking the model to motivate its coding on disagreements, and warns "not be overly swayed by the model's interpretations".

**[Tornberg2023]** Törnberg P. (2023). ChatGPT-4 Outperforms Experts and Crowd Workers in Annotating Political Twitter Messages with Zero-Shot Learning. arXiv:2304.06588 (13 Apr 2023). PREPRINT. FULL TEXT retrieved; abstract and method lines read.
Retrieved: https://arxiv.org/pdf/2304.06588
- Task: party of the poster from one tweet; balanced sample of 500 tweets; model run 5 times at temperature 0.2 and 1.0; reliability by Krippendorff's alpha.
- Quote (as printed): "ChatGPT-4 has achieves higher accuracy, higher reliability, and equal or lower bias than the human classifiers."

**[HaltermanKeith2025]** Halterman A, Keith KA. Codebook LLMs: Evaluating LLMs as Measurement Tools for Political Science Concepts. Read as arXiv:2407.10747 v2 (9 Jan 2025), FULL TEXT. Published version: Political Analysis, 34(2), 188 to 204, published 19 Sep 2025, DOI 10.1017/pan.2025.10017 (abstract confirmed through OpenAlex; journal text not opened). Peer reviewed.
Retrieved: https://arxiv.org/pdf/2407.10747 and https://api.openalex.org/works/https://doi.org/10.1017/pan.2025.10017
- Setting: full codebooks in the prompt, multi-class with up to 142 labels, open-weight models of 7 to 12 billion parameters (Mistral, Llama). This is a harder and weaker-model setting than a 3-construct study with a frontier model.
- Quote: "We find current open-weight LLMs have limitations in following codebooks zero-shot, but that supervised instruction tuning can substantially improve performance." Zero-shot weighted F1 ranged from 0.14 to 0.65 across models, datasets and codebook formats (their Table 3).
- Proposed codebook format: label, definition, clarification, negative clarification, positive and negative examples. It beat the original format on 2 of 3 datasets (for example CCC, Mistral: 0.65 vs 0.51).
- Order effects (quote): "We find that all models are sensitive to the order that categories are described in the codebook".
- Label over definition (quote): "the LLMs are indeed relying on the semantic content of the labels themselves, performing worse when the labels are replaced with generic terms or swapped".
- One-versus-rest binary prompts gave them no accuracy gain in preliminary tests (the opposite of Dunivin's result).

**[Dunivin2024]** Dunivin ZO. (2024). Scalable Qualitative Coding with LLMs: Chain-of-Thought Reasoning Matches Human Performance in Some Hermeneutic Tasks. arXiv:2401.15170 v2 (12 Feb 2024). PREPRINT. FULL TEXT. A later journal article by the same author exists (see [Dunivin2025] below).
Retrieved: https://arxiv.org/pdf/2401.15170
- 9 codes, paragraph-long newspaper passages, 111 gold standard passages, temperature 0, zero-shot. GPT-4: kappa at or above 0.79 for 3 of 9 codes and at or above 0.6 for 8 of 9; GPT-3.5 mean kappa 0.34.
- Quote: "Agreement improves when the LLM provides rationale for code assignments: µ(κ) = 0.68 vs. µ(κ) = 0.59."
- Quote: "Agreement improves when presenting each code as a separate prompt, rather than the codebook as a whole: µ(κ) = 0.68 vs. µ(κ) = 0.60."
- Few-shot on long passages (quote): "We found that information in the examples was drawn upon by the LLM and interfered with its coding decisions."
- Table 3 (quote): "Shorter task descriptions are more likely to be faithfully executed by the model." Also: changing a code's title alone can change results.

**[Chew2023]** Chew R, Bollenbacher J, Wenger M, Speer J, Kim A. (2023). LLM-Assisted Content Analysis: Using Large Language Models to Support Deductive Coding. arXiv:2306.14924 (23 Jun 2023). PREPRINT. FULL TEXT.
Retrieved: https://arxiv.org/pdf/2306.14924
- GPT-3.5, temperature 0, 4 public datasets, random samples of 100 documents per dataset, human-model agreement compared with human-human agreement.
- Rare codes (quote): "Gwet's AC1 [35] is our preferred IRR metric because many of the codes are rare and occur infrequently in our calibration sample."
- Rationales (quote): "We consider the model justifications primarily as an aid for human reviewers, as opposed to a faithful mechanistic account of the model's inner workings."
- For non-exclusive codes (quote): "we used a prompt that iterates across each code individually". They also test whether a code's answers can be told apart from random guessing (binomial test).

**[Reiss2023]** Reiss MV. (2023). Testing the Reliability of ChatGPT for Text Annotation and Classification: A Cautionary Remark. arXiv:2304.11085 (17 Apr 2023). PREPRINT. FULL TEXT.
Retrieved: https://arxiv.org/pdf/2304.11085
- Quote: "even minor wording alterations in prompts or repeating the identical input can lead to varying outputs".
- Uses Krippendorff's alpha with 0.8 as the bar. Across temperature settings alpha was 0.75 without pooling; across reworded instructions alpha did not exceed 0.6; repeats at low temperature (0.25) were above 0.9. Majority vote over repeats improved consistency.
- Quote: "The unsupervised application of ChatGPT for text annotation and classification is not recommended."

**[Egami2023]** Egami N, Hinck M, Stewart BM, Wei H. (2023). Using Imperfect Surrogates for Downstream Inference: Design-based Supervised Learning for Social Science Applications of Large Language Models. 37th Conference on Neural Information Processing Systems (NeurIPS 2023). arXiv:2306.04746 v3. Peer reviewed conference paper. FULL TEXT.
Retrieved: https://arxiv.org/pdf/2306.04746
- Quote: "direct use of surrogate labels in downstream statistical analyses leads to substantial bias and invalid confidence intervals, even with high surrogate accuracy of 80-90%".
- DSL combines LLM labels on all documents with expert labels on a random subset. Requirement (quote): "the sampling probability of the documents selected for gold-standard be known and be bounded away from zero".
- Scope limit (quote): "DSL is focused on a very specific setting: outcome variables used in a regression where researchers need to annotate a corpus of documents available from the outset." They state text used as a predictor is outside this paper and point to Fong and Tyler.

**[Baumann2025]** Baumann J, Röttger P, Urman A, Wendsjö A, Plaza-del-Arco FM, Gruber JB, Hovy D. (2025). Large Language Model Hacking: Quantifying the Hidden Risks of Using LLMs for Text Annotation. arXiv:2509.08825 v2 (6 Oct 2025). PREPRINT. FULL TEXT. The paper exists.
Retrieved: https://arxiv.org/pdf/2509.08825
- 37 annotation tasks from 21 published studies, 18 LLMs, 13 million labels, 2,361 hypotheses. Quote: "We find incorrect conclusions in approximately 31% of hypotheses for state-of-the-art LLMs, and in half the hypotheses for smaller language models."
- Quote: "with just a handful of prompt paraphrases, virtually anything can be presented as statistically significant".
- Human agreement is not a safety signal (quote): "High human agreement rates are not associated with low LLM hacking risk."
- Value of human labels (quote): "Even 100 human annotations outperform LLM-based approach in terms of Type I risk." Corrections (quote): "Regression estimator correction techniques restore valid inference but trade Type I for Type II errors."
- Recommendations table: report all models, versions, prompts and parameters tested; pre-register model, prompt and parameter choices; "Prefer few-shot over zero-shot prompting and use detailed task descriptions over brief instructions"; extra caution when p is near 0.05. Prompt choices explained under 1% of the variance in risk.

**[Abdurahman2024]** Abdurahman S, Atari M, Karimi-Malekabadi F, Xue MJ, Trager J, Park PS, Golazizian P, Omrani A, Dehghani M. (2024). Perils and opportunities in using large language models in psychological research. PNAS Nexus, 3(7), pgae245. DOI 10.1093/pnasnexus/pgae245. PMCID PMC11249969. Peer reviewed. FULL TEXT.
Retrieved: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11249969/fullTextXML
- Moral language in 2,983 social media posts (quote): "fine-tuned BERT vastly outperformed ChatGPT applied in a zero-shot setting, achieving an F1 score of 0.48 vs. ChatGPT's 0.22". LIWC scored 0.27. Few-shot (quote): "When applied in a few-shot setting, ChatGPT achieved an F1 score of 0.32." Fine-tuned ChatGPT reached 0.53.
- Over-labelling: zero-shot ChatGPT was "over 10 times more likely" than human raters to call a text moral.
- Annotator-profile bias: they report ChatGPT agreed less with conservative and collectivist annotators and more with individualistic, open-minded and agreeable ones (odds changes in their Tables S4 to S10, not opened).
- Guidance (quote): "As with all empirical methods, LLM-based methods need to be validated and benchmarked." They call for validation against a small human-labeled corpus, task by task, before use at scale.
- Reproducibility: proprietary model snapshots are deprecated within months, so shared prompts and parameters may not reproduce results later.

**[CarmonaDiaz2026]** Carmona-Díaz G, Jiménez-Leal W, Grisales MA, Sripada C, Amaya S, Inzlicht M, Bermúdez JP. (2026). An AI-powered research assistant in the lab: A practical guide for text analysis through iterative collaboration with LLMs. Behavior Research Methods. DOI 10.3758/s13428-026-02966-6. PMCID PMC13035871. Peer reviewed. FULL TEXT retrieved; abstract and selected passages read.
Retrieved: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13035871/fullTextXML
- A psychology tutorial for building and applying a category scheme to open-ended responses with an LLM, checked with human-LLM intercoder agreement.
- Quote: "Although we specified a temperature level of 0 to obtain precise responses and consistent classifications, we still observed subtle differences between codings on several occasions."

**[Alizadeh2025]** Alizadeh M, Kubli M, Samei Z, Dehghani S, Zahedivafa M, Bermeo JD, Korobeynikova M, Gilardi F. (2025). Open-source LLMs for text annotation: a practical guide for model setting and fine-tuning. Journal of Computational Social Science. DOI 10.1007/s42001-024-00345-9. PMCID PMC11655591. Peer reviewed. FULL TEXT retrieved; only the abstract was used.
Retrieved: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11655591/fullTextXML
- Quote: "fine-tuning is preferable to few-shot training with a relatively modest quantity of annotated text".

**[Bojic2025]** Bojić L, Zagovora O, Zelenkauskaite A, Vuković V, Čabarkapa M, and others. (2025). Comparing large Language models and human annotators in latent content analysis of sentiment, political leaning, emotional intensity and sarcasm. Scientific Reports, 15. DOI 10.1038/s41598-025-96508-3. PMCID PMC11968858. Peer reviewed. FULL TEXT retrieved; only the abstract was used (full author list was truncated in the search result).
Retrieved: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11968858/fullTextXML
- Quote: "The study involved 33 human annotators and eight LLM variants assessing 100 curated textual items."
- Intensity ratings differ from humans (quote): "humans rated emotional intensity significantly higher". Temporal stability (quote): "Most LLMs showed excellent temporal consistency across all dimensions".

### B. Abstract only

**[Barrie2024]** Barrie C, Palaiologou E, Törnberg P. (2024). Prompt Stability Scoring for Text Annotation with Large Language Models. arXiv:2407.02039. PREPRINT. ABSTRACT ONLY. Retrieved: https://arxiv.org/abs/2407.02039
- Proposes a Prompt Stability Score by "adapting traditional approaches to intra- and inter-coder reliability scoring", with a Python package named promptstability.

**[Gligoric2024]** Gligorić K, Zrnic T, Lee C, Candès EJ, Jurafsky D. (2024). Can Unconfident LLM Annotations Be Used for Confident Conclusions? arXiv:2408.15204. PREPRINT. ABSTRACT ONLY. Retrieved: https://arxiv.org/abs/2408.15204
- Confidence-Driven Inference "combines LLM annotations and LLM confidence indicators to strategically select which human annotations should be collected", with valid confidence intervals.

**[Calderon2025]** Calderon N, Reichart R, Dror R. (2025). The Alternative Annotator Test for LLM-as-a-Judge: How to Statistically Justify Replacing Human Annotators with LLMs. arXiv:2501.10970. PREPRINT. ABSTRACT ONLY. Retrieved: https://arxiv.org/abs/2501.10970
- A statistical test that "requires only a modest subset of annotated examples to justify using LLM annotations". Baumann et al. report that passing it does not guarantee sound downstream inference.

**[McLaren2026]** McLaren L, Cross J, Krakowska Z, Rauner R, Schoonvelde M. (2026). Magic Words or Methodical Work? Challenging Conventional Wisdom in LLM-Based Political Text Annotation. arXiv:2603.26898 (27 Mar 2026). PREPRINT. ABSTRACT ONLY. Retrieved: https://arxiv.org/abs/2603.26898
- Quote: "widely recommended prompt engineering techniques yield inconsistent and sometimes negative effects on annotation performance". Proposes a validation-first framework with "guidance on prompt freezing and held-out evaluation, reporting standards".

**[Than2025]** Than N, Fan L, Law TL, Nelson LK, McCall L. (2025). Updating "The Future of Coding": Qualitative Coding with Generative Large Language Models. Sociological Methods & Research, 54(3), 849 to 888. DOI 10.1177/00491241251339188. Peer reviewed. ABSTRACT ONLY. Retrieved: https://api.openalex.org/works/https://doi.org/10.1177/00491241251339188
- Quote: "We find that LLMs can perform nearly as well as prior supervised machine learning models in accurately matching hand-coding output."

**[Stuhler2025]** Stuhler O, Ton CD, Ollion É. (2025). From Codebooks to Promptbooks: Extracting Information from Text with Generative Large Language Models. Sociological Methods & Research, 54(3), 794 to 848. DOI 10.1177/00491241251336794. Peer reviewed. ABSTRACT ONLY. Retrieved: https://api.openalex.org/works/https://doi.org/10.1177/00491241251336794
- Warns of "risks like non-random error patterns that can bias downstream analyses".

**[TeBlunthuis2024]** TeBlunthuis N, Hase V, Chan C-H. (2024). Misclassification in Automated Content Analysis Causes Bias in Regression. Can We Fix It? Yes We Can! Communication Methods and Measures, 18(3), 278 to 299. DOI 10.1080/19312458.2023.2293713. Peer reviewed. ABSTRACT ONLY. Retrieved: https://api.openalex.org/works/https://doi.org/10.1080/19312458.2023.2293713
- Quote: "even highly accurate classifiers make errors that cause misclassification bias and misleading results when input to downstream statistical analyses". Offers correction methods that use human-coded validation data, with an R package.

**[FongTyler2021]** Fong C, Tyler M. Machine Learning Predictions as Regression Covariates. Political Analysis, 29(4), 467 to 484. Published online 11 Nov 2020. DOI 10.1017/pan.2020.38. Peer reviewed. ABSTRACT ONLY. Retrieved: https://api.openalex.org/works/https://doi.org/10.1017/pan.2020.38
- For predicted variables used as predictors (quote): "plugging in these predictions without regard for prediction error renders regression analyses biased, inconsistent, and overconfident".

**[SonLee2026]** Son M, Lee P. (2026). Can Generative Large Language Models Serve as Raters for Test Development? A Systematic Evaluation Across Tasks, Models, and Inference Configurations. Organizational Research Methods (online 2 Sep 2026). DOI 10.1177/10944281261475596. Peer reviewed. ABSTRACT ONLY. Retrieved: https://api.openalex.org/works/https://doi.org/10.1177/10944281261475596
- Management-methods journal; models include GPT-4, GPT-5 and Claude Sonnet 4.5. Quote: "Variations in prompt design and temperature settings generally produced small to negligible effects on reliability and validity." Validity varied by rating task.

**[Dunivin2025]** Dunivin ZO. (2025). Scaling hermeneutics: a guide to qualitative coding with LLMs for reflexive content analysis. EPJ Data Science, 14(1). DOI 10.1140/epjds/s13688-025-00548-8. Peer reviewed. ABSTRACT ONLY. Retrieved: https://api.openalex.org/works/https://doi.org/10.1140/epjds/s13688-025-00548-8
- Appears to be the journal follow-up to [Dunivin2024]; abstract repeats that structured prompts and asking the model to explain its decisions "can substantially improve fidelity". I did not confirm the numbers match the preprint.

**[Pezeshkpour2023]** Pezeshkpour P, Hruschka E. (2023). Large Language Models Sensitivity to The Order of Options in Multiple-Choice Questions. arXiv:2308.11483. PREPRINT. ABSTRACT ONLY. Retrieved: https://arxiv.org/abs/2308.11483
- Reordering answer options produced "a considerable performance gap of approximately 13% to 75%" on benchmarks. Not an annotation study; relevant to fixed option order.

**[Saito2023]** Saito K, Wachi A, Wataoka K, Akimoto Y. (2023). Verbosity Bias in Preference Labeling by Large Language Models. arXiv:2310.10076. PREPRINT. ABSTRACT ONLY. Retrieved: https://arxiv.org/abs/2310.10076
- Quote: "GPT-4 prefers longer answers more than humans." This is about judging answer quality, not construct coding, so it is only a caution that passage length may sway ratings. Not used in the Answer.

**[GarciaQuevedo2025]** Garcia Quevedo D, Glaser A, Verzat C. (2025). Enhancing Theorization Using Artificial Intelligence: Leveraging Large Language Models for Qualitative Analysis of Online Data. Organizational Research Methods, 29(1), 92 to 112. DOI 10.1177/10944281251339144. Peer reviewed. ABSTRACT ONLY. Retrieved: https://api.openalex.org/works/https://doi.org/10.1177/10944281251339144
- Management-field example: 5,516 social media posts from 18 entrepreneurs analysed for impression management. About exploring and selecting data, not about validation metrics. Not used in the Answer.

### C. Technical documentation (not literature)

**[ClaudeAPIRef]** Claude API reference bundled with this working session (model migration and API version notes; cached 3 Nov 2026). Not a published source. The student should confirm on Anthropic's own documentation before writing the methods section.
- Quote: "The `temperature`, `top_p`, and `top_k` parameters are no longer accepted on Claude Opus 4.7. Requests that include them return a 400 error."
- Quote: "If you were using `temperature = 0` for determinism, note that it never guaranteed identical outputs on prior models."
- The same reference lists sampling parameters as removed or default-only on the current Claude models, and lists Claude Sonnet 4.5 as deprecated with retirement on 30 Nov 2026 (the model used in [SonLee2026]). It also describes a Message Batches endpoint and schema-constrained (structured) outputs.

---

## 3. Could not verify

- **Demszky et al. 2023, "Using large language models in psychology", Nature Reviews Psychology, DOI 10.1038/s44159-023-00241-5.** METADATA ONLY. OpenAlex confirms title, 18 authors (Demszky, Yang, Yeager, Bryan, Clapper, Chandhok, Eichstaedt, Hecht, Jamieson, Johnson, Jones, Krettek-Cobb, Lai, JonesMitchell, Ong, Dweck, Gross, Pennebaker), journal and date 13 Oct 2023. No abstract was available from OpenAlex, Semantic Scholar or Europe PMC, and nature.com is blocked. I make no claim about its content.
- **Ollion, Shen, Macanovic, Chatelain 2024, "The dangers of using proprietary LLMs for research", Nature Machine Intelligence, 6(1), 4 to 5, DOI 10.1038/s42256-023-00783-6.** METADATA ONLY. No abstract available; the open copy on hal.science was blocked. Their related preprint "ChatGPT for Text Annotation? Mind the Hype!" (DOI 10.31235/osf.io/x58kn, seen in Crossref) could not be opened either.
- **Palmer, Smith, Spirling 2023, "Using proprietary language models in academic research requires explicit justification", Nature Computational Science, 4(1), 2 to 3, DOI 10.1038/s43588-023-00585-1.** METADATA ONLY.
- **Barrie, Palmer and Spirling, "Replication for Language Models".** Not found in Crossref. A web search result described it as a working paper under review listed on an author's CV, with a related talk title. I could not open any version. Do not cite it without getting the paper. The closest opened substitutes are [Barrie2024] (abstract) and [Tornberg2024].
- **Feuerriegel S, Barrie C, Crockett MJ, and about 80 co-authors including Mirea, Van Bavel and Rathje (2026), "A reporting checklist for large language models in behavioural science", Nature Human Behaviour, 10(7), 1182 to 1186, DOI 10.1038/s41562-026-02492-7.** METADATA ONLY (Europe PMC and OpenAlex confirm it exists; no abstract). This is the item most likely to be the "validation or reporting checklist" the advisor will expect, and it has two Rathje et al. authors on it. A web search snippet, which I could not verify, says the checklist is called GUIDE-LLM, has 14 items, and is posted at llm-checklist.com. The student should download it directly and report against it.
- **Egami, Hinck, Stewart, Wei (2024), "Using large language model annotations for the social sciences: A general framework of using predicted variables in downstream analyses".** METADATA ONLY. Seen in the reference list of [Baumann2025] (URL naokiegami.com/paper/dsl_ss.pdf) and as a title in a Semantic Scholar search result. The title suggests it extends DSL to LLM labels used as predictors, which is the student's case, but I could not open it, so this is unconfirmed. An R package "dsl" is also listed in the Baumann reference list.
- **Rathje et al. supporting information** (few-shot numbers in Table S2, few-shot prompt in Table S3, precision and recall in Table S1, test-retest in Table S9, annotator details in Table S10): not opened. The paper also gives an OSF link with code (osf.io/6pnb2), not opened.
- **Whether [Tornberg2024] and [Pangakis2023] have peer-reviewed versions:** not verified. Crossref showed related later work by Pangakis and Wolken (ICWSM 2025, "Keeping Humans in the Loop"; NLP+CSS 2024 on LLM-generated training labels), titles only.
- **A paper showing LLM annotation bias toward majority views specifically:** none found and opened. The nearest opened evidence is the annotator-profile result in [Abdurahman2024]. Related titles seen but not opened: Heseltine and Clemm von Hohenberg, "Large Language Models as a Substitute for Human Experts in Annotating Political Text" (DOI 10.31219/osf.io/cx752); Zhang and Lin, "The Risks of Using Large Language Models for Text Annotation in Social Science Research" (DOI 10.31235/osf.io/79qu8).
- **A direct update or replication of Rathje et al. with 2025 or 2026 models, and any study that LLM-codes harmonious or obsessive passion:** none found in the searches I could run.
- **Evidence base is dated.** Almost all experiments above used GPT-3.5 or GPT-4 era models or small open models. None tested current Claude models on psychological constructs. Findings about prompt sensitivity and accuracy may not carry over in size.

---

## 4. Implications for the study design

- **Build the human gold standard first, and split it.** Have the 4 coders code a random sample with the written codebook before any prompt tuning. Use one part for prompt development and a frozen, untouched part for the reported test. The opened sources suggest roughly 100 to 250 passages as a floor for the test set, with at least 20 to 30 positive cases per construct; oversample if obsessive passion is rare, and record the sampling probabilities so a DSL-style correction stays possible [Pangakis2023] [Tornberg2024] [Dunivin2024] [Egami2023].
- **One construct per call, same wording as the coders.** Three separate prompts (harmonious passion, obsessive passion, passion expression), each with a one or two sentence definition, what does not count, the passage, then the question and a fixed answer scale. Because harmonious and obsessive passion are defined against each other, pilot a variant that shows both definitions side by side and keep whichever does better on the development set [Rathje2024] [Dunivin2024] [HaltermanKeith2025].
- **Decide zero-shot vs few-shot and rationale vs no rationale on the development set only.** Try 4 variants (with and without 2 to 4 examples, with and without a short justification before the score). Ask for JSON with the justification and the score. Use the justifications for error analysis with the coders, not as evidence of validity [Dunivin2024] [Chew2023] [Baumann2025] [McLaren2026].
- **Report agreement the way a psychologist expects.** Human-human reliability among the 4 coders first (Krippendorff's alpha or ICC), then model vs the coders' mean: Spearman for 1 to 7 intensity, and precision, recall, F1 and kappa for present or absent. State how the model compares with a single human coder against the other three. Rathje's benchmark for intensity was Spearman 0.59 to 0.77; their own caution is that complex constructs scored far lower [Rathje2024] [Tornberg2024] [Gilardi2023].
- **Do not rely on temperature 0.** Rathje used it, but the bundled Claude API reference says current Claude models reject the temperature parameter and that temperature 0 never guaranteed identical outputs. Plan instead: fix one model ID and effort setting, record the run dates, code every passage at least twice (three times is better), report test-retest kappa, and use the modal or mean score; flag passages where runs disagree for human review [Rathje2024] [Pangakis2023] [Reiss2023] [ClaudeAPIRef].
- **Run a small prompt-stability check.** Three or four paraphrases of each final prompt on a subset, with alpha across paraphrases, and a re-run on a second model as a robustness check. Archive all raw outputs, since the model version will be retired [Barrie2024] [Tornberg2024] [Abdurahman2024].
- **Protect the funding regression.** Passion scores will be predictors of a funding outcome, so the Egami et al. 2023 estimator (built for LLM-labeled outcomes) does not directly apply. Options: run the key test on the human-coded subset alone as the primary or confirmatory analysis, use a predictor-side correction (Fong and Tyler; check the Egami et al. 2024 framework paper once opened), and show the result holds across the prompt and model variants. Write the model, prompt, scale and analysis choices down before running the regression [Egami2023] [FongTyler2021] [Baumann2025].
- **Watch two specific risks in this study.** The model may over-detect passion (over-labelling was common), and it may fall back on the everyday meaning of "obsessed" or "passionate" instead of the theory's definitions, which matters because founders use those words loosely. Include negative examples and check precision separately for each construct [Pangakis2023] [Abdurahman2024] [HaltermanKeith2025].
