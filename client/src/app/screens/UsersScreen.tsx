import { useEffect, useMemo, useState } from "react";
import { Loader2, Users as UsersIcon, ShieldCheck, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../components/useAuth";
import {
  userService,
  ManagedUser,
  UserRole,
  USER_ROLES,
  ROLE_LABELS,
} from "../../services/user.service";

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("fr-FR") : "—");

/**
 * Admin-only user management. Lists every account from the database and lets an
 * administrator change a user's role and activation status. Every change is
 * persisted via the admin auth endpoints (guarded server-side). A user cannot
 * lock themselves out (the server rejects self-demotion/deactivation).
 */
export function UsersScreen() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await userService.getAll();
      setUsers(res.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || "Échec du chargement des utilisateurs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const patchUser = async (id: string, data: { role?: UserRole; status?: ManagedUser["status"] }) => {
    setSavingId(id);
    try {
      const res = await userService.update(id, data);
      setUsers((prev) => prev.map((u) => (u._id === id ? res.data : u)));
      toast.success("Utilisateur mis à jour.");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Échec de la mise à jour.");
    } finally {
      setSavingId(null);
    }
  };

  const counts = useMemo(() => {
    const active = users.filter((u) => u.status === "active").length;
    return { total: users.length, active, inactive: users.length - active };
  }, [users]);

  if (loading) return <div className="p-6 text-muted-foreground">Chargement des utilisateurs…</div>;
  if (error) return <div className="p-6 text-destructive">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <UsersIcon className="w-6 h-6" /> Utilisateurs
          </h2>
          <p className="text-muted-foreground mt-1">
            {counts.total} compte(s) · {counts.active} actif(s) · {counts.inactive} inactif(s)
          </p>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted border-b border-border">
            <tr>
              {["Utilisateur", "Rôle", "Statut", "E-mail vérifié", "Dernière activité", "Actions"].map((h) => (
                <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => {
              const isSelf = me?._id === u._id;
              const busy = savingId === u._id;
              return (
                <tr key={u._id} className="hover:bg-muted/50">
                  <td className="px-6 py-4">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {u.name} {isSelf && <span className="text-xs text-muted-foreground">(vous)</span>}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={u.role}
                      disabled={busy || (isSelf && u.role === "Administrator")}
                      onChange={(e) => patchUser(u._id, { role: e.target.value as UserRole })}
                      className="px-3 py-1.5 bg-input-background border border-border rounded-lg text-sm disabled:opacity-60"
                      title={isSelf ? "Vous ne pouvez pas changer votre propre rôle" : "Modifier le rôle"}
                    >
                      {USER_ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        u.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {u.status === "active" ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {u.isEmailVerified ? (
                      <ShieldCheck className="w-4 h-4 text-success" />
                    ) : (
                      <span className="text-xs text-muted-foreground">Non</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{fmtDate(u.lastActive)}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => patchUser(u._id, { status: u.status === "active" ? "inactive" : "active" })}
                      disabled={busy || isSelf}
                      title={isSelf ? "Vous ne pouvez pas désactiver votre propre compte" : "Activer / désactiver"}
                      className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-accent disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {busy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : u.status === "active" ? (
                        <><XCircle className="w-4 h-4 text-destructive" /> Désactiver</>
                      ) : (
                        <><CheckCircle className="w-4 h-4 text-success" /> Activer</>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-muted-foreground">Aucun utilisateur.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
