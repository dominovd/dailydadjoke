import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';
import { slugFor } from './src/utils/slug.mjs';

const jokes = JSON.parse(readFileSync('./src/data/jokes.json', 'utf8'));

// Only the newest N joke pages are indexable (the rest are noindex) —
// keep the sitemap consistent with that. Must match INDEXABLE_JOKES in src/utils/jokes.js.
const INDEXABLE_JOKES = 10;
const indexableSlugs = new Set(
  [...jokes]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, INDEXABLE_JOKES)
    .map((j) => slugFor(j))
);

export default defineConfig({
  site: 'https://dailydadjoke.app',
  integrations: [
    sitemap({
      filter: (page) => {
        const m = page.match(/\/p\/([^/]+)\/?$/);
        if (!m) return true; // non-joke pages stay in the sitemap
        return indexableSlugs.has(m[1]);
      },
    }),
  ],
});
