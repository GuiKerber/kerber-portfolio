// Reads design tokens from css/tokens.css, so canvas and WebGL colors stay in
// sync with the stylesheet instead of repeating hex values in JS.
export function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
