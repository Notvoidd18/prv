import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  GraduationCap,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { AppUser, UserRole } from '../types.ts';

interface AdminUserManagementProps {
  currentUser: AppUser | null;
}

interface UserWithStats extends AppUser {
  uploadCount?: number;
}

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchUsers = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        headers: {
          'x-user-email': currentUser.email,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      } else {
        const err = await res.json();
        setNotification({ type: 'error', text: err.error || 'Failed to fetch users' });
      }
    } catch {
      setNotification({ type: 'error', text: 'Network error fetching users.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentUser]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (!currentUser) return;
    setUpdatingId(userId);
    setNotification(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email,
        },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();
      if (res.ok) {
        setNotification({
          type: 'success',
          text: data.message || `Role updated to ${newRole}.`,
        });
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
      } else {
        setNotification({
          type: 'error',
          text: data.error || 'Failed to update role.',
        });
      }
    } catch {
      setNotification({ type: 'error', text: 'Error connecting to server.' });
    } finally {
      setUpdatingId(null);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-xs">
            <Shield className="w-3 h-3" />
            Admin
          </span>
        );
      case 'teacher':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-400/25">
            <BookOpen className="w-3 h-3" />
            Teacher
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            <GraduationCap className="w-3 h-3" />
            Student
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            User Management &amp; Role Access
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            View all signed-in users and grant teacher upload permissions or student access.
          </p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="btn-secondary-glass inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Users</span>
        </button>
      </div>

      {notification && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center justify-between border ${
            notification.type === 'success'
              ? 'bg-sky-500/10 border-sky-400/25 text-sky-900 dark:text-sky-200'
              : 'bg-rose-500/10 border-rose-500/25 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-500" />
            )}
            <span>{notification.text}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-[11px] underline opacity-80 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="ios-glass-elevated rounded-2xl border border-sky-400/20 overflow-hidden shadow-xs">
        {loading && users.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
            Loading registered users...
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No registered users found yet. Users will appear here automatically when they sign in with Google.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-sky-500/5 text-slate-600 dark:text-slate-400 font-semibold border-b border-sky-400/15 text-[11px]">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Uploads</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4 text-right">Change Permission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-400/10">
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  const isSuperAdmin = u.role === 'admin';
                  return (
                    <tr key={u.id} className="hover:bg-sky-500/5 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {u.picture ? (
                            <img
                              src={u.picture}
                              alt={u.name}
                              className="w-8 h-8 rounded-full border border-sky-400/30"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-bold flex items-center justify-center">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {isSelf && (
                                <span className="text-[10px] bg-sky-500/15 text-sky-700 dark:text-sky-300 px-1.5 py-0.2 rounded font-semibold border border-sky-400/20">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">{getRoleBadge(u.role)}</td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 dark:text-white">{u.uploadCount || 0}</span>
                        <span className="text-slate-400 ml-1">lessons</span>
                      </td>

                      <td className="py-3 px-4 text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {isSuperAdmin ? (
                          <span className="text-[11px] text-sky-700 dark:text-sky-300 font-bold bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-400/20">
                            Super Administrator
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            {u.role !== 'teacher' && (
                              <button
                                onClick={() => handleRoleChange(u.id, 'teacher')}
                                disabled={updatingId === u.id}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-lg btn-primary-blue transition-colors cursor-pointer shadow-xs"
                              >
                                {updatingId === u.id ? 'Saving...' : 'Grant Teacher'}
                              </button>
                            )}

                            {u.role !== 'student' && (
                              <button
                                onClick={() => handleRoleChange(u.id, 'student')}
                                disabled={updatingId === u.id}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-lg btn-secondary-glass transition-colors cursor-pointer"
                              >
                                {updatingId === u.id ? 'Saving...' : 'Set Student'}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
