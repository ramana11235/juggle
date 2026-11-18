-- YouTube's videos were read from a page it serves Cloudflare without
-- Open Graph tags, so their kept previews held only the title "- YouTube".
-- Dropping them makes each one be read again, from YouTube's oEmbed address.
DELETE FROM link_previews
WHERE url LIKE 'http%://youtube.com/%'
	OR url LIKE 'http%://www.youtube.com/%'
	OR url LIKE 'http%://m.youtube.com/%'
	OR url LIKE 'http%://youtu.be/%';
