import jokes from '../data/jokes.json';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

import { slugFor } from './slug.mjs';

export { slugFor };

/** How many of the newest jokes keep their pages indexable (older ones get noindex). */
export const INDEXABLE_JOKES = 10;

/** All jokes, newest first, each with a computed `slug`. */
export function allJokes() {
  return [...jokes]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((j) => ({ ...j, slug: slugFor(j) }));
}

/** "2026-07-26" -> "JUL 26" */
export function fmtShort(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

/** "2026-07-26" -> "July 26, 2026" */
export function fmtLong(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[m - 1]} ${d}, ${y}`;
}

/** Split text into [head, tail] where tail is the last `n` words. */
export function splitLast(text, n = 1) {
  const words = text.trim().split(/\s+/);
  if (words.length <= n) return ['', text.trim()];
  return [words.slice(0, -n).join(' ') + ' ', words.slice(-n).join(' ')];
}
