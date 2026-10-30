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
