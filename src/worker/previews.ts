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

// YouTube answers Cloudflare's servers with a page that has no Open Graph
// tags, so a video's preview is read from the oEmbed address YouTube gives
// apps, which describes it as JSON. That address describes only videos and
// playlists, so YouTube's other pages, such as a channel, are read as pages.
const youTube = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);
const isYouTubeVideo = ({hostname, pathname}: URL) =>
	hostname === 'youtu.be' || (youTube.has(hostname) && (pathname === '/watch' || pathname === '/playlist' || /^\/(shorts|live)\/./.test(pathname)));
export const oEmbedOf = (url: string): {kind: 'oembed'; url: string} | {kind: 'page'} =>
	isYouTubeVideo(new URL(url)) ? {kind: 'oembed', url: `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`} : {kind: 'page'};

export async function previewOfOEmbed(response: Response): Promise<LinkPreview> {
	const said = await response.json<{title?: unknown; provider_name?: unknown; thumbnail_url?: unknown}>().catch(() => ({}) as Record<string, unknown>);
	if (typeof said.title !== 'string' || said.title.trim() === '') return {kind: 'none'};
	const image = typeof said.thumbnail_url === 'string' ? said.thumbnail_url : '';
	return {
		kind: 'found',
		site: typeof said.provider_name === 'string' && said.provider_name.trim() ? said.provider_name.trim() : 'YouTube',
		title: said.title.trim(),
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
