// Daily joke generator for dailydadjoke.app
//
// Flow: generate N candidates -> judge picks the best -> dedup vs archive -> append to jokes.json
// Usage: ANTHROPIC_API_KEY=... node scripts/generate-joke.mjs [--date YYYY-MM-DD] [--dry-run]
//
// Designed to run in GitHub Actions on a daily schedule (see .github/workflows/daily-joke.yml).

import { readFileSync, writeFileSync } from 'node:fs';

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set');
  process.exit(1);
}

const MODEL = process.env.JOKE_MODEL || 'claude-sonnet-4-5';
const JOKES_PATH = new URL('../src/data/jokes.json', import.meta.url);
const DRY_RUN = process.argv.includes('--dry-run');

const dateArg = process.argv.indexOf('--date');
const today =
  dateArg !== -1 ? process.argv[dateArg + 1] : new Date().toISOString().slice(0, 10);

const jokes = JSON.parse(readFileSync(JOKES_PATH, 'utf8'));

if (jokes.some((j) => j.date === today)) {
  console.log(`Joke for ${today} already exists — nothing to do.`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Anthropic API helper
// ---------------------------------------------------------------------------

async function ask(system, user, maxTokens = 1500) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.content.map((b) => b.text ?? '').join('');
}

function extractJson(text) {
  // Model is asked for raw JSON, but be tolerant of ```json fences.
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  return JSON.parse(m[1].trim());
}

// ---------------------------------------------------------------------------
// Step 1 — generate candidates
// ---------------------------------------------------------------------------

const recentSetups = jokes.slice(0, 60).map((j) => `- ${j.setup} ${j.punchline}`).join('\n');

const GENERATOR_SYSTEM = `You are the head writer for "Daily Dad Joke" — a beloved site that publishes exactly one classic dad joke every morning.

What makes a great dad joke (all are required):
- It is built on a PUN or wordplay: a double meaning, homophone, or literal reading of an idiom. No pun — no joke.
- Setup + punchline structure. The setup is an innocent, ordinary question or statement; the punchline lands the wordplay.
- Short: setup and punchline together under 20 words.
- The reader should groan and smile at the same time. Corny is the goal; witty-clever is a bonus; edgy is a failure.
- 100% family-friendly: no politics, no innuendo, no stereotypes, no put-downs of any group or person.
- Timeless: no references to current events, brands, celebrities, or technology that will date the joke.
- It must work in PLAIN TEXT — no reliance on spelling tricks the reader can't hear, or intonation the reader can't see.

Avoid the most overused classics (scarecrow/outstanding in his field, nacho cheese, impasta, two-tired, etc.) and anything close to the jokes the site has already published.`;

const generatorPrompt = `Here are jokes the site has already published — do NOT repeat or closely paraphrase any of them:

${recentSetups}

Write 10 NEW dad joke candidates. Vary the topics (food, animals, household objects, professions, nature, music, sports...) and vary the pun mechanism (homophone, double meaning, literal idiom).

Return ONLY a JSON array, no commentary:
[{"setup": "...", "punchline": "...", "topic": "...", "mechanism": "homophone|double-meaning|literal-idiom"}]`;

console.log('Generating candidates…');
const candidates = extractJson(await ask(GENERATOR_SYSTEM, generatorPrompt));
console.log(`  got ${candidates.length} candidates`);

// ---------------------------------------------------------------------------
// Step 2 — judge picks the best
// ---------------------------------------------------------------------------

const JUDGE_SYSTEM = `You are a ruthless comedy editor reviewing dad jokes for publication. You know that most AI-generated dad jokes fail in predictable ways: the pun doesn't actually work phonetically, the setup telegraphs the punchline, or the joke is a worn-out classic with the serial numbers filed off.

Score each joke 1-10 on each dimension:
- pun_works: does the wordplay actually hold up when read aloud? (a pun that needs explaining = 1)
- surprise: is the punchline unexpected, or visible from the setup a mile away?
- groan_factor: the signature dad-joke feeling — corny but irresistible
- originality: penalize anything that feels like a rephrased classic

Be harsh. A publishable joke averages 7+. Most candidates should score lower.`;

const judgePrompt = `Score these candidates and pick the single best one for tomorrow's front page.

${JSON.stringify(candidates, null, 2)}

Return ONLY JSON, no commentary:
{"scores": [{"index": 0, "pun_works": 0, "surprise": 0, "groan_factor": 0, "originality": 0, "verdict": "one short sentence"}], "winner_index": 0, "why": "one sentence"}`;

console.log('Judging…');
const verdict = extractJson(await ask(JUDGE_SYSTEM, judgePrompt));
const winner = candidates[verdict.winner_index];
console.log(`  winner: ${winner.setup} ${winner.punchline}`);
console.log(`  why: ${verdict.why}`);

// ---------------------------------------------------------------------------
// Step 3 — dedup guard against the whole archive
// ---------------------------------------------------------------------------

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function similarity(a, b) {
  // crude token overlap — enough to catch paraphrased repeats
  const ta = new Set(normalize(a).split(' '));
  const tb = new Set(normalize(b).split(' '));
  const inter = [...ta].filter((t) => tb.has(t) && t.length > 3).length;
  return inter / Math.max(1, Math.min(ta.size, tb.size));
}

const winnerText = `${winner.setup} ${winner.punchline}`;
const tooSimilar = jokes.find((j) => similarity(winnerText, `${j.setup} ${j.punchline}`) > 0.6);
if (tooSimilar) {
  console.error(`Winner too similar to published joke from ${tooSimilar.date}: "${tooSimilar.setup}"`);
  console.error('Failing so the workflow can retry on the next run.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 4 — publish
// ---------------------------------------------------------------------------

const entry = { date: today, setup: winner.setup.trim(), punchline: winner.punchline.trim() };

if (DRY_RUN) {
  console.log('[dry-run] would append:', JSON.stringify(entry));
} else {
  jokes.unshift(entry);
  jokes.sort((a, b) => b.date.localeCompare(a.date));
  // keep the file's one-line-per-joke formatting
  const body = jokes
    .map(
      (j) =>
        `  { "date": ${JSON.stringify(j.date)}, "setup": ${JSON.stringify(j.setup)}, "punchline": ${JSON.stringify(j.punchline)} }`
    )
    .join(',\n');
  writeFileSync(JOKES_PATH, `[\n${body}\n]\n`);
  console.log(`Published joke for ${today}.`);
}
