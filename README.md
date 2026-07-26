# Daily Dad Joke 🥸

A groan a day keeps the seriousness away. One delightfully questionable dad joke every morning.

Built with [Astro](https://astro.build) — fully static, no backend required.

## Quick start

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
```

## How it works

- **Jokes live in `src/data/jokes.json`** — one entry per date (`date`, `setup`, `punchline`), newest entry is "today's joke". Add a new dated entry to publish a new joke.
- **Home page** shows today's joke, the 3 most recent days in "Previously on Dad Joke...", and a *Show older groans* button that reveals 3 more days per click.
- **Archive** lists every joke (9 at a time, same load-more pattern) with **instant search** (by text or date like "JUL 24").
- **Every joke has its own page** at `/p/<slug>` (slug is generated from the setup + a short hash) with older/newer navigation and share.
- Every joke card carries the **Daily Dad Joke** branding + date, and links to the joke's page.
- "Tell me another" pulls a random joke from the vault into the main card; Share copies the joke + its permalink.
- The email form is decorative for now — wire it up to your ESP/Supabase later.

## Daily auto-generation

`scripts/generate-joke.mjs` + `.github/workflows/daily-joke.yml` publish a new joke automatically:

1. Every day at 05:30 UTC the GitHub Action runs the script.
2. The script asks Claude for **10 candidates** (system prompt encodes what makes a good dad joke: real pun, setup+punchline, <20 words, family-friendly, timeless, works in plain text, avoid classics + recent archive).
3. A second **judge** call scores candidates (pun_works / surprise / groan_factor / originality) and picks the winner.
4. A **dedup guard** compares the winner against the whole archive (token overlap) and fails the run instead of publishing a near-repeat.
5. The joke is appended to `src/data/jokes.json` and committed — your hosting (Netlify/Vercel) redeploys on push, `noindex`/sitemap windows shift automatically.

Setup (one-time):

1. Push this repo to GitHub.
2. Repo → Settings → Secrets and variables → Actions → add `ANTHROPIC_API_KEY` (get one at console.anthropic.com).
3. Connect the repo to Netlify/Vercel with build command `npm run build`, output `dist`.
4. Test manually: Actions tab → "Daily joke" → Run workflow. Locally: `ANTHROPIC_API_KEY=... node scripts/generate-joke.mjs --dry-run`.

The model is `claude-sonnet-4-5` by default (override with the `JOKE_MODEL` env var).

## Structure

```
src/
  data/jokes.json        ← the jokes
  utils/jokes.js         ← sorting + date formatting helpers
  components/            ← JokeCard, MiniJokeCard, Mustache
  layouts/Layout.astro   ← header / nav / footer / toast
  pages/                 ← index, archive, about
  styles/global.css      ← the retro design system
```
