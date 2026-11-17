import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import {markPassages} from './marks';

// A Message is input from another Person, so it is never shown as HTML:
// react-markdown builds elements from the Markdown, shows any HTML in it as
// text, and drops links to unsafe protocols such as javascript:. A single
// line break stays a line break, as in chat apps. Passages that Replies
// quoted are marked as answered.
export function Markdown({text, answered = [], className}: {text: string; answered?: string[]; className?: string}) {
	return (
		<div className={className}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm, remarkBreaks]}
				rehypePlugins={[markPassages(answered)]}
				components={{
					a: ({node: _, ...props}) => <a {...props} target="_blank" rel="noreferrer" />,
				}}
			>
				{text}
			</ReactMarkdown>
		</div>
	);
}

// A Message's words without its Markdown, for one line such as in the list of
// Threads: every element is unwrapped to its text.
export function PlainText({text}: {text: string}) {
	return (
		<ReactMarkdown remarkPlugins={[remarkGfm]} allowedElements={[]} unwrapDisallowed>
			{text}
		</ReactMarkdown>
	);
}

