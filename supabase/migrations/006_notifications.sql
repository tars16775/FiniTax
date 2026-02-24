-- ============================================
-- Migration 006: Notifications
-- FiniTax — In-app notification system
-- ============================================

-- ---- Notification Types ----
-- INVOICE_APPROVED   — An invoice was approved by MH
-- INVOICE_REJECTED   — An invoice was rejected
-- EXPENSE_APPROVED   — An expense was approved
-- EXPENSE_REJECTED   — An expense was rejected
-- PAYROLL_GENERATED  — A payroll run was created
-- PAYROLL_APPROVED   — A payroll run was approved
-- PAYROLL_PAID       — A payroll was marked as paid
-- TAX_CALCULATED     — A tax filing was auto-calculated
-- TAX_FILED          — A tax declaration was filed
-- TAX_DEADLINE       — Upcoming tax filing deadline
-- MEMBER_INVITED     — A new member was invited
-- MEMBER_JOINED      — A member accepted an invitation
-- LOW_STOCK          — Inventory item below reorder point
-- SYSTEM             — System-level notifications

CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,               -- recipient
  
  -- Notification content
  type            TEXT NOT NULL,                -- notification type key
  title           TEXT NOT NULL,                -- short title
  message         TEXT NOT NULL DEFAULT '',     -- detailed message
  
  -- Link to related entity
  entity_type     TEXT,                         -- e.g. 'invoice', 'expense'
  entity_id       UUID,                         -- ID of related record
  action_url      TEXT,                         -- dashboard URL to navigate to
  
  -- State
  is_read         BOOLEAN NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,
  
  -- Metadata
  metadata        JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_notifications_user_unread
  ON notifications(user_id, is_read, created_at DESC)
  WHERE is_read = false;

CREATE INDEX idx_notifications_user_org
  ON notifications(user_id, organization_id, created_at DESC);

CREATE INDEX idx_notifications_org
  ON notifications(organization_id, created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Insert allowed for org members (server-side creates via service role or user context)
CREATE POLICY "Users can insert notifications for their organizations"
  ON notifications FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_orgs()));

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());
