DROP POLICY IF EXISTS "Authenticated users can create meetings" ON public.meetings;

CREATE POLICY "Anyone can create meetings"
ON public.meetings
FOR INSERT
TO public
WITH CHECK (
  (auth.uid() IS NULL AND host_id IS NULL)
  OR (auth.uid() = host_id)
);