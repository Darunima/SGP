import { WorkspaceMember } from './supabase';

export type UserRole = 'leader' | 'admin' | 'member';

/**
 * Check if a member has a specific role or higher
 */
export function hasRole(member: WorkspaceMember | null | undefined, requiredRole: 'leader' | 'admin' | 'member'): boolean {
  if (!member) return false;
  
  const roleHierarchy = {
    'member': 0,
    'leader': 1,
    'admin': 2,
  };
  
  const memberRoleLevel = roleHierarchy[member.role as 'owner' | 'member'] ?? 
    (member.role === 'owner' ? 2 : 0);
  const requiredLevel = roleHierarchy[requiredRole];
  
  return memberRoleLevel >= requiredLevel;
}

/**
 * Check if member is owner or admin
 */
export function isLeaderOrAdmin(member: WorkspaceMember | null | undefined): boolean {
  return member?.role === 'owner' || member?.role === 'leader';
}

/**
 * Check if member is owner/admin or can perform action
 */
export function canManageTeam(member: WorkspaceMember | null | undefined): boolean {
  return member?.role === 'owner';
}

/**
 * Check if member can use AI features
 */
export function canUseAIFeatures(member: WorkspaceMember | null | undefined): boolean {
  return member?.role === 'owner';
}

/**
 * Get user role display name
 */
export function getRoleDisplayName(role: string): string {
  const roleNames: Record<string, string> = {
    'owner': 'Team Leader',
    'leader': 'Leader',
    'admin': 'Admin',
    'member': 'Member',
  };
  return roleNames[role] || 'Member';
}
