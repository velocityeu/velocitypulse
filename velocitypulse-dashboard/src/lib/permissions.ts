import type { MemberRole, MemberPermissions } from '@/types'

/**
 * Default permissions by organization member role.
 * Shared between members API and Clerk webhook auto-accept.
 */
export const DEFAULT_PERMISSIONS: Record<MemberRole, MemberPermissions> = {
  owner: {
    can_manage_billing: true,
    can_manage_agents: true,
    can_manage_devices: true,
    can_manage_members: true,
    can_view_audit_logs: true,
  },
  admin: {
    can_manage_billing: false,
    can_manage_agents: true,
    can_manage_devices: true,
    can_manage_members: true,
    can_view_audit_logs: true,
  },
  editor: {
    can_manage_billing: false,
    can_manage_agents: false,
    can_manage_devices: true,
    can_manage_members: false,
    can_view_audit_logs: false,
  },
  viewer: {
    can_manage_billing: false,
    can_manage_agents: false,
    can_manage_devices: false,
    can_manage_members: false,
    can_view_audit_logs: false,
  },
}
