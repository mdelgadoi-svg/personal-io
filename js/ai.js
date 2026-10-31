// Claude helpers: tiny first steps for a task, and reading notes you say or type.
// Uses your own Claude API key, saved only in this browser (Settings).
// For steps, only the task title, its goal and the goal's why are sent.
// For a note, the note, your goal titles and your open task titles are sent.

const MODEL = 'claude-sonnet-5-5';
const KEY_STORAGE = 'personal-io:claude-key';

export const FALLBACK_NEEDS = "Don't know exactly what this needs yet, but I trust you'll do it well!";

export function getKey() {
  try { return localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; }
}

export function setKey(key) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key.trim());
    else localStorage.removeItem(KEY_STORAGE);
  } catch { /* storage blocked */ }
}

export function hasKey() { return getKey().length > 10; }

// Claude API keys look like sk-ant-api03-... (from console.anthropic.com).
export function looksLikeKey(key) { return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(String(key || '').trim()); }

// A tiny request to check the key works. Returns true, or throws with a plain reason.
export async function testKey(key = getKey()) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json', 'x-api-key': key.trim(),
      'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 16, messages: [{ role: 'user', content: 'Reply with OK.' }] }),
  });
  if (res.ok) return true;
  if (res.status === 401) throw new Error('Claude did not accept this key. Copy it again from console.anthropic.com.');
  if (res.status === 402 || res.status === 403) throw new Error('The key works but the account needs credit. Add credit in console.anthropic.com > Billing.');
  let detail = '';
  try { detail = (await res.json())?.error?.message || ''; } catch { /* ignore */ }
  throw new Error(`Claude answered with an error${detail ? ': ' + detail : ''}.`);
}

function buildPrompt({ title, goal, why, minutes, place, computer = true }) {
  return `You help someone with ADHD start tasks. Starting is the hardest part, so first steps must be tiny, physical and concrete.

Task: ${title}
Goal it serves: ${goal || 'not given'}
Why the goal matters: ${why || 'not given'}
Time planned: ${minutes ? minutes + ' minutes' : 'not given'}
Where: ${place || 'not given'}
Done on a computer: ${computer ? 'yes' : 'no'}

Reply with JSON only, no other text:
{
  "firstSteps": ["...", "...", "..."],
  "toGetItDone": ["..."]
}

Rules:
- firstSteps: exactly 3 steps, each doable in under a minute, in order. If it is done on a computer, step 1 is always "Close all windows and tabs" (you may add one more short setup action). If not, step 1 sets up the space away from screens. Step 2 opens or gets out the exact thing needed. Step 3 is the very first action. Each step under 12 words.
- toGetItDone: 1 to 4 short items the task truly needs (materials, documents, people, prep). Only include what you can reasonably infer from the task and goal. If you cannot tell, return an empty list.
- Plain words. No em dashes.`;
}

function parseJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Claude did not return a usable answer. Try again.');
  return JSON.parse(text.slice(start, end + 1));
}

async function ask(prompt) {
  const key = getKey();
  if (!key) throw new Error('Add your Claude API key in Settings first.');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 6000,
      output_config: { effort: 'medium' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Claude did not accept the API key. Check it in Settings.');
    throw new Error('Claude could not answer right now.');
  }
  const data = await res.json();
  return parseJson((data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n'));
}

// Reads a note you said or typed. Most notes are just letting off steam, so this
// usually returns nothing. It only suggests (at most 3) clear things you said you need to do,
// and picks a goal for the tasks you named yourself with the word "task".
export async function talkSuggestions(text, goals, openTitles = [], named = []) {
  const goalList = goals.map((g) => `- ${g.id}: ${g.title}`).join('\n');
  const out = await ask(`Someone with ADHD wrote or said this note. Most notes are venting or thinking out loud and contain no tasks.

Note:
"""${text}"""

Goals (id: title):
${goalList}

Tasks they already have: ${openTitles.length ? openTitles.slice(0, 60).join('; ') : 'none'}
Tasks they named themselves: ${named.length ? named.join('; ') : 'none'}

Reply with JSON only:
{ "suggestions": [ { "title": "...", "goalId": "...", "minutes": 30 } ], "namedGoals": [ { "title": "...", "goalId": "..." } ] }

Rules:
- suggestions: 0 to 3 items. Only include a clear, concrete action the person says they need or want to do. Never turn feelings, complaints or ideas into tasks. Skip anything already in their tasks or in the tasks they named. When in doubt, leave it out. An empty list is a good answer.
- Title: start with a verb, under 10 words. No em dashes.
- goalId: the id of the goal it serves, or "life" if none fits.
- minutes: a realistic guess (15, 30, 45, 60, 90 or 120).
- namedGoals: for each task they named themselves, the goal id that fits best, or "life".`);
  const ids = new Set(goals.map((g) => g.id));
  const fit = (id) => (ids.has(id) ? id : 'life');
  const suggestions = (out.suggestions || []).slice(0, 3).map((t) => ({
    title: String(t.title || '').trim(),
    goalId: fit(t.goalId),
    minutes: [15, 30, 45, 60, 90, 120].includes(Number(t.minutes)) ? Number(t.minutes) : 30,
  })).filter((t) => t.title);
  const namedGoals = {};
  (out.namedGoals || []).forEach((n) => { if (n && n.title) namedGoals[String(n.title).trim().toLowerCase()] = fit(n.goalId); });
  return { suggestions, namedGoals };
}

// Reads email subjects, senders and previews and pulls out things you need to do.
// Returns at most 8 suggestions; most emails are not tasks.
export async function tasksFromEmails(emails, goals, openTitles = []) {
  const goalList = goals.map((g) => `- ${g.id}: ${g.title}`).join('\n');
  const list = emails.map((e, i) => `[${i}] ${e.sent ? 'I SENT' : 'FROM ' + e.from} | ${e.date} | ${e.subject}\n${e.snippet}`).join('\n\n');
  const out = await ask(`Find the things this person needs to do, from their last two weeks of email.

Emails (subject, sender and a short preview only):
${list}

Goals (id: title):
${goalList}

Tasks they already have: ${openTitles.length ? openTitles.slice(0, 60).join('; ') : 'none'}

Reply with JSON only:
{ "tasks": [ { "title": "...", "goalId": "...", "minutes": 30, "email": 0 } ] }

Rules:
- At most 8 tasks. Only clear actions: something they promised in an email they sent ("I'll send it Friday"), or something someone directly asked them to do. Skip newsletters, ads, receipts, notifications and FYIs.
- Skip anything already in their tasks.
- title: start with a verb, under 10 words, name the person or topic. No em dashes.
- goalId: the goal it serves, or "life".
- minutes: 15, 30, 45, 60, 90 or 120.
- email: the [number] of the email it came from.`);
  const ids = new Set(goals.map((g) => g.id));
  return (out.tasks || []).slice(0, 8).map((t) => ({
    title: String(t.title || '').trim(),
    goalId: ids.has(t.goalId) ? t.goalId : 'life',
    minutes: [15, 30, 45, 60, 90, 120].includes(Number(t.minutes)) ? Number(t.minutes) : 30,
    from: emails[Number(t.email)] ? emails[Number(t.email)].subject : '',
  })).filter((t) => t.title);
}

export async function suggestForTask(input) {
  const key = getKey();
  if (!key) throw new Error('Add your Claude API key in Settings first.');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      // Required by Anthropic for requests made directly from a browser.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: 'medium' },
      messages: [{ role: 'user', content: buildPrompt(input) }],
    }),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch { /* ignore */ }
    if (res.status === 401) throw new Error('Claude did not accept the API key. Check it in Settings.');
    throw new Error(`Claude could not answer right now${detail ? ': ' + detail : ''}.`);
  }
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const parsed = parseJson(text);
  const firstSteps = (parsed.firstSteps || []).map(String).map((s) => s.trim()).filter(Boolean).slice(0, 3);
  const toGetItDone = (parsed.toGetItDone || []).map(String).map((s) => s.trim()).filter(Boolean).slice(0, 4);
  return { firstSteps, toGetItDone: toGetItDone.length ? toGetItDone : [FALLBACK_NEEDS] };
}
