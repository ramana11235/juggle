import {onTheWeb, type LinkPreview} from '../shared/api';

// Reads a link's preview from its page: the Open Graph tags pages publish for
// chat apps, falling back to the page's <title> and the link's address.
export async function previewOfPage(url: string, response: Response): Promise<LinkPreview> {
	if (!response.ok || !(response.headers.get('Content-Type') ?? '').includes('text/html')) return {kind: 'none'};
	const tags: Record<string, string> = {};
	let title = '';
	await new HTMLRewriter()
		.on('meta[property^="og:"]', {
			element: (meta) => {
				const name = meta.getAttribute('property')!;
				tags[name] ??= meta.getAttribute('content') ?? '';
			},
		})
		.on('head > title', {text: (text) => void (title += text.text)})
		.transform(response)
		.arrayBuffer();
	const named = decode(tags['og:title'] ?? title).trim();
	if (named === '') return {kind: 'none'};
	const image = tags['og:image'] && URL.canParse(decode(tags['og:image']), url) ? new URL(decode(tags['og:image']), url).href : '';
	return {
		kind: 'found',
		site: decode(tags['og:site_name'] ?? '').trim() || new URL(url).hostname.replace(/^www\./, ''),
		title: named,
		image: onTheWeb(image) ? {kind: 'image', url: image} : {kind: 'none'},
	};
}

// HTMLRewriter gives attributes and text as written, with entities such as &amp;.
const entities: Record<string, string> = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' '};
const decode = (text: string) =>
	text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z0-9]+);/gi, (whole, name: string) =>
		name.startsWith('#x') || name.startsWith('#X') ? String.fromCodePoint(parseInt(name.slice(2), 16)) : name.startsWith('#') && name !== '#39' ? String.fromCodePoint(Number(name.slice(1))) : (entities[name.toLowerCase()] ?? whole),
	);

// Fetches a link's page as a preview fetcher, giving up after five seconds so
// a slow site never holds a card in its loading state for long.
export const fetchPage = (url: string) =>
	fetch(url, {headers: {'User-Agent': 'Mozilla/5.0 (compatible; JugglePreview/1.0)', Accept: 'text/html'}, redirect: 'follow', signal: AbortSignal.timeout(5000)});

// A fetcher that reaches only pages on one origin, and finds no page anywhere else.
export const onlyFrom = (origin: string) => (url: string) => (new URL(url).origin === origin ? fetchPage(url) : Promise.reject(new Error(`${url} is not on ${origin}`)));
