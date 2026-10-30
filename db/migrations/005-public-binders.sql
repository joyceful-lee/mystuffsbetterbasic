DO $$ BEGIN
 ALTER TABLE binders ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public'));
 ALTER TABLE binders ADD COLUMN IF NOT EXISTS public_name text NOT NULL DEFAULT '';
 ALTER TABLE binders ADD COLUMN IF NOT EXISTS published_at timestamptz;
 CREATE INDEX IF NOT EXISTS binders_public ON binders(published_at DESC,id) WHERE visibility='public';
 CREATE TABLE IF NOT EXISTS binder_reactions (
  binder_id uuid NOT NULL REFERENCES binders(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  liked boolean NOT NULL DEFAULT false,
  subscribed_at timestamptz,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(binder_id,user_id)
 );
 CREATE INDEX IF NOT EXISTS binder_reactions_user ON binder_reactions(user_id,binder_id);
 ALTER TABLE binder_reactions ENABLE ROW LEVEL SECURITY;
END $$;
