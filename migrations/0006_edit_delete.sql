-- When a Message was last edited, and when it was deleted. Empty means it
-- never was, which the Worker reads as such.
ALTER TABLE messages ADD COLUMN edited_at INTEGER;
ALTER TABLE messages ADD COLUMN deleted_at INTEGER;
