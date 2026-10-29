import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  UserPlus,
  Search,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  UserX,
  UserCheck,
  Trash2,
  Edit2,
  Lock,
  History,
  Phone,
  Mail,
  Calendar,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { DatabaseService } from '@/services/db.service';
import { useAuth } from '@/context/AuthContext';
import { User, Role, UserRole, UserAuditLog, UserSummary } from '@/types/database.types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

export function UserManagement() {
  const { t, i18n } = useTranslation();
  const { user: currentUser } = useAuth();
  const isRtl = i18n.language === 'ar';

  const isAdmin = currentUser?.role_name === 'ADMIN';
  const isManager = currentUser?.role_name === 'MANAGER';

  // Users state
  const [users, setUsers] = useState<User[]>(() => DatabaseService.getCachedUsersSync() || []);
  const [roles, setRoles] = useState<Role[]>([]);
  const [summary, setSummary] = useState<UserSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const cached = DatabaseService.getCachedUsersSync();
    return !cached || cached.length === 0;
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [auditLogs, setAuditLogs] = useState<UserAuditLog[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role_name: 'STAFF' as UserRole,
  });
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    role_id: '',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusActionId, setStatusActionId] = useState<string | null>(null);

  // Load users & roles
  const loadData = useCallback(async (showSkeleton: boolean = false) => {
    if (showSkeleton) setIsLoading(true);
    try {
      const [usersData, rolesData, summaryData] = await Promise.all([
        DatabaseService.getUsers(),
        DatabaseService.getRoles(),
        DatabaseService.getUserSummary(),
      ]);
      setUsers(usersData);
      setRoles(rolesData);
      setSummary(summaryData);
    } catch (err: any) {
      console.error('[UserManagement] Failed to load data:', err);
    } finally {
      if (showSkeleton) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = DatabaseService.getCachedUsersSync();
    loadData(!cached || cached.length === 0);
  }, [loadData]);

  // Allowed roles for creation/assignment based on acting user
  const allowedCreatableRoles: UserRole[] = useMemo(() => {
    if (isAdmin) return ['ADMIN', 'MANAGER', 'CASHIER', 'STAFF'];
    if (isManager) return ['CASHIER', 'STAFF'];
    return [];
  }, [isAdmin, isManager]);

  // Check if target user is editable by current user
  const canManageTargetUser = useCallback((targetUser: User): boolean => {
    if (isAdmin) return true;
    if (isManager) {
      const targetRole = targetUser.role?.name;
      // Manager CANNOT manage Admin or Manager accounts
      return targetRole === 'CASHIER' || targetRole === 'STAFF';
    }
    return false;
  }, [isAdmin, isManager]);

  // Handle Create User
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!currentUser) return;
    if (!createForm.name.trim()) {
      setFormError('Full name is required.');
      return;
    }
    if (!createForm.email.trim() || !createForm.email.includes('@')) {
      setFormError('A valid email address is required.');
      return;
    }
    if (createForm.password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }
    if (isManager && !['CASHIER', 'STAFF'].includes(createForm.role_name)) {
      setFormError('Managers can only create Cashier or Staff accounts.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await DatabaseService.createUser(currentUser.role_name, currentUser.id, createForm);
      setUsers(prev => [created, ...prev]);
      setIsCreateModalOpen(false);
      setCreateForm({ name: '', email: '', password: '', phone: '', role_name: 'STAFF' });
      // Refresh summary
      DatabaseService.getUserSummary().then(setSummary);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create user account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit User
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !currentUser) return;
    setFormError('');

    if (!editForm.name.trim()) {
      setFormError('Full name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await DatabaseService.updateUser(
        currentUser.role_name,
        currentUser.id,
        editingUser.id,
        {
          name: editForm.name,
          phone: editForm.phone,
          role_id: editForm.role_id,
        }
      );

      setUsers(prev => prev.map(u => u.id === editingUser.id ? updated : u));
      setIsEditModalOpen(false);
      setEditingUser(null);
      DatabaseService.getUserSummary().then(setSummary);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update user profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Toggle Status (Activate / Deactivate)
  const handleToggleStatus = async (targetUser: User) => {
    if (!currentUser) return;
    const newStatus = !targetUser.is_active;
    const confirmMessage = newStatus
      ? `Are you sure you want to reactivate account "${targetUser.name}"?`
      : `Are you sure you want to deactivate "${targetUser.name}"? They will lose application access, but all historical orders and transactions will be preserved.`;

    if (!window.confirm(confirmMessage)) return;

    setStatusActionId(targetUser.id);
    try {
      const updated = await DatabaseService.toggleUserStatus(
        currentUser.role_name,
        currentUser.id,
        targetUser.id,
        newStatus
      );
      setUsers(prev => prev.map(u => u.id === targetUser.id ? updated : u));
      DatabaseService.getUserSummary().then(setSummary);
    } catch (err: any) {
      alert(err.message || 'Status update failed.');
    } finally {
      setStatusActionId(null);
    }
  };

  // Handle Password Reset
  const handleResetPassword = async (targetUser: User) => {
    if (!currentUser) return;
    if (!window.confirm(`Send password reset email to ${targetUser.email}?`)) return;

    try {
      const res = await DatabaseService.sendPasswordReset(currentUser.role_name, currentUser.id, targetUser.id);
      alert(res.message);
    } catch (err: any) {
      alert(err.message || 'Password reset failed.');
    }
  };

  // Handle Safe Delete User
  const handleDeleteUser = async (targetUser: User) => {
    if (!currentUser) return;

    // Check safety first
    const safetyCheck = await DatabaseService.checkCanDeleteUser(targetUser.id);
    if (!safetyCheck.can_delete) {
      alert(`Cannot delete user: ${safetyCheck.message}`);
      return;
    }

    if (!window.confirm(`${t('users.confirmDeleteTitle')} - ${targetUser.name}\n${t('users.confirmDeleteMsg')}`)) {
      return;
    }

    try {
      await DatabaseService.deleteUser(currentUser.role_name, currentUser.id, targetUser.id);
      setUsers(prev => prev.filter(u => u.id !== targetUser.id));
      DatabaseService.getUserSummary().then(setSummary);
      alert(t('users.successDeleted'));
    } catch (err: any) {
      alert(err.message || t('common.retry'));
    }
  };

  // Open Edit Modal
  const openEditModal = (targetUser: User) => {
    setEditingUser(targetUser);
    setEditForm({
      name: targetUser.name,
      phone: targetUser.phone || '',
      role_id: targetUser.role_id,
    });
    setFormError('');
    setIsEditModalOpen(true);
  };

  // Open Audit Log Modal
  const openAuditLogs = async () => {
    setIsAuditModalOpen(true);
    setIsLoadingAudit(true);
    try {
      const logs = await DatabaseService.getUserAuditLogs();
      setAuditLogs(logs);
    } catch (e) {
      console.warn('Failed to load audit logs:', e);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    const term = deferredSearchTerm.toLowerCase().trim();
    return users.filter(u => {
      const matchesSearch = !term ||
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u.phone && u.phone.includes(term));

      const matchesRole = roleFilter === 'ALL' || u.role?.name === roleFilter;

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.is_active) ||
        (statusFilter === 'INACTIVE' && !u.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, deferredSearchTerm, roleFilter, statusFilter]);

  // Role Badge Helper
  const renderRoleBadge = (roleName?: UserRole) => {
    switch (roleName) {
      case 'ADMIN':
        return <Badge variant="warning" className="bg-purple-900/40 text-purple-300 border-purple-700/50">ADMIN</Badge>;
      case 'MANAGER':
        return <Badge variant="info" className="bg-blue-900/40 text-blue-300 border-blue-700/50">MANAGER</Badge>;
      case 'CASHIER':
        return <Badge variant="success" className="bg-emerald-900/40 text-emerald-300 border-emerald-700/50">CASHIER</Badge>;
      case 'STAFF':
      default:
        return <Badge variant="default" className="bg-slate-800 text-slate-300 border-slate-700">STAFF</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-resto-charcoal-900 via-resto-charcoal-800 to-resto-terracotta-900 text-white shadow-elevated flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-resto-terracotta-400 shrink-0">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl font-bold">{t('users.title')}</h2>
              <Badge variant="warning" className="text-xs bg-resto-terracotta-500 text-white border-none">
                {currentUser?.role_name} Access
              </Badge>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-xl font-light">
              {t('users.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {isAdmin && (
            <Button
              variant="outline"
              size="md"
              onClick={openAuditLogs}
              leftIcon={<History className="w-4 h-4" />}
              className="text-xs bg-resto-charcoal-800/80 border-slate-700 text-slate-200 hover:text-white"
            >
              {t('users.auditLogs')}
            </Button>
          )}

          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setCreateForm({
                name: '',
                email: '',
                password: '',
                phone: '',
                role_name: isManager ? 'STAFF' : 'CASHIER',
              });
              setFormError('');
              setIsCreateModalOpen(true);
            }}
            leftIcon={<UserPlus className="w-4 h-4" />}
            className="text-xs"
          >
            {t('users.addNewUser')}
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-card border border-slate-200 dark:border-slate-800 shadow-subtle flex flex-col">
          <span className="text-xs text-slate-500 font-medium">{t('users.totalUsers')}</span>
          <span className="text-2xl font-bold mt-1 text-slate-900 dark:text-slate-100">
            {summary?.total_users ?? users.length}
          </span>
          <span className="text-[11px] text-slate-400 mt-1">
            {summary ? `${summary.admins} ${t('roles.ADMIN')}, ${summary.managers} ${t('roles.MANAGER')}` : t('users.usersList')}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-card border border-slate-200 dark:border-slate-800 shadow-subtle flex flex-col">
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{t('users.activeUsers')}</span>
          <span className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
            {summary?.active_users ?? users.filter(u => u.is_active).length}
          </span>
          <span className="text-[11px] text-slate-400 mt-1">{t('users.authorizedPos')}</span>
        </div>

        <div className="p-4 rounded-xl bg-card border border-slate-200 dark:border-slate-800 shadow-subtle flex flex-col">
          <span className="text-xs text-red-500 font-medium">{t('users.inactiveUsers')}</span>
          <span className="text-2xl font-bold mt-1 text-red-500">
            {summary?.inactive_users ?? users.filter(u => !u.is_active).length}
          </span>
          <span className="text-[11px] text-slate-400 mt-1">{t('users.loginBlocked')}</span>
        </div>

        <div className="p-4 rounded-xl bg-card border border-slate-200 dark:border-slate-800 shadow-subtle flex flex-col">
          <span className="text-xs text-slate-500 font-medium">{t('users.floorStaffCashiers')}</span>
          <span className="text-2xl font-bold mt-1 text-slate-800 dark:text-slate-200">
            {summary ? (summary.cashiers + summary.staff) : users.filter(u => ['CASHIER', 'STAFF'].includes(u.role?.name || '')).length}
          </span>
          <span className="text-[11px] text-slate-400 mt-1">
            {summary ? `${summary.cashiers} ${t('roles.CASHIER')}, ${summary.staff} ${t('roles.STAFF')}` : t('users.operationalFloor')}
          </span>
        </div>
      </div>

      {/* Role Notice for Manager */}
      {isManager && (
        <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-900/50 text-blue-300 text-xs flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-blue-400 shrink-0" />
          <span>
            <strong>{t('users.managerScopeTitle')}</strong> {t('users.managerScopeDesc')}
          </span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-card border border-slate-200 dark:border-slate-800 shadow-subtle">
        <div className="w-full md:w-80">
          <Input
            placeholder={t('users.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            className="h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Role Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">{t('users.filterRole')}:</span>
            {(['ALL', 'ADMIN', 'MANAGER', 'CASHIER', 'STAFF'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  roleFilter === r
                    ? 'bg-resto-charcoal-800 text-white dark:bg-slate-700'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {r === 'ALL' ? t('users.allRoles') : r}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1 hidden sm:block" />

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">{t('users.filterStatus')}:</span>
            {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === s
                    ? 'bg-resto-charcoal-800 text-white dark:bg-slate-700'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {s === 'ALL' ? t('users.allStatuses') : (s === 'ACTIVE' ? t('users.active') : t('users.inactive'))}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-16 rounded-xl w-full" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredUsers.length === 0 && (
        <div className="p-12 text-center bg-card rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h4 className="font-display text-base font-bold text-slate-800 dark:text-slate-200">
            {t('users.noUsersFound')}
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search keyword, role, or account status filters.
          </p>
        </div>
      )}

      {/* Users Table */}
      {!isLoading && filteredUsers.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card overflow-hidden shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                  <th className="py-3 px-4 text-start">{t('users.colUser')}</th>
                  <th className="py-3 px-4 text-start">{t('users.colRole')}</th>
                  <th className="py-3 px-4 text-start">{t('users.colContact')}</th>
                  <th className="py-3 px-4 text-start">{t('users.colStatus')}</th>
                  <th className="py-3 px-4 text-start">{t('users.colJoined')}</th>
                  <th className="py-3 px-4 text-end">{t('users.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.map(u => {
                  const isSelf = u.id === currentUser?.id;
                  const manageable = canManageTargetUser(u);

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Name & Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 text-xs shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              {u.name}
                              {isSelf && (
                                <span className="text-[10px] bg-resto-terracotta-500/10 text-resto-terracotta-500 font-bold px-1.5 py-0.2 rounded border border-resto-terracotta-500/20">
                                  {t('users.youBadge')}
                                </span>
                              )}
                            </div>
                            <span className="text-slate-400 text-[11px] block">{u.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-4">
                        {renderRoleBadge(u.role?.name)}
                      </td>

                      {/* Contact Info */}
                      <td className="py-3 px-4 text-slate-500">
                        {u.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {u.phone}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {t('users.active')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            {t('users.inactive')}
                          </span>
                        )}
                      </td>

                      {/* Joined Date */}
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-end">
                        {manageable ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(u)}
                              title={t('users.editUser')}
                              className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>

                            {/* Password Reset */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResetPassword(u)}
                              title={t('users.resetPassword')}
                              className="h-7 w-7 p-0 text-amber-500 hover:bg-amber-950/20"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </Button>

                            {/* Toggle Status (Active/Inactive) */}
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isSelf || statusActionId === u.id}
                              onClick={() => handleToggleStatus(u)}
                              title={u.is_active ? t('users.deactivate') : t('users.activate')}
                              className={`h-7 w-7 p-0 ${
                                u.is_active
                                  ? 'text-red-500 hover:bg-red-950/20'
                                  : 'text-emerald-500 hover:bg-emerald-950/20'
                              }`}
                            >
                              {u.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </Button>

                            {/* Delete (if allowed & no orders) */}
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isSelf}
                              onClick={() => handleDeleteUser(u)}
                              title={t('users.safeDelete')}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-950/20"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1 text-slate-400 text-[11px]" title={t('users.protectedAccountTitle')}>
                            <Lock className="w-3 h-3" />
                            <span>{t('users.protectedBadge')}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t('users.createModalTitle')}
        description={t('users.createModalDesc')}
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-medium flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('users.fullName')} *</label>
            <Input
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder={isRtl ? 'مثال: عمر فاروق' : 'e.g. Omar Farooq'}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('users.email')} *</label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="employee@restoflow.sa"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('users.phone')}</label>
              <Input
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                placeholder="+966 50 000 0000"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('users.initialPassword')} *</label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder={t('users.passwordPlaceholder')}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('users.role')} *</label>
              <select
                value={createForm.role_name}
                onChange={(e) => setCreateForm({ ...createForm, role_name: e.target.value as UserRole })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-terracotta-500"
                required
              >
                {allowedCreatableRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          </div>

          {isManager && (
            <p className="text-[11px] text-slate-400 italic">
              * As Manager, you can create Cashier and Staff accounts only.
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" size="md" type="button" onClick={() => setIsCreateModalOpen(false)}>
              {t('users.cancel')}
            </Button>
            <Button variant="primary" size="md" type="submit" isLoading={isSubmitting}>
              {t('users.create')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT USER MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={t('users.editModalTitle')}
        description={t('users.editModalDesc')}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-medium flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('users.fullName')} *</label>
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('users.phone')}</label>
            <Input
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              placeholder="+966 50 000 0000"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('users.role')} *</label>
            <select
              value={editForm.role_id}
              onChange={(e) => setEditForm({ ...editForm, role_id: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-terracotta-500"
              required
            >
              {roles
                .filter(r => {
                  if (isAdmin) return true;
                  if (isManager) return r.name === 'CASHIER' || r.name === 'STAFF';
                  return false;
                })
                .map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" size="md" type="button" onClick={() => setIsEditModalOpen(false)}>
              {t('users.cancel')}
            </Button>
            <Button variant="primary" size="md" type="submit" isLoading={isSubmitting}>
              {t('users.save')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* AUDIT LOGS MODAL (ADMIN ONLY) */}
      <Modal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        title={t('users.auditLogsTitle')}
        description={t('users.auditLogsDesc')}
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {isLoadingAudit && <Skeleton className="h-32 w-full" />}
          {!isLoadingAudit && auditLogs.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-6">No administrative audit records found.</p>
          )}
          {!isLoadingAudit && auditLogs.map(log => (
            <div key={log.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200">{log.action}</span>
                <span className="text-[10px] text-slate-400">{new Date(log.created_at).toLocaleString()}</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                Actor: <strong>{log.actor?.name || log.actor_id}</strong> | Target: <strong>{log.target?.name || log.target_user_id || 'N/A'}</strong>
              </p>
              {log.details && (
                <pre className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-950 p-1.5 rounded overflow-x-auto">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
