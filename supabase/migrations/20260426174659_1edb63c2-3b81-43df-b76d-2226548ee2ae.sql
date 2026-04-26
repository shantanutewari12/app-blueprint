
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP POLICY IF EXISTS "Authenticated users can create meetings" ON public.meetings;
CREATE POLICY "Authenticated users can create meetings"
  ON public.meetings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Anyone can send messages" ON public.meeting_messages;
CREATE POLICY "Anyone can send messages to live meetings"
  ON public.meeting_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_id AND m.ended_at IS NULL
    )
  );
