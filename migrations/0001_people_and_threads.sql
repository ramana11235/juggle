-- A Person is known by the email they sign in with.
CREATE TABLE people (
	id TEXT PRIMARY KEY,
	email TEXT NOT NULL UNIQUE,
	joined_at INTEGER NOT NULL
);

-- A Thread's id is made by the screen that starts it, so a retried start is
-- recognised. started_by is who started it, for telling a retry from a clash.
CREATE TABLE threads (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	started_by TEXT NOT NULL REFERENCES people(id),
	started_at INTEGER NOT NULL
);

-- The People in each Thread.
CREATE TABLE thread_people (
	thread_id TEXT NOT NULL REFERENCES threads(id),
	person_id TEXT NOT NULL REFERENCES people(id),
	PRIMARY KEY (thread_id, person_id)
);
CREATE INDEX thread_people_by_person ON thread_people(person_id);
