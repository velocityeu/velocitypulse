-- ==============================================
-- VelocityPulse Agent Cascade Delete Migration
-- Migration: 003_agent_cascade_delete
-- ==============================================
--
-- Changes device foreign keys from SET NULL to CASCADE
-- When an agent is deleted, all associated devices are permanently deleted
--
-- WARNING: This is a destructive change. Backup data before running.

-- Step 1: Drop existing foreign key constraints on devices table
ALTER TABLE devices
  DROP CONSTRAINT IF EXISTS devices_agent_id_fkey;

ALTER TABLE devices
  DROP CONSTRAINT IF EXISTS devices_network_segment_id_fkey;

-- Step 2: Re-add constraints with CASCADE delete behavior
-- When agent is deleted: delete all devices associated with that agent
ALTER TABLE devices
  ADD CONSTRAINT devices_agent_id_fkey
    FOREIGN KEY (agent_id)
    REFERENCES agents(id)
    ON DELETE CASCADE;

-- When network segment is deleted: delete all devices in that segment
ALTER TABLE devices
  ADD CONSTRAINT devices_network_segment_id_fkey
    FOREIGN KEY (network_segment_id)
    REFERENCES network_segments(id)
    ON DELETE CASCADE;

-- Note: network_segments already has CASCADE delete to agents (from 001_multi_tenant_schema)
-- So the cascade chain is: agents → network_segments → devices
-- Deleting an agent will:
--   1. Delete all network_segments for that agent (CASCADE)
--   2. Delete all devices in those segments (CASCADE)
--   3. Delete all devices directly attached to the agent (CASCADE)
--   4. Delete all agent_commands for that agent (CASCADE - already set)

-- Add comment for documentation
COMMENT ON CONSTRAINT devices_agent_id_fkey ON devices IS
  'Cascade delete: when agent is deleted, all associated devices are permanently removed';

COMMENT ON CONSTRAINT devices_network_segment_id_fkey ON devices IS
  'Cascade delete: when network segment is deleted, all devices in that segment are permanently removed';
