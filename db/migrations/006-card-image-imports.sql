CREATE TABLE IF NOT EXISTS card_image_imports (
 card_id uuid PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
 job_id uuid NOT NULL,
 sha256 text NOT NULL CHECK (length(sha256)=64),
 completed_at timestamptz,
 verified_bytes integer,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','superseded'))
);
ALTER TABLE card_image_imports ENABLE ROW LEVEL SECURITY;
