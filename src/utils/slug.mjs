// Slug helpers shared by the site code and astro.config (keep dependency-free).

/** Short stable hash (4 hex chars) from a string. */
export function hash4(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(4, '0').slice(-4);
}

/** URL slug for a joke, e.g. "why-did-the-scarecrow-4c6c". */
export function slugFor(joke) {
  const words = joke.setup
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join('-');
  return `${words}-${hash4(joke.date)}`;
}
