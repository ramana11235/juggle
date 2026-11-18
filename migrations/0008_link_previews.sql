-- When a Message's author removed the preview of its link, for everyone.
-- Empty means it never was, which the Worker reads as such.
ALTER TABLE messages ADD COLUMN preview_removed_at INTEGER;

-- Each link's preview, kept so its page is fetched once. found is 1 when the
-- page had a preview and 0 when it had none or could not be read. No image
-- means the page gave no picture.
CREATE TABLE link_previews (
	url TEXT PRIMARY KEY,
	found INTEGER NOT NULL,
	site TEXT NOT NULL DEFAULT '',
	title TEXT NOT NULL DEFAULT '',
	image TEXT,
	fetched_at INTEGER NOT NULL
);
