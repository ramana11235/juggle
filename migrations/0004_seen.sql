-- How far each Person has seen in each Thread: the time the last Message
-- they have seen was saved. No row means they have seen nothing there yet.
CREATE TABLE seen (
	thread_id TEXT NOT NULL REFERENCES threads(id),
	person_id TEXT NOT NULL REFERENCES people(id),
	up_to INTEGER NOT NULL,
	PRIMARY KEY (thread_id, person_id)
);
