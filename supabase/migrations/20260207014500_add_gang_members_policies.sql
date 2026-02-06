-- Allow users to manage their own gang members (fix RLS insert/delete errors)
DROP POLICY IF EXISTS "Users can manage their gang members" ON public.gang_members;

CREATE POLICY "Users can manage their gang members" ON public.gang_members
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.gangs
    WHERE public.gangs.id = public.gang_members.gang_id
      AND public.gangs.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.gangs
    WHERE public.gangs.id = public.gang_members.gang_id
      AND public.gangs.user_id = auth.uid()
  )
);
