CREATE OR REPLACE FUNCTION public.create_organization_with_admin(
  p_name TEXT,
  p_nit_number TEXT,
  p_nrc_number TEXT DEFAULT NULL,
  p_industry_code TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_org jsonb;
BEGIN
  -- Get the authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check NIT uniqueness
  IF EXISTS (SELECT 1 FROM organizations WHERE nit_number = p_nit_number) THEN
    RAISE EXCEPTION 'NIT already exists';
  END IF;

  -- Create the organization
  INSERT INTO organizations (name, nit_number, nrc_number, industry_code)
  VALUES (p_name, p_nit_number, p_nrc_number, p_industry_code)
  RETURNING id INTO v_org_id;

  -- Add creator as ADMIN
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'ADMIN');

  -- Return the full org record as JSON
  SELECT to_jsonb(o) INTO v_org
  FROM organizations o
  WHERE o.id = v_org_id;

  RETURN v_org;
END;
$$;
