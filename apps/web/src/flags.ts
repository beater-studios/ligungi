import type { Country } from '@ligungi/protocol';

// Every flag is its own file, fetched only when a page shows it.
const FILES = import.meta.glob<string>('./assets/flags/*.svg', { query: '?url&no-inline', import: 'default', eager: true });

const URLS = new Map(Object.entries(FILES).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.svg'.length), url]));

export const flagUrl = (country: Country): string | undefined => URLS.get(country);
