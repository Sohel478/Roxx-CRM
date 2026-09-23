"use client";

import { useState, useTransition } from "react";
import {
  UserPlus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Eye,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Loader2,
  Mail,
  User as UserIcon,
  KeyRound,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  UserItem,
  UserRole,
  USER_ROLES,
} from "@/lib/validations/settings";
import {
  createUserAction,
  updateUserAction,
  toggleUserActiveAction,
} from "@/actions/users";

interface TeamMembersTabProps {
  users: UserItem[];
  onRefresh: () => void;
}

export function TeamMembersTab({ users, onRefresh }: TeamMembersTabProps) {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  // Invite Form State
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("SALES_USER");

  // Edit Form State
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("SALES_USER");
  const [editIsActive, setEditIsActive] = useState(true);

  const openInviteModal = () => {
    setInviteName("");
    setInviteEmail("");
    setInvitePassword("");
    setInviteRole("SALES_USER");
    setFormError(null);
    setIsInviteOpen(true);
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const res = await createUserAction({
        name: inviteName,
        email: inviteEmail,
        password: invitePassword,
        role: inviteRole,
      });

      if (!res.success) {
        setFormError(res.error || "Failed to invite user");
      } else {
        setIsInviteOpen(false);
        onRefresh();
      }
    });
  };

  const openEditModal = (u: UserItem) => {
    setUserToEdit(u);
    setEditName(u.name);
    setEditRole(u.role);
    setEditIsActive(u.isActive);
    setFormError(null);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;
    setFormError(null);

    startTransition(async () => {
      const res = await updateUserAction({
        id: userToEdit.id,
        name: editName,
        role: editRole,
        isActive: editIsActive,
      });

      if (!res.success) {
        setFormError(res.error || "Failed to update user");
      } else {
        setUserToEdit(null);
        onRefresh();
      }
    });
  };

  const handleToggleActive = (userId: string) => {
    startTransition(async () => {
      await toggleUserActiveAction(userId);
      onRefresh();
    });
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case "ADMIN":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <ShieldAlert className="w-3 h-3 text-purple-600" />
            Admin
          </span>
        );
      case "MANAGER":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <ShieldCheck className="w-3 h-3 text-blue-600" />
            Manager
          </span>
        );
      case "SALES_USER":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Shield className="w-3 h-3 text-emerald-600" />
            Sales Rep
          </span>
        );
      case "READ_ONLY":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Eye className="w-3 h-3 text-slate-500" />
            Auditor
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Member Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Organization Team Members
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage users, assign RBAC security roles, and monitor account activation status.
          </p>
        </div>
        <Button
          type="button"
          onClick={openInviteModal}
          className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Member</span>
        </Button>
      </div>

      {/* Team Members Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Joined</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{user.name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">{getRoleBadge(user.role)}</td>
                  <td className="py-3.5 px-4">
                    {user.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                        <XCircle className="w-3 h-3 text-rose-500" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">
                    {user.createdAt ? user.createdAt.split("T")[0] : "—"}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2.5"
                        onClick={() => openEditModal(user)}
                      >
                        Edit Role
                      </Button>
                      <Button
                        type="button"
                        variant={user.isActive ? "outline" : "default"}
                        size="sm"
                        className={`h-7 text-xs px-2.5 ${
                          user.isActive
                            ? "hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                            : "bg-emerald-600 hover:bg-emerald-700"
                        }`}
                        onClick={() => handleToggleActive(user.id)}
                        disabled={isPending}
                      >
                        {user.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No team members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Member Modal */}
      <Modal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Invite New Team Member"
        description="Add a colleague and assign their role-based access permissions."
        maxWidth="md"
      >
        <form onSubmit={handleInviteSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name *
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                type="text"
                required
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Jane Doe"
                className="pl-9 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Work Email Address *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="jane@company.com"
                className="pl-9 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Temporary Password *
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                type="password"
                required
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="pl-9 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Access Role *
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="SALES_USER">Sales Rep (Leads, Deals, Activities)</option>
              <option value="MANAGER">Manager (Team oversight, Reports, Approvals)</option>
              <option value="ADMIN">Administrator (Full CRM control &amp; Settings)</option>
              <option value="READ_ONLY">Auditor (View-only compliance access)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsInviteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Send Invitation
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={!!userToEdit}
        onClose={() => setUserToEdit(null)}
        title="Edit Team Member"
        description="Update role permission level or account status."
        maxWidth="md"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name *
            </label>
            <Input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email (Cannot be modified)
            </label>
            <Input
              type="text"
              disabled
              value={userToEdit?.email || ""}
              className="text-xs bg-slate-50 text-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Role Assignment *
            </label>
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as UserRole)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {USER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="edit-active"
              checked={editIsActive}
              onChange={(e) => setEditIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="edit-active" className="text-xs font-medium text-slate-700">
              Account Active (User can log in and access CRM)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setUserToEdit(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
