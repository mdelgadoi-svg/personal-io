# Q3 notes: studies that read founder or CEO language, and the confounds they handled

Session date: 2026-11-17. Access levels: FULL TEXT, ABSTRACT ONLY, METADATA ONLY. Every detail below comes from a page or API response retrieved in this session. Where only the abstract was available, the table says so and method details are not claimed.

Access problems that shaped these notes: publisher sites (AOM, Elsevier, Wiley, NBER, SSRN) could not be opened. OpenAlex keyword search was out of its daily budget (single DOI lookups still worked), and Semantic Scholar search was rate limited most of the time, so discovery ran mainly through Crossref search, Europe PMC search and the arXiv listing page, plus 2 web searches.

## 1. Answer

**Short version.** Three families of studies exist. (a) Trait inference from founders' or CEOs' own words: tweets [Freiberg2023] [McCarthy2023], earnings calls [Gow2016] [Mesquiti2023], interviews [Choudhury2019]. (b) Passion as perceived by investors who watch a pitch [Chen2009] [Cardon2017] [Li2017] [Shane2020]. (c) Video and voice studies that show what a transcript leaves out [HuMa2025] [Jiang2019] [Clarke2019] [Stefanidis2025]. I found no peer-reviewed study that codes founder podcast interviews, and no study that codes founder speech for passionate vs obsessive language with an LLM. The closest LLM work codes Shark Tank transcripts for investment criteria [Katcharovski2025, preprint] and non-founder interviews for Big Five traits [Zhu2026]. The one paper built around the "host question" problem is [Kanze2018], and I could open only its abstract.

### Table: study, text source, measure, method, confounds handled

| Study (access) | Text source | What was measured | How | Confounds handled, and how |
|---|---|---|---|---|
| [Freiberg2023] (FULL) | Founders' tweets, 2 years before founding; 10,541 founder-startup pairs | Big Five | ML: ridge regression on sentence embeddings, trained on myPersonality self-reports (accuracy r = 0.30 to 0.40) | Timing: only pre-founding tweets. Length: at least 50 tweets. Controls: founding year, number of founders, gender, US state, industry. Named but not solved: investor vs founder effects, social media selection, posting volume tied to extraversion |
| [McCarthy2023] (FULL) | Founders' tweets; 21,187 startups | Big Five, 30 facets | Commercial ML (IBM Watson Personality Insights) | Length: more than 150 words. Named but not solved: Crunchbase success bias, Twitter user selection, "biased presentation" of the self online |
| [Waters2021] (FULL) | Tweets of self-described entrepreneurs | Positive and negative emotion | Dictionary and rules (VADER), topic models | Compared by topic; second study follows the same people across a job change |
| [Kanze2018] (ABSTRACT) | Investor questions and founder answers, TechCrunch Disrupt New York 2010 to 2016 | Promotion vs prevention focus of questions and of answers | Coding method not stated in the abstract (see section 3) | The question frame is the predictor, not a nuisance. Follow-up experiment on answering a prevention question with a promotion answer |
| [Gow2016] (ABSTRACT, working paper) | Conference calls | CEO Big Five | "linguistic features" plus "statistical learning techniques", trained on two samples with known personality data | Out-of-sample prediction; stability over time |
| [Harrison2019] (ABSTRACT) | Not stated in the abstract | Big Five of more than 3,000 S&P 1500 CEOs | Linguistic tool "developed and validated using a sample of CEOs" | Validation on CEOs (not students); nothing more is visible in the abstract |
| [Harrison2020] (ABSTRACT) | Same tool, nearly 3,000 CEOs | Observed CEO personality, stock risk | Same linguistic tool | Not visible in the abstract |
| [Mesquiti2023] (FULL) | 19,536 earnings call transcripts, 3,044 CEOs | Analytic thinking, cognitive processing, I-words, we-words | Dictionary (LIWC-22) | Unscripted calls only. Dropped transcripts under 25 words. Scores are percent of words. Reddit comparison group |
| [Choudhury2019] (ABSTRACT) | Videos and transcripts of interviews with emerging market CEOs | Five communication styles | Topic models, sentiment analysis, neural network coding of faces | Chose "unedited" interviews; combined text with face data |
| [Chen2009] (ABSTRACT) | Business plan presentations | Perceived passion and preparedness | Rating scale built inductively; lab experiment and field study | Separated passion from preparedness; preparedness, not passion, predicted funding |
| [Cardon2017] (ABSTRACT) | 133 live pitches, 72 angels, 1,995 evaluations | Enthusiasm, preparedness, commitment | Investor ratings | Treated the three cues as distinct and tested interactions |
| [Li2017] (ABSTRACT) | Crowdfunding videos, Indiegogo and Kickstarter | Displayed passion | Survey ratings plus archival data, then an experiment | Experiment to test the contagion path |
| [Lucas2016] (ABSTRACT) | 40 student pitches on video | Felt passion (self-report) vs perceived passion (16 investors) | Survey, ratings, focus groups | Directly compared felt and perceived passion; found presentation skill drives the gap |
| [Shane2020] (ABSTRACT) | Pitches shown in an fMRI scanner | Investor neural engagement and interest | High vs low displayed passion | Passion varied by design |
| [HuMa2025] (ABSTRACT) | Full pitch videos | Visual, vocal and verbal "positivity" | ML on video, audio and words; plus an experiment | Three channels measured separately |
| [Jiang2019] (ABSTRACT) | 1,460 pitch videos | Peak displayed joy, by phase | Automated facial expression analysis | Time course (start, middle, end), not just the average |
| [Clarke2019] (ABSTRACT) | Pitches | Figurative language and gestures | Qualitative field study, then experiment | Language type and gesture varied separately |
| [Pai2025] (FULL) | 154 Shark Tank pitches (10-minute aired cuts) | Humorous bragging and other humor | Human coders (kappa 0.62 to 0.88) | Controls: season, episode, number of presenters, ask, equity; male founders only; multilevel model |
| [Stefanidis2025] (FULL) | 1,091 Shark Tank pitches | Smiling; trustworthiness from conversation text | Computer vision; neural text classifier; human-coded controls (Krippendorff alpha 0.94) | Controls: presenters, gender, ethnicity, age, patent, debt and more; separate experiment with 51 VCs |
| [Katcharovski2025] (FULL, preprint) | 600 Shark Tank transcripts from subtitle files | Eight investment-readiness factors | LLM (GPT models) with a rubric; checked against 3 trained students on 31 pitches | Cleaned transcription errors; kept ask and equity; notes the show is "structured for entertainment" |
| [Zhu2026] (FULL; not founders) | 518 semi-structured interviews | Big Five | LLM zero-shot and chain-of-thought, fine-tuning, embeddings; checked against self-report | Kept interviewer prompts in the input; reports length range; zero-shot was weak |

### The confounds the student must handle

**Host or interviewer questions.** [Kanze2018] reports that investors' questions differed by founder gender and "entrepreneurs tend to respond with matching regulatory focus", so an answer partly mirrors its question. Two measurement papers agree: [Marszalek2023] piloted neutral writing instructions because instruction words could "activate promotion or prevention self-regulation", and [Lukac2024] calls linguistic features "more dependent on the nature of the prompts given". Code each host question, and model it.

**Self-presentation.** Public talk is displayed, not felt, passion. [Lucas2016] found "a large misalignment between entrepreneurs' personal passion and investors' perceived passion", driven by presentation skill. [Pai2025] notes that on air "entrepreneurs are highly motivated and expected to present themselves in the best light". [McCarthy2023] and [Freiberg2023] both list this as an unsolved limitation.

**Extraversion and talkativeness.** In recorded group talk, "Extraverts speak more" and LIWC positive emotion words tracked extraversion [Spitzley2022]. [Freiberg2023] adds that extraversion goes with more posting, yet extraversion itself predicted no startup outcome. Expressive volume must not be scored as passion.

**Speaking time and passage length.** Prior work sets floors (50 tweets [Freiberg2023]; 150 words [McCarthy2023]; 25 words [Mesquiti2023]) and uses rates, not counts. Interview length varied from 387 to 7,143 words in [Zhu2026].

**Format and audience.** Studies prefer unscripted or unedited speech [Mesquiti2023] [Choudhury2019]. Aired pitches are cut from about an hour to 10 minutes [Pai2025]. No opened study compares investor-hosted with independent shows; this is a gap the student must cover with show-level controls.

**Transcript quality.** Automatic transcripts had a 25% average word error rate in therapy sessions (range 8 to 74%) [Miner2020]; the best of four systems had a 39% median, with worse accuracy for Black speakers and shifts in LIWC "Affect" and "Drives" scores [Zolnoori2024].

**Time relative to funding.** [Freiberg2023] used only pre-founding tweets "to reduce the risk of reverse causality". [Waters2021] shows language turns more positive after people enter entrepreneurship. Interviews after a deal cannot explain the deal.

**Selection into who is interviewed.** [McCarthy2023] warns that failed companies "are likely to be less represented". Podcast guests are likely already funded or famous; no opened study measures this for podcasts.

## 2. Sources opened

Format: key, citation as retrieved, DOI, access level, URL actually retrieved, key facts with verbatim quotes.

### Full text

**[Freiberg2023]** Freiberg B, Matz SC. Founder personality and entrepreneurial outcomes: A large-scale field study of technology startups. Proceedings of the National Academy of Sciences 2023;120(19):e2215829120. DOI 10.1073/pnas.2215829120. FULL TEXT. Retrieved: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10175740/fullTextXML (DOI found through Crossref search). Note: the real title ends "of technology startups"; the word "accelerator" is not in it.
- Data: "The final dataset includes 10,541 US-based founder-startup pairs, their predicted personalities, and their startups’ outcomes". Startups founded 2010 to 2014, outcomes from Crunchbase.
- Measure: "Founders’ Big Five personality traits were predicted from their Tweets. The predictive models (ridge regressions based on sentence embeddings) were trained on MyPersonality data".
- Accuracy of the trait model: "the accuracies were found to range from r = 0.30 for agreeableness, r = 0.34 for conscientiousness and neuroticism, all the way to r = 0.40 for extraversion and openness".
- Timing and length: "Tweets were accessed via the Twitter API for the 2 y prior to founding. We only considered founders who had tweeted at least 50 times."
- Effects: "An increase of 1 SD in openness and agreeableness was associated with a 5% higher likelihood of attracting funding." And: "A 1 SD increase in conscientiousness and neuroticism was associated with a 15% and 16% lower likelihood of exiting, respectively." And: "An increase of 1 SD in conscientiousness was associated with an additional $170,000 raised".
- Extraversion: "Extraversion was the only personality trait that did not show any significant relationships with startup outcomes."
- Controls: "All analyses control for the year the company was founded, the number of founders, the gender of the founder, US state, and industry-fixed effects."
- Limitations: "we cannot distinguish between founder and investor effects". And: "our sample is limited to entrepreneurs who use social media, and the accuracy of their profiles is likely a function of the amount they post". And: "prior research has linked extraversion to more active engagement with social media platforms".

**[McCarthy2023]** McCarthy PX, Gong X, Braesemann F, Stephany F, Rizoiu MA, Kern ML. The impact of founder personalities on startup success. Scientific Reports 2023;13(1):17200. DOI 10.1038/s41598-023-41980-y. FULL TEXT. Retrieved: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10582098/fullTextXML
- Method: "we employed a commercial service, IBM Watson Personality Insight, to infer personality facets".
- Length floor: "there are 32,732 profiles that each had enough Twitter posts (more than 150 words) to get relatively accurate personality scores".
- Outcome: success "defined as whether their company has been acquired, acquired another company or listed on a public stock exchange". Final model sample n = 21,187 startups.
- Self-presentation limit: "Another limitation of our approach is the potentially biased presentation of a person’s digital identity on social media, which is the basis for identifying personality traits."
- Selection: "companies that fail, especially those that fail early, are likely to be less represented in the data". And: "Samples were also limited to those founders who are active on Twitter, which adds additional selection biases."
- Timing: "the language and emotional tone used by entrepreneurs in social media can be affected by events such as business failure".

**[Mesquiti2023]** Mesquiti S, Seraj S. The psychological impacts of the COVID-19 pandemic on business leadership. PLOS ONE 2023;18(10):e0290621. DOI 10.1371/journal.pone.0290621. FULL TEXT. Retrieved: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10566739/fullTextXML
- Why unscripted speech: "business analysts often present CEOs with questions that they are not fully prepared for. This prevents CEOs from relying on ‘pre-baked’ responses, providing relatively ‘organic’ speech patterns."
- Sample and length floor: "Transcripts of less than 25 words were excluded from analyses". "The final sample was composed of 19,536 transcripts from 3,044 CEOs."
- Method: LIWC "calculates the percentage of words in a text that pertains to different social, psychological, and linguistic categories".
- Dictionary limit, in the authors' reply to reviewers: "As a closed vocabulary approach, its internal dictionaries are not exhaustive. LIWC also does not take into account the context in which words are used".

**[Pai2025]** Pai J, Chou EY, Halevy N. The Humor Advantage: Humorous Bragging Benefits Job Candidates and Entrepreneurs. Personality and Social Psychology Bulletin 2025;51(8):1330-1344. DOI 10.1177/01461672231214462. FULL TEXT. Retrieved: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12206245/fullTextXML
- Edited material: "The one-hour pitch is then edited to a 10-minute segment, which serves as the coding material of this study".
- Self-presentation setting: "entrepreneurs are highly motivated and expected to present themselves in the best light".
- Human coding: "Our final sample included 154 pitches. Two research assistants blind to the hypotheses coded each pitch independently and then met to reconcile any differences". A fourth coder recoded Season 3: "kappa ranging from .62 to .88".
- Controls: "season, episode, the number of presenters, the amount the entrepreneur was seeking, and the equity he offered".
- Sample restriction: "We focused our coding efforts on pitches made by male entrepreneurs in the first four seasons of Shark Tank".

**[Stefanidis2025]** Stefanidis D, Nicolaou N, Shane S, Conley M, Pallis G, Dikaiakos MD. Founder smiles increase investor trust and funding. Scientific Reports 2025;15(1):27912. DOI 10.1038/s41598-025-12544-z. FULL TEXT. Retrieved: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12314047/fullTextXML
- Non-verbal effect: "The odds of receiving funding are associated with a 1.47-fold increase for a standard deviation increase in the smiling score".
- Text model on pitch conversation: "This model analyses conversational text data to gauge perceived trustworthiness within a discussion."
- Human-coded controls: "The interrater agreement between the research assistants was acceptable with a Krippendorff’s α = 0.94."

**[Katcharovski2025]** (PREPRINT, not peer reviewed) Katcharovski Y, Maxwell AL. Predicting Business Angel Early-Stage Decision Making Using AI. arXiv:2507.03721, submitted 4 Jul 2025. FULL TEXT. Retrieved: https://arxiv.org/abs/2507.03721 and https://arxiv.org/pdf/2507.03721
- LLM coding of pitch transcripts: "we prompted multiple large language models (LLMs) to assign the eight CFA factors to a dataset of 600 transcribed, unstructured startup pitches".
- Transcript source: "We then obtained subtitle transcripts for 600 pitches from public repositories, including Subdl and OpenSubtitles.org".
- Human check is small: "The trained students then graded the same 31 text transcripts from our database of 600 Shark Tank pitches". Reported agreement: "Spearman's r = 0.896".
- Format limit: "The program is structured for entertainment, potentially affecting the manner in which entrepreneurs deliver their pitches and investor reactions".

**[Zhu2026]** Zhu J, Maharjan J, Li X, Coifman KG, Jin R. Personality Inference From Semistructured Interviews Using Large Language Models: Comparative Evaluation Study. Journal of Medical Internet Research 2026;28:e87129. DOI 10.2196/87129. FULL TEXT. Retrieved: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13674523/fullTextXML. Participants are not founders (firefighters, patients, students, community adults).
- Zero-shot LLM trait scoring was weak: "prompt-based methods exhibited weak and inconsistent performance across traits. The highest correlation was observed for conscientiousness in the zero-shot setting (r=0.158)."
- Interviewer turns: "transcripts were used in their conversational form, with interviewer prompts preserved to retain contextual structure".
- Length: "participants produced 2955 (SD 1855) words per interview, with a range from 387 to 7143 words".
- Fine-tuned models did better: "correlations reached r=0.718 for conscientiousness and r=0.631 for agreeableness".

**[Spitzley2022]** Spitzley LA, Wang X, Chen X, Burgoon JK, Dunbar NE, Ge S. Linguistic measures of personality in group discussions. Frontiers in Psychology 2022;13:887616. DOI 10.3389/fpsyg.2022.887616. FULL TEXT. Retrieved: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9523152/fullTextXML
- Talkativeness: "Both correlation and regression analysis show Extraverts speak more, which supports H5(a)." (N = 340, spoken group games.)
- Positive words: "Positive emotion words in LIWC were associated with greater Extraversion".
- Public setting (their review of earlier work): "the positive correlation between extraversion and positive emotions is stronger in public than in private".

**[Lukac2024]** Lukac M. Speech-based personality prediction using deep learning with acoustic and linguistic embeddings. Scientific Reports 2024;14(1):30149. DOI 10.1038/s41598-024-81047-0. FULL TEXT. Retrieved: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11615297/fullTextXML
- Text depends on the prompt: linguistic features "are recognised as being more dependent on the nature of the prompts given and the specific responses provided by the participants".
- Voice plus words, 2,045 speakers: "The correlation coefficients between the self-reported test scores and the scores predicted by the model proposed in this paper ranged from 0.26 to 0.39."

**[Miner2020]** Miner AS, Haque A, Fries JA, Fleming SL, Wilfley DE, Wilson GT, Milstein A, Jurafsky D, Arnow BA, Agras WS, Fei-Fei L, Shah NH. Assessing the accuracy of automatic speech recognition for psychotherapy. npj Digital Medicine 2020;3(1):82. DOI 10.1038/s41746-020-0285-8. FULL TEXT. Retrieved: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC7270106/fullTextXML
- "The average word error rate of the speech recognition system was 25% (median, 24%; range, 8-74%; SD, 12%)". (100 therapy sessions, one commercial system.)

**[Zolnoori2024]** Zolnoori M, Vergez S, Xu Z, Esmaeili E, Zolnour A, Anne Briggs K, Scroggins JK, Hosseini Ebrahimabad SF, Noble JM, Topaz M, Bakken S, Bowles KH, Spens I, Onorato N, Sridharan S, McDonald MV. Decoding disparities: evaluating automatic speech recognition system performance in transcribing Black and White patient verbal communication with nurses in home healthcare. JAMIA Open 2024;7(4):ooae130. DOI 10.1093/jamiaopen/ooae130. FULL TEXT. Retrieved: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11631515/fullTextXML
- "Amazon Web Services General had the highest accuracy, with a median WER of 39%."
- Errors are not random across speakers and they move dictionary scores: "all systems showed reduced accuracy for Black patients, with significant discrepancies in LIWC dimensions such as “Affect,” “Social,” and “Drives.”"
- Paid human transcription also loses things: "These services often misinterpret terms, omit filler words like “um” and “uh,” and repetition of words or phrases".

**[Marszalek2023]** Marszałek M, Miązek A, Roczniewska M. Promotion and prevention regulatory focus LIWC dictionary. Polish adaptation and validation. PLOS ONE 2023;18(7):e0288726. DOI 10.1371/journal.pone.0288726. FULL TEXT. Retrieved: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10358899/fullTextXML
- What the regulatory focus dictionary is (their summary of Gamache et al. 2015): "they created two lists of words indicative of a promotion (e.g., achieve, ideal, speed) vs. prevention (afraid, fail, safety) focus".
- Validation by experts (their summary): "they asked 25 experts (researchers in organizational science with publications on regulatory focus) to code each word as reflecting either a promotion focus or prevention focus".
- Prompt wording matters: instructions were revised for "words that could influence the participants or activate promotion or prevention self-regulation".

**[Waters2021]** Waters J, Nicolaou N, Stefanidis D, Efstathiades H, Pallis G, Dikaiakos M. Exploring the sentiment of entrepreneurs on Twitter. PLOS ONE 2021;16(7):e0254337. DOI 10.1371/journal.pone.0254337. FULL TEXT. Retrieved: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8323876/fullTextXML
- "We find that a job change to entrepreneurship is associated with a shift in the expression of emotions to more positive ones."
- Who counts as an entrepreneur: "Entrepreneurs are identified as users who have in their personal Twitter description any of the following terms".

**[Rathje2024]** Rathje S, Mirea DM, Sucholutsky I, Marjieh R, Robertson CE, Van Bavel JJ. GPT is an effective tool for multilingual psychological text analysis. Proceedings of the National Academy of Sciences 2024;121(34):e2308950121. DOI 10.1073/pnas.2308950121. FULL TEXT. Retrieved: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11348013/fullTextXML (opened only for the method anchor)
- "We found that GPT (r = 0.59 to 0.77) performed much better than English-language dictionary analysis (r = 0.20 to 0.30) at detecting psychological constructs as judged by manual annotators."
- The validation texts are short: "Across 15 datasets (n = 47,925 manually annotated tweets and news headlines)". Long interview answers are a different kind of text.

### Abstract only

**[Kanze2018]** Kanze D, Huang L, Conley MA, Higgins ET. We Ask Men to Win and Women Not to Lose: Closing the Gender Gap in Startup Funding. Academy of Management Journal 2018;61(2):586-614. DOI 10.5465/amj.2016.1215. ABSTRACT ONLY. Retrieved: https://api.openalex.org/works/https://doi.org/10.5465/amj.2016.1215 and https://api.crossref.org/works/10.5465/amj.2016.1215 (journals.aom.org did not resolve; not in Europe PMC).
- Setting: "A field study conducted on question-and-answer interactions at TechCrunch Disrupt New York City during 2010 through 2016".
- Question frame shapes the answer: "investors tend to ask male entrepreneurs promotion-focused questions and female entrepreneurs prevention-focused questions, and that entrepreneurs tend to respond with matching regulatory focus".
- Outcome: "every additional prevention-focused question significantly hinders the entrepreneur’s ability to raise capital, fully mediating gender’s effect on funding".
- Remedy tested: "entrepreneurs can significantly increase funding for their startups when responding to prevention-focused questions with promotion-focused answers".

**[Gow2016]** (WORKING PAPER) Gow ID, Kaplan SN, Larcker DF, Zakolyukina AA. CEO Personality and Firm Policies. NBER Working Paper w22435, 2016. DOI 10.3386/w22435 (also SSRN 10.2139/ssrn.2805635). ABSTRACT ONLY. Retrieved: https://api.openalex.org/works/https://doi.org/10.3386/w22435
- "we use linguistic features extracted from conferences calls and statistical learning techniques to develop a measure of CEO personality in terms of the Big Five traits".
- "These personality measures have strong out-of-sample predictive performance and are stable over time."

**[Harrison2019]** Harrison JS, Thurgood GR, Boivie S, Pfarrer MD. Measuring CEO personality: Developing, validating, and testing a linguistic tool. Strategic Management Journal 2019;40(8):1316-1330. DOI 10.1002/smj.3023. ABSTRACT ONLY. Retrieved: https://api.openalex.org/works/https://doi.org/10.1002/smj.3023
- "a novel, linguistic measure of CEOs' Big Five personality traits that we specifically developed and validated using a sample of CEOs".
- Applied "to a sample of more than 3,000 CEOs of S&P 1500 firms".

**[Harrison2020]** Harrison JS, Thurgood GR, Boivie S, Pfarrer MD. Perception Is Reality: How CEOs' Observed Personality Influences Market Perceptions of Firm Risk and Shareholder Returns. Academy of Management Journal 2020;63(4):1166-1195. DOI 10.5465/amj.2018.0626. ABSTRACT ONLY. Retrieved: https://api.openalex.org/works/https://doi.org/10.5465/amj.2018.0626
- "Using a linguistic tool to measure nearly 3,000 CEOs’ personality traits, we find that CEOs’ observed levels of conscientiousness, neuroticism, and extraversion have important consequences for the perceived riskiness of the firm".

**[Choudhury2019]** Choudhury P, Wang D, Carlson NA, Khanna T. Machine learning approaches to facial and text analysis: Discovering CEO oral communication styles. Strategic Management Journal 2019;40(11):1705-1732. DOI 10.1002/smj.3067. ABSTRACT ONLY. Retrieved: https://api.semanticscholar.org/graph/v1/paper/DOI:10.1002/smj.3067
- "With videos and corresponding transcripts of interviews with emerging market CEOs, we employ this synthesis of methods to discover five distinct communication styles that incorporate both verbal and nonverbal aspects of communication."
- Why interviews: "Our data are comprised of interviews that represent unedited expressions and content, making them especially suitable as data sources for the measurement of an individual’s communication style."

**[Chen2009]** Chen XP, Yao X, Kotha S. Entrepreneur Passion and Preparedness in Business Plan Presentations: A Persuasion Analysis of Venture Capitalists' Funding Decisions. Academy of Management Journal 2009;52(1):199-214. DOI 10.5465/amj.2009.36462018. ABSTRACT ONLY. Retrieved: https://api.openalex.org/works/https://doi.org/10.5465/amj.2009.36462018
- Definition: "an entrepreneur's intense affective state accompanied by cognitive and behavioral manifestations of high personal value".
- Result: "a laboratory experiment and a field study that consistently showed that preparedness, not passion, positively impacted decisions to fund ventures".

**[Cardon2017]** Cardon MS, Mitteness C, Sudek R. Motivational Cues and Angel Investing: Interactions among Enthusiasm, Preparedness, and Commitment. Entrepreneurship Theory and Practice 2017;41(6):1057-1085. DOI 10.1111/etap.12255. ABSTRACT ONLY. Retrieved: https://api.openalex.org/works/https://doi.org/10.1111/etap.12255 (found while looking for Mitteness 2012; same author group)
- "We tested the independent and interaction effects of these cues by having 72 angels complete 1,995 evaluations of 133 live pitches."
- "Our findings suggest that enthusiasm, preparedness, and commitment should be treated as conceptually and empirically distinct."

**[Li2017]** Li J, Chen XP, Kotha S, Fisher G. Catching fire and spreading it: A glimpse into displayed entrepreneurial passion in crowdfunding campaigns. Journal of Applied Psychology 2017;102(7):1075-1090. DOI 10.1037/apl0000217. ABSTRACT ONLY. Retrieved: https://api.openalex.org/works/https://doi.org/10.1037/apl0000217
- "entrepreneurs' displayed passion in the introductory video for a crowdfunding project increases viewers' experienced enthusiasm about the project (i.e., passion contagion)".
- Design: "a combination of survey and archival data from the world's 2 most popular crowdfunding platforms: Indiegogo (Study 1) and Kickstarter (Study 2)", then an experiment.

**[Lucas2016]** Lucas K, Kerrick SA, Haugen J, Crider CJ. Communicating Entrepreneurial Passion: Personal Passion vs. Perceived Passion in Venture Pitches. IEEE Transactions on Professional Communication 2016;59(4):363-378. DOI 10.1109/tpc.2016.2607818. ABSTRACT ONLY. Retrieved: https://api.openalex.org/works/https://doi.org/10.1109/tpc.2016.2607818
- "We revealed a large misalignment between entrepreneurs' personal passion and investors' perceived passion."
- "entrepreneurs' weak or strong presentation skills led investors either to underestimate or overestimate, respectively, perceptions of entrepreneurs' passion".
- Small sample: "we surveyed 40 student entrepreneurs, videorecorded their venture pitches, and facilitated focus groups with 16 investors".

**[Shane2020]** Shane S, Drover W, Clingingsmith D, Cerf M. Founder passion, neural engagement and informal investor interest in startup pitches: An fMRI study. Journal of Business Venturing 2020;35(4):105949. DOI 10.1016/j.jbusvent.2019.105949. ABSTRACT ONLY. Retrieved: https://api.semanticscholar.org/graph/v1/paper/DOI:10.1016/j.jbusvent.2019.105949
- "founders displaying high passion increase investor neural engagement by 39% and investor interest in the venture by 26% over those displaying low passion".

**[HuMa2025]** Hu A, Ma S. Persuading Investors: A Video-Based Study. The Journal of Finance 2025;80(5):2639-2688. DOI 10.1111/jofi.13471 (earlier NBER w29048, 2021). ABSTRACT ONLY. Retrieved: https://api.openalex.org/works/https://doi.org/10.1111/jofi.13471
- "Using machine learning algorithms to process full pitch videos, we quantify persuasion in visual, vocal, and verbal dimensions."
- "We find that positive (i.e., passionate, warm) pitches increase funding probability. However, conditional on funding, startups with higher levels of pitch positivity underperform."

**[Jiang2019]** Jiang L, Yin D, Liu D. Can Joy Buy You Money? The Impact of the Strength, Duration, and Phases of an Entrepreneur's Peak Displayed Joy on Funding Performance. Academy of Management Journal 2019;62(6):1848-1871. DOI 10.5465/amj.2017.1423. ABSTRACT ONLY. Retrieved: https://api.openalex.org/works/https://doi.org/10.5465/amj.2017.1423
- "We analyzed data from over eight million frames in 1,460 pitch videos, using the latest facial expression analysis technology."
- "the amount of time an entrepreneur spends at the peak level of his or her displayed joy has an inverted U-shaped relationship with funding performance".

**[Clarke2019]** Clarke JS, Cornelissen JP, Healey MP. Actions Speak Louder than Words: How Figurative Language and Gesturing in Entrepreneurial Pitches Influences Investment Judgments. Academy of Management Journal 2019;62(2):335-360. DOI 10.5465/amj.2016.1008. ABSTRACT ONLY. Retrieved: https://api.openalex.org/works/https://doi.org/10.5465/amj.2016.1008
- "although variation in the type of language used by an entrepreneur has limited effects, using gestures to depict and symbolize business ideas has strong positive effects".

**[Gamache2015]** Gamache DL, McNamara G, Mannor MJ, Johnson RE. Motivated to Acquire? The Impact of CEO Regulatory Focus on Firm Acquisitions. Academy of Management Journal 2015;58(4):1261-1282. DOI 10.5465/amj.2013.0377. ABSTRACT ONLY. Retrieved: https://api.openalex.org/works/https://doi.org/10.5465/amj.2013.0377. The abstract does not describe the dictionary; the dictionary details above come from [Marszalek2023].
- "Our findings indicate that CEO regulatory focus impacts both the quantity and scale of acquisitions undertaken by a firm."

**[Petrenko2025]** (CONFERENCE ABSTRACT, not a full paper) Petrenko OV, Sanchez-Ruiz P, Guo S, Blake AB, Panda A. Language Style Matching and Power Dynamics in Entrepreneurial Funding: Evidence from Shark Tank. Academy of Management Proceedings 2025(1). DOI 10.5465/amproc.2025.24656abstract. ABSTRACT ONLY. Retrieved: https://api.openalex.org/works/https://doi.org/10.5465/amproc.2025.24656abstract
- Defines Language Style Matching as "the unconscious mirroring of linguistic patterns", and says it may lead "to less favorable funding terms". No numbers in the abstract.

**[Ozince2024]** (PREPRINT) Ozince E, Ihlamur Y. Automating Venture Capital: Founder assessment using LLM-powered segmentation, feature engineering and automated labeling techniques. arXiv:2407.04885, submitted 5 Jul 2024. ABSTRACT ONLY. Retrieved: https://arxiv.org/abs/2407.04885
- "We utilize LLM prompting techniques, like chain-of-thought, to generate features from limited data". The abstract does not say the data are speech; it is about founder characteristics, not spoken language.

### Metadata only (exists, not read; do not use to support a claim)

Confirmed through Crossref search results only. No abstract could be retrieved from OpenAlex, Semantic Scholar ("elided by the publisher"), Crossref or Europe PMC.
- Mitteness C, Sudek R, Cardon MS. Angel investor characteristics that determine whether perceived passion leads to higher evaluations of funding potential. Journal of Business Venturing 2012;27(5):592-606. DOI 10.1016/j.jbusvent.2011.11.003.
- Murnieks CY, Cardon MS, Sudek R, White TD, Brooks WT. Drawn to the fire: The role of passion, tenacity and inspirational leadership in angel investing. Journal of Business Venturing 2016;31(4):468-484. DOI 10.1016/j.jbusvent.2016.05.002.
- Warnick BJ, Murnieks CY, McMullen JS, Brooks WT. Passion for entrepreneurship or passion for the product? A conjoint analysis of angel and VC decision-making. Journal of Business Venturing 2018;33(3):315-332. DOI 10.1016/j.jbusvent.2018.01.002.
- Davis BC, Hmieleski KM, Webb JW, Coombs JE. Funders' positive affective reactions to entrepreneurs' crowdfunding pitches: The influence of perceived product creativity and entrepreneurial passion. Journal of Business Venturing 2017;32(1):90-106. DOI 10.1016/j.jbusvent.2016.10.006.
- Kim (first name differs by index: Crossref's SSRN record lists "Y. Han (Andy) Kim", OpenAlex lists "Yu-Sang Kim"; check the journal page). Self attribution bias of the CEO: Evidence from CEO interviews on CNBC. Journal of Banking & Finance 2013;37(7):2472-2489. DOI 10.1016/j.jbankfin.2013.02.008. A media interview study; abstract not retrievable.
- Meschke F. CEO Interviews on CNBC. SSRN working paper, 2002. DOI 10.2139/ssrn.302602. Abstract not retrievable.

## 3. Could not verify

1. **How Kanze et al. 2018 coded questions and answers.** The abstract confirms the setting, the gender difference in questions, the matching of answers to question frame, and the funding effect. It does not say whether coding used the LIWC regulatory focus dictionary, human coders, or both, and gives no sample size or effect size. A regulatory focus LIWC dictionary by Gamache et al. 2015 does exist [Marszalek2023], but I could not confirm from retrieved text that Kanze et al. 2018 used it. Do not cite coding details for this paper until the full text is read (library access to AMJ is needed).
2. **Why Gow et al. and Harrison et al. use the unscripted question and answer part of earnings calls.** The Gow abstract says only "conferences calls". The Harrison 2019 abstract does not name the text source at all. The rationale for unscripted speech is supported here only by [Mesquiti2023] and [Choudhury2019]. Whether Gow or Harrison limited their text to the question and answer part is not verified.
3. **Mitteness 2012, Murnieks 2016, Warnick 2018, Davis 2017.** Existence and bibliographic details confirmed; no abstract or text was readable. Nothing about their findings is claimed in these notes. In particular, the claim that Warnick et al. separate passion for the product from passion for entrepreneurship and include openness to feedback rests only on the title and the task description.
4. **Sample sizes and settings for Hu and Ma, Li et al., Chen et al.** Only what the abstracts say is recorded. Scale items for perceived passion in Chen et al. 2009 were not seen.
5. **Podcast or media interview transcripts of founders.** I found no peer-reviewed study that uses founder podcast transcripts, with or without an LLM. Searches run: Crossref (8 queries), Europe PMC (about 30 queries), arXiv listing (14 queries), Semantic Scholar (2 queries that returned results; others were rate limited), 2 web searches. OpenAlex keyword search could not be used (budget exhausted). So this is "not found with limited search", not "does not exist". SSRN and Google Scholar could not be searched.
6. **Title of the Freiberg and Matz paper.** The task gave it with "in a technology startup accelerator". The retrieved title is "A large-scale field study of technology startups". The sample is Crunchbase founders with Twitter accounts, not an accelerator cohort.
7. **Interviewer effects in podcasts specifically, and investor-hosted vs independent shows.** No opened source tests either. The paragraphs above extend findings from pitch question sessions, writing prompts and interview studies.
8. **Speaker attribution (diarization) error rates.** The two transcription sources report word error rates, not who-said-what errors. No number for attribution errors was retrieved.

## 4. Implications for the study design

- **Treat the host question as data.** Keep each question with its answer. Code the question (topic, and whether it invites passion talk, struggle talk, or neither) and include it in the model, or compare founders only within the same question type. The best support is [Kanze2018] (abstract level), with [Marszalek2023] and [Lukac2024] on prompt wording.
- **Say plainly that the measure is displayed language, not felt passion.** [Lucas2016] found felt and perceived passion far apart, and [Chen2009] found preparedness, not passion, moved funding. If possible, add a small validation: a few founders fill in a passion scale and the LLM codes their interviews.
- **Separate passion from energy and talkativeness.** Record words spoken, share of talk time, and a plain positive emotion score for each founder, and show that the passion and obsession codes predict beyond them [Spitzley2022]. Write the rubric around content (what the founder says about the work and its place in life), not intensity.
- **Fix length.** Set a minimum word count per founder, code equal-sized passages, and use rates per passage [Freiberg2023] [McCarthy2023] [Mesquiti2023] [Zhu2026].
- **Record the format.** For each episode: host type (investor or independent), live or edited, pitch or long interview, audience. Use show fixed effects. Edited material is a selected sample of what was said [Pai2025] [Katcharovski2025].
- **Check transcripts before coding.** Hand-correct a random sample, report the word error rate and the share of misattributed turns, and test whether error rates differ by accent or gender, because errors are not random and they move dictionary scores [Miner2020] [Zolnoori2024].
- **Date every interview against the funding round.** Only interviews recorded before the deal can speak to selection; later ones may reflect success, status or coaching [Freiberg2023] [Waters2021].
- **Start from a list of founders, not a list of podcasts.** Draw founders from a funding database, then look for interviews, and report who has none. Compare covered and uncovered founders on what is observable [McCarthy2023].
- **Validate the LLM on this kind of text.** [Rathje2024] validated GPT on tweets and headlines; zero-shot trait scoring from long interviews was weak in [Zhu2026]; the one pitch transcript check used 31 pitches [Katcharovski2025]. Plan a human-coded set large enough to report agreement by code, and remember that words alone miss face, voice and gesture [HuMa2025] [Jiang2019] [Clarke2019] [Stefanidis2025].
