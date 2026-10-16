/** For photos optimized on upload (`*.opt.webp`), returns a srcset of the 480/960/1600 WebP variants. */
export function srcSetFor(url?: string | null): string | undefined {
  if (!url || !/\.opt\.webp$/.test(url)) return undefined;
  const base = url.replace(/\.opt\.webp$/, "");
  return `${base}.opt-480.webp 480w, ${base}.opt-960.webp 960w, ${base}.opt-1600.webp 1600w, ${url} 2400w`;
}
