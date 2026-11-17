-- The name a Person gave themselves. Empty until they give one, which the
-- Worker reads as having no name yet.
ALTER TABLE people ADD COLUMN name TEXT;
