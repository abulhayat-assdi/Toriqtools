"use client";

import { useState } from "react";
import { ShieldCheck, UserPlus, Trash2, Crown, Eye, EyeOff } from "lucide-react";
import { createAdmin, setAdminRole } from "@/app/admin/(dashboard)/manage-admins/actions";
import { useConfirm } from "@/contexts/ConfirmContext";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

interface ManageAdminsClientProps {
  admins: AdminUser[];
}

export default function ManageAdminsClient({ admins: initialAdmins }: ManageAdminsClientProps) {
  const confirm = useConfirm();
  const [admins, setAdmins] = useState<AdminUser[]>(initialAdmins);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "super_admin">("admin");
  const [showPassword, setShowPassword] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(""), 4000);
  };

  const canCreate = newName.trim() && newEmail.trim() && newPassword.length >= 8;

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    setActionLoading("create");
    setErrorMsg("");

    const result = await createAdmin({
      name: newName,
      email: newEmail,
      password: newPassword,
      role: newRole,
    });

    setActionLoading(null);

    if (!result.success || !result.admin) {
      showError(result.error || "অ্যাডমিন তৈরি করা যায়নি।");
      return;
    }

    const created = result.admin;
    setAdmins((prev) => [...prev, created]);
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewRole("admin");
    setShowPassword(false);
    showSuccess(
      result.upgraded
        ? `${created.email} আগে কাস্টমার ছিলেন — এখন নতুন পাসওয়ার্ডসহ ${created.role === "super_admin" ? "Super Admin" : "Admin"} করা হয়েছে।`
        : `${created.name} (${created.email}) কে ${created.role === "super_admin" ? "Super Admin" : "Admin"} হিসেবে তৈরি করা হয়েছে।`
    );
  };

  const handleToggleSuperAdmin = async (adminId: string, currentRole: string, adminName: string) => {
    const newRole = currentRole === 'super_admin' ? 'admin' : 'super_admin';
    const actionText = newRole === 'super_admin' ? 'Super Admin করতে' : 'Admin এ পরিবর্তন করতে';
    
    const ok = await confirm({
      title: "রোল পরিবর্তন",
      message: `"${adminName}" কে কি ${newRole === 'super_admin' ? 'Super Admin' : 'Admin'} বানাতে চান?`,
      confirmText: "হ্যাঁ, পরিবর্তন করুন",
      cancelText: "না",
      variant: "warning",
    });
    if (!ok) return;
    
    setActionLoading(adminId + '-role');

    const result = await setAdminRole(adminId, newRole as "admin" | "super_admin");

    setActionLoading(null);

    if (result.error) {
      showError(result.error);
      return;
    }

    setAdmins((prev) => prev.map(a => a.id === adminId ? { ...a, role: newRole } : a));
    showSuccess(`${adminName} কে ${newRole === 'super_admin' ? 'Super Admin' : 'Admin'} করা হয়েছে।`);
  };

  const handleRemoveAdmin = async (adminId: string, adminName: string, adminRole: string) => {
    const ok = await confirm({
      title: "অ্যাডমিন সরান",
      message: `"${adminName}" কে অ্যাডমিন থেকে সরাতে চান?`,
      confirmText: "হ্যাঁ, সরান",
      cancelText: "না",
    });
    if (!ok) return;
    setActionLoading(adminId);

    const result = await setAdminRole(adminId, "customer");

    setActionLoading(null);

    if (result.error) {
      showError(result.error);
      return;
    }

    setAdmins((prev) => prev.filter((a) => a.id !== adminId));
    showSuccess(`${adminName} কে অ্যাডমিন থেকে সরানো হয়েছে।`);
  };

  return (
    <div className="space-y-8">
      {/* Status messages */}
      {successMsg && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-5 py-3 rounded-lg text-sm">
          ✓ {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-5 py-3 rounded-lg text-sm">
          ✗ {errorMsg}
        </div>
      )}

      {/* Add New Admin */}
      <div className="bg-[#151828] border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <UserPlus size={20} className="text-[#eb1c24]" />
          নতুন অ্যাডমিন যোগ করুন
        </h2>
        <p className="text-sm text-gray-400 mb-5">নাম, ইমেইল ও পাসওয়ার্ড দিন — এই তথ্য দিয়েই নতুন অ্যাডমিন লগইন করতে পারবেন।</p>

        <form onSubmit={handleCreateAdmin} className="grid grid-cols-1 md:grid-cols-2 gap-4" autoComplete="off">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-300">নাম</span>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Admin name"
              className="w-full bg-[#0f111a] border border-white/20 text-white placeholder-gray-600 px-4 py-3 rounded-lg text-sm focus:border-[#eb1c24] focus:outline-none transition-colors"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-300">ইমেইল</span>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="admin@email.com"
              autoCapitalize="none"
              autoComplete="off"
              className="w-full bg-[#0f111a] border border-white/20 text-white placeholder-gray-600 px-4 py-3 rounded-lg text-sm focus:border-[#eb1c24] focus:outline-none transition-colors"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-300">পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="w-full bg-[#0f111a] border border-white/20 text-white placeholder-gray-600 px-4 py-3 rounded-lg text-sm focus:border-[#eb1c24] focus:outline-none transition-colors pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-300">রোল</span>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as "admin" | "super_admin")}
              className="w-full bg-[#0f111a] border border-white/20 text-white placeholder-gray-600 px-4 py-3 rounded-lg text-sm focus:border-[#eb1c24] focus:outline-none transition-colors"
            >
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={!canCreate || actionLoading === "create"}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-[#eb1c24] hover:bg-[#c4141b] text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserPlus size={16} />
              {actionLoading === "create" ? "তৈরি করছে..." : "অ্যাডমিন তৈরি করুন"}
            </button>
          </div>
        </form>
      </div>

      {/* Current Admins List */}
      <div className="bg-[#151828] border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <ShieldCheck size={20} className="text-[#eb1c24]" />
          বর্তমান অ্যাডমিনদের তালিকা
        </h2>
        <p className="text-sm text-gray-400 mb-5">মোট {admins.length} জন অ্যাডমিন আছেন।</p>

        {admins.length === 0 ? (
          <p className="text-gray-500 text-center py-8">কোনো অ্যাডমিন নেই।</p>
        ) : (
          <div className="flex flex-col gap-3">
            {admins.map((admin) => (
              <div
                key={admin.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 bg-white/5 border border-white/5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center font-bold text-[15px] ${admin.role === "super_admin" ? "bg-amber-500" : "bg-[#eb1c24]"} text-white`}>
                    {(admin.name || admin.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="font-semibold text-white truncate">{admin.name || "—"}</p>
                      {admin.role === "super_admin" && (
                        <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                          <Crown size={10} /> Super Admin
                        </span>
                      )}
                      {admin.role === "admin" && (
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{admin.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {/* Super Admin Promotion Toggle */}
                  <button
                    onClick={() => handleToggleSuperAdmin(admin.id, admin.role, admin.name || admin.email)}
                    disabled={actionLoading === admin.id + '-role'}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg border transition-all whitespace-nowrap ${
                      admin.role === 'super_admin'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                    } disabled:opacity-50`}
                    title={admin.role === 'super_admin' ? 'Demote to Admin' : 'Promote to Super Admin'}
                  >
                    <Crown size={14} className={admin.role === 'super_admin' ? 'text-amber-500' : 'text-gray-500'} />
                    {actionLoading === admin.id + '-role' ? 'প্রসেস...' : (admin.role === 'super_admin' ? 'Admin' : 'Super')}
                  </button>

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveAdmin(admin.id, admin.name || admin.email, admin.role)}
                    disabled={actionLoading === admin.id}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20 disabled:opacity-50 whitespace-nowrap"
                  >
                    <Trash2 size={14} />
                    {actionLoading === admin.id ? "সরাচ্ছে..." : "সরান"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
