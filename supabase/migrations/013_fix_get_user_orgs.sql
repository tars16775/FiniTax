-- Fix get_user_orgs: add SET search_path = public so auth.uid() resolves correctly
CREATE OR REPLACE FUNCTION public.get_user_orgs()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid();
$$;
