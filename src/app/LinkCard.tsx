import {Link as LinkIcon, X} from 'lucide-react';
import {useEffect, useState} from 'react';
import type {LinkPreview} from '../shared/api';
import {api} from './api';
import {cn} from './lib/utils';
import {iconButton, label} from './ui';

// Each link's preview, asked of the Worker once per page load however many
// Messages and screens show it.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const asked = new Map<string, Promise<LinkPreview>>();
const previewOf = (url: string) => {
	// A failed ask is forgotten, so the next screen to show the link asks again.
	if (!asked.has(url))
		asked.set(
			url,
			api.preview(url).catch((): LinkPreview => {
				asked.delete(url);
				return {kind: 'none'};
			}),
		);
	return asked.get(url)!;
};

// The card under a Message for its first link: the link's site and a link
// icon while its preview loads, then the page's picture and title, or
// nothing for a page with no preview. Only the Message's author can remove it.
export function LinkCard({url, mine, onRemove}: {url: string; mine: boolean; onRemove: () => void}) {
	const [preview, setPreview] = useState<{kind: 'loading'} | LinkPreview>({kind: 'loading'});
	const [pictureFailed, setPictureFailed] = useState(false);
	// A card that was loading folds away once its page turns out to have no
	// preview, unless the device asks for reduced motion; then it is gone.
	const [folded, setFolded] = useState(false);
	useEffect(() => {
		let current = true;
		setPreview({kind: 'loading'});
		void previewOf(url).then((found) => current && setPreview(found));
		return () => void (current = false);
	}, [url]);
	if (preview.kind === 'none' && (folded || reducedMotion.matches)) return null;
	if (preview.kind === 'none')
		return <div aria-hidden data-preview="folding" className="h-24 max-w-md overflow-hidden rounded-box border border-border bg-card fold-away" onAnimationEnd={() => setFolded(true)} />;
	const picture = preview.kind === 'found' && preview.image.kind === 'image' && !pictureFailed ? preview.image.url : '';
	return (
		<div data-preview={preview.kind} className="relative max-w-md">
			<a href={url} target="_blank" rel="noreferrer" className="flex h-24 items-stretch gap-3 overflow-hidden rounded-box border border-border bg-card">
				<span className="relative grid w-24 shrink-0 place-items-center bg-accent">
					<LinkIcon className={cn('size-4 opacity-60', preview.kind === 'loading' && 'motion-safe:animate-pulse')} />
					{picture && <img src={picture} alt="" onError={() => setPictureFailed(true)} className="absolute inset-0 size-full object-cover motion-safe:fade-in" />}
				</span>
				{preview.kind === 'loading' ? (
					<span className="flex min-w-0 flex-1 flex-col justify-center gap-2 py-3 pr-4">
						<span className={cn('truncate', label)}>{new URL(url).hostname.replace(/^www\./, '')}</span>
						<span className="h-3 w-3/4 rounded-full bg-accent motion-safe:animate-pulse" />
					</span>
				) : (
					<span data-found className={cn('flex min-w-0 flex-1 flex-col justify-center gap-1 py-3 motion-safe:fade-in', mine ? 'pr-12' : 'pr-4')}>
						<span className={cn('truncate', label)}>{preview.site}</span>
						<span className="line-clamp-2 font-serif text-compact leading-snug">{preview.title}</span>
					</span>
				)}
			</a>
			{mine && preview.kind === 'found' && (
				<button onClick={onRemove} aria-label="Remove preview" className={cn(iconButton, 'absolute top-2 right-2 p-1 opacity-60 hover:opacity-100')}>
					<X className="size-4" />
				</button>
			)}
		</div>
	);
}
