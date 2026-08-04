/** Prefix public asset paths when built for a subpath (e.g. GitHub Pages project sites). */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBasePath(path: string): string {
  if (!path.startsWith("/")) return `${basePath}/${path}`;
  return `${basePath}${path}`;
}
