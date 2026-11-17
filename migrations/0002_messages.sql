-- A Message's id is made by the screen that sends it, so a resend with the
-- same id is recognised and saved once.
CREATE TABLE messages (
	id TEXT PRIMARY KEY,
	thread_id TEXT NOT NULL REFERENCES threads(id),
	author_id TEXT NOT NULL REFERENCES people(id),
	body TEXT NOT NULL,
	sent_at INTEGER NOT NULL
);
CREATE INDEX messages_by_thread ON messages(thread_id, sent_at);
CREATE INDEX messages_by_time ON messages(sent_at);
CREATE INDEX threads_by_time ON threads(started_at);
