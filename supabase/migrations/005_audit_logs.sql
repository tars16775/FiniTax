-- ============================================
-- Migration 005: Audit Logs
-- FiniTax — Activity tracking for compliance
-- ============================================

-- Audit log table: records every significant action
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL,
  user_email    TEXT NOT NULL DEFAULT '',
  user_name     TEXT NOT NULL DEFAULT '',

  -- What happened
  action        TEXT NOT NULL,          -- e.g. 'invoice.create', 'expense.approve', 'payroll.run'
  entity_type   TEXT NOT NULL,          -- e.g. 'invoice', 'expense', 'employee', 'tax_filing'
  entity_id     UUID,                   -- ID of the affected record (nullable for bulk ops)
  description   TEXT NOT NULL DEFAULT '',-- Human-readable description

  -- Contextual metadata (JSON)
  metadata      JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_audit_logs_org_created
  ON audit_logs(organization_id, created_at DESC);

CREATE INDEX idx_audit_logs_entity
  ON audit_logs(organization_id, entity_type, entity_id);

CREATE INDEX idx_audit_logs_action
  ON audit_logs(organization_id, action);

CREATE INDEX idx_audit_logs_user
  ON audit_logs(organization_id, user_id);

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs for their organizations"
  ON audit_logs FOR SELECT
  USING (organization_id IN (SELECT get_user_orgs()));

CREATE POLICY "Users can insert audit logs for their organizations"
  ON audit_logs FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_orgs()));
