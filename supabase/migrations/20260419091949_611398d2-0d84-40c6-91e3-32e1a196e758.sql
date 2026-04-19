-- Restrict Realtime subscriptions to users authorized for the channel topic.
-- Topic convention used by the app: postgres_changes on schema=public, table=inventory_items|stock_movements
-- Supabase routes those to realtime.messages with extension='postgres_changes'.
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read realtime by dept" ON realtime.messages;
CREATE POLICY "auth read realtime by dept"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'kitchen'::public.app_role)
  OR public.has_role(auth.uid(), 'bar'::public.app_role)
);