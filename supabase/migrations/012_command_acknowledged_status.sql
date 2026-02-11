-- Add 'acknowledged' status to agent_commands
-- This intermediate state prevents duplicate execution via heartbeat re-delivery

-- Drop and recreate the status CHECK constraint to include 'acknowledged'
ALTER TABLE agent_commands DROP CONSTRAINT IF EXISTS agent_commands_status_check;
ALTER TABLE agent_commands ADD CONSTRAINT agent_commands_status_check
  CHECK (status IN ('pending', 'acknowledged', 'completed', 'failed'));

-- Rebuild partial index to include acknowledged (pending commands need processing, acknowledged do not)
DROP INDEX IF EXISTS idx_commands_status;
CREATE INDEX idx_commands_status ON agent_commands(status) WHERE status IN ('pending', 'acknowledged');
