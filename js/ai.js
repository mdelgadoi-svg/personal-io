// Claude suggestions for a task: three tiny first steps and what it needs.
// Uses your own Claude API key, saved only in this browser (Settings).
// Only the task title, its goal and the goal's why are sent to Claude.

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

function buildPrompt({ title, goal, why, minutes, place }) {
  return `You help someone with ADHD start tasks. Starting is the hardest part, so first steps must be tiny, physical and concrete.

Task: ${title}
Goal it serves: ${goal || 'not given'}
Why the goal matters: ${why || 'not given'}
Time planned: ${minutes ? minutes + ' minutes' : 'not given'}
Where: ${place || 'not given'}

Reply with JSON only, no other text:
{
  "firstSteps": ["...", "...", "..."],
  "toGetItDone": ["..."]
}

Rules:
- firstSteps: exactly 3 steps, each doable in under 20 seconds, in order. Start with setting up the space (for example: close other windows, put the phone face down), then open the exact thing needed, then the very first action. Each step under 12 words.
- toGetItDone: 1 to 4 short items the task truly needs (materials, documents, people, prep). Only include what you can reasonably infer from the task and goal. If you cannot tell, return an empty list.
- Plain words. No em dashes.`;
}

function parseJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Claude did not return a usable answer. Try again.');
  return JSON.parse(text.slice(start, end + 1));
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
