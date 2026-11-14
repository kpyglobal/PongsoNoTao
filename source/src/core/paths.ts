export function baseUrl(): string {
  const b = import.meta.env.BASE_URL ?? './';
  return b.endsWith('/') ? b : `${b}/`;
}

export function assetUrl(path: string): string {
  return `${baseUrl()}${path.replace(/^\//, '')}`;
}
