-- A Message in a side discussion names the main-conversation Message it is
-- under; a Message in the main conversation has none.
ALTER TABLE messages ADD COLUMN side_of TEXT REFERENCES messages(id);
CREATE INDEX messages_by_side ON messages(side_of);

-- How far each Person has seen in each side discussion, as `seen` holds it
-- for the main conversation. No row means they have seen nothing there yet.
CREATE TABLE side_seen (
	side_of TEXT NOT NULL REFERENCES messages(id),
	person_id TEXT NOT NULL REFERENCES people(id),
	up_to INTEGER NOT NULL,
	PRIMARY KEY (side_of, person_id)
);
