export function usePermissions() {
    const role = new URLSearchParams(window.location.search).get('role') || 'dentist';
    return {
        canDelete: role === 'dentist',
        canViewStats: role === 'dentist',
        canManageRoles: role === 'dentist',
        role,
    };
}
