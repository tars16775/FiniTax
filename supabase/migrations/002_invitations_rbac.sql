-- FiniTax Phase 3: Invitations table + RBAC helpers
-- Run against: postgresql://postgres:Finitax1234!@db.gpizxeplpciqpkajcnjl.supabase.co:5432/postgres

-- ============================================
-- 1. Invitations table
-- ============================================
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'EMPLOYEE' CHECK (role IN ('ADMIN', 'EMPLOYEE', 'ACCOUNTANT')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED')),
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, invited_email, status)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(invited_email) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_invitations_org ON invitations(organization_id);

-- RLS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Admins of the org can see & manage invitations
CREATE POLICY "Org admins manage invitations"
  ON invitations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = invitations.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role = 'ADMIN'
    )
  );

-- Invited users can see their own invitations (by email match)
-- Note: This requires matching against the authenticated user's email.
-- Supabase auth.jwt() ->> 'email' gives us the current user email.
CREATE POLICY "Users see own invitations"
  ON invitations
  FOR SELECT
  USING (
    invited_email = (auth.jwt() ->> 'email')
  );

-- Updated_at trigger
CREATE TRIGGER set_invitations_updated_at
  BEFORE UPDATE ON invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 2. Function: accept invitation
-- ============================================
CREATE OR REPLACE FUNCTION accept_invitation(invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  existing RECORD;
BEGIN
  -- Get the invitation
  SELECT * INTO inv FROM invitations WHERE id = invitation_id AND status = 'PENDING';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitación no encontrada o ya procesada');
  END IF;
  
  -- Check not expired
  IF inv.expires_at < NOW() THEN
    UPDATE invitations SET status = 'EXPIRED', updated_at = NOW() WHERE id = invitation_id;
    RETURN jsonb_build_object('success', false, 'error', 'La invitación ha expirado');
  END IF;
  
  -- Check the accepting user's email matches
  IF inv.invited_email != (auth.jwt() ->> 'email') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Esta invitación no es para tu cuenta');
  END IF;
  
  -- Check if already a member
  SELECT * INTO existing FROM organization_members 
  WHERE organization_id = inv.organization_id AND user_id = auth.uid();
  
  IF FOUND THEN
    UPDATE invitations SET status = 'ACCEPTED', updated_at = NOW() WHERE id = invitation_id;
    RETURN jsonb_build_object('success', true, 'message', 'Ya eres miembro de esta empresa');
  END IF;
  
  -- Add as member
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (inv.organization_id, auth.uid(), inv.role);
  
  -- Mark invitation as accepted
  UPDATE invitations SET status = 'ACCEPTED', updated_at = NOW() WHERE id = invitation_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Invitación aceptada');
END;
$$;

-- ============================================
-- 3. Function: get pending invitations for current user
-- ============================================
CREATE OR REPLACE FUNCTION get_my_pending_invitations()
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  organization_name TEXT,
  role TEXT,
  invited_by_name TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.organization_id,
    o.name AS organization_name,
    i.role,
    COALESCE(p.first_name || ' ' || p.last_name, 'Unknown') AS invited_by_name,
    i.expires_at,
    i.created_at
  FROM invitations i
  JOIN organizations o ON o.id = i.organization_id
  LEFT JOIN user_profiles p ON p.id = i.invited_by
  WHERE i.invited_email = (auth.jwt() ->> 'email')
    AND i.status = 'PENDING'
    AND i.expires_at > NOW()
  ORDER BY i.created_at DESC;
END;
$$;
