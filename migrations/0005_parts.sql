-- The parts of each Reply, in order: its own words and its quotes of earlier
-- Messages, each quote with its own copy of the words it quotes. A Message
-- with no quotes has no rows here and is its body alone.
CREATE TABLE message_parts (
	message_id TEXT NOT NULL REFERENCES messages(id),
	position INTEGER NOT NULL,
	kind TEXT NOT NULL CHECK (kind IN ('text', 'passage', 'whole')),
	quoted_id TEXT REFERENCES messages(id),
	text TEXT NOT NULL,
	PRIMARY KEY (message_id, position)
);
CREATE INDEX message_parts_by_quoted ON message_parts(quoted_id);
