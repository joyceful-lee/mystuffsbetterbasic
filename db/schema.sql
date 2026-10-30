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

DO $migration$ BEGIN
 ALTER TABLE binder_reactions ADD COLUMN IF NOT EXISTS actor_name text NOT NULL DEFAULT '';
 CREATE TABLE IF NOT EXISTS binder_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id text NOT NULL,
  actor_id text NOT NULL,
  actor_name text NOT NULL,
  binder_id uuid NOT NULL REFERENCES binders(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('like','subscribe')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  read_at timestamptz,
  UNIQUE(binder_id,actor_id,kind)
 );
 CREATE INDEX IF NOT EXISTS binder_notifications_recipient ON binder_notifications(recipient_id,created_at DESC,id DESC);
 CREATE INDEX IF NOT EXISTS binder_notifications_unread ON binder_notifications(recipient_id) WHERE read_at IS NULL;
 ALTER TABLE binder_notifications ENABLE ROW LEVEL SECURITY;
 CREATE OR REPLACE FUNCTION notify_binder_reaction() RETURNS trigger LANGUAGE plpgsql AS $notify$
 DECLARE new_like boolean; new_subscription boolean;
 BEGIN
  new_like:=NEW.liked;
  new_subscription:=NEW.subscribed_at IS NOT NULL;
  IF TG_OP='UPDATE' THEN
   new_like:=NEW.liked AND NOT OLD.liked;
   new_subscription:=NEW.subscribed_at IS NOT NULL AND OLD.subscribed_at IS NULL;
  END IF;
  IF new_like THEN
   INSERT INTO binder_notifications(recipient_id,actor_id,actor_name,binder_id,kind)
   SELECT b.user_id,NEW.user_id,COALESCE(NULLIF(NEW.actor_name,''),'A collector'),b.id,'like' FROM binders b WHERE b.id=NEW.binder_id AND b.visibility='public' AND b.user_id<>NEW.user_id
   ON CONFLICT(binder_id,actor_id,kind) DO UPDATE SET actor_name=EXCLUDED.actor_name,created_at=clock_timestamp(),read_at=NULL;
  END IF;
  IF new_subscription THEN
   INSERT INTO binder_notifications(recipient_id,actor_id,actor_name,binder_id,kind)
   SELECT b.user_id,NEW.user_id,COALESCE(NULLIF(NEW.actor_name,''),'A collector'),b.id,'subscribe' FROM binders b WHERE b.id=NEW.binder_id AND b.visibility='public' AND b.user_id<>NEW.user_id
   ON CONFLICT(binder_id,actor_id,kind) DO UPDATE SET actor_name=EXCLUDED.actor_name,created_at=clock_timestamp(),read_at=NULL;
  END IF;
  RETURN NEW;
 END $notify$;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='binder_reaction_notifications' AND tgrelid='binder_reactions'::regclass) THEN
  CREATE TRIGGER binder_reaction_notifications AFTER INSERT OR UPDATE ON binder_reactions FOR EACH ROW EXECUTE FUNCTION notify_binder_reaction();
 END IF;
END $migration$;
