CREATE TABLE IF NOT EXISTS binders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id text NOT NULL,
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
 game text NOT NULL DEFAULT 'Other',
 color text NOT NULL DEFAULT 'lime',
 bio text NOT NULL DEFAULT '' CHECK (length(bio) <= 180),
 background_color text NOT NULL DEFAULT 'navy',
 theme text NOT NULL DEFAULT 'classic',
 position integer NOT NULL DEFAULT 0,
 cover_card_id uuid,
 share_token text UNIQUE,
 guest_source_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id, guest_source_id)
);
CREATE INDEX IF NOT EXISTS binders_owner ON binders(user_id);
CREATE TABLE IF NOT EXISTS cards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 binder_id uuid NOT NULL REFERENCES binders(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
 deck text NOT NULL DEFAULT '' CHECK (length(deck) <= 100),
 card_number text NOT NULL DEFAULT '' CHECK (length(card_number) <= 40),
 image text NOT NULL DEFAULT '' CHECK (length(image) <= 350000),
 rarity text NOT NULL DEFAULT 'Common',
 favorite boolean NOT NULL DEFAULT false,
 position integer NOT NULL DEFAULT 0,
 guest_source_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(binder_id, guest_source_id)
);
CREATE INDEX IF NOT EXISTS cards_binder ON cards(binder_id);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='binders_cover_card_id_fkey' AND conrelid='binders'::regclass) THEN
  ALTER TABLE binders ADD CONSTRAINT binders_cover_card_id_fkey FOREIGN KEY(cover_card_id) REFERENCES cards(id) ON DELETE SET NULL;
 END IF;
END $$;
ALTER TABLE binders ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
-- No public policies: all access goes through authenticated server routes.
-- The server uses the owner connection and explicitly checks user_id.
CREATE TABLE IF NOT EXISTS collection_preferences (
 user_id text PRIMARY KEY,
 sample_hidden boolean NOT NULL DEFAULT false
);
ALTER TABLE collection_preferences ENABLE ROW LEVEL SECURITY;

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
CREATE TABLE IF NOT EXISTS card_image_imports (
 card_id uuid PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
 job_id uuid NOT NULL,
 sha256 text NOT NULL CHECK (length(sha256)=64),
 completed_at timestamptz,
 verified_bytes integer,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','superseded'))
);
ALTER TABLE card_image_imports ENABLE ROW LEVEL SECURITY;
