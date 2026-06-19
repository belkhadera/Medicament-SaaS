import { useState } from "react";
import { Loader2, UserCircle, ShieldCheck, KeyRound, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../components/useAuth";
import { authService } from "../../services/auth.service";
import { ROLE_LABELS, UserRole } from "../../services/user.service";

const inputCls =
  "w-full px-4 py-2 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60";

/**
 * "Mon profil" — lets the signed-in user view and edit their own account
 * (name / email) and change their password. Everything is persisted to the
 * `User` record via the auth endpoints; the in-app session is refreshed so the
 * sidebar reflects edits immediately.
 */
export function ProfileScreen() {
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const profileDirty = name.trim() !== (user?.name ?? "") || email.trim() !== (user?.email ?? "");

  const handleSaveProfile = async () => {
    if (!name.trim() || name.trim().length < 2) {
      toast.error("Le nom doit comporter au moins 2 caractères.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Adresse e-mail invalide.");
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await authService.updateProfile({ name: name.trim(), email: email.trim() });
      if (user) updateUser({ ...user, name: updated.name, email: updated.email, role: updated.role });
      toast.success("Profil mis à jour.");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Échec de la mise à jour du profil.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error("Saisissez votre mot de passe actuel.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Le nouveau mot de passe doit comporter au moins 6 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    setSavingPassword(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      toast.success("Mot de passe modifié.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Échec de la modification du mot de passe.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Mon profil</h2>
        <p className="text-muted-foreground mt-1">Gérez vos informations de compte et votre mot de passe.</p>
      </div>

      {/* Identity card */}
      <div className="bg-card rounded-lg border border-border p-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <UserCircle className="w-9 h-9 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-foreground truncate">{user?.name}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary/10 text-secondary">
              {ROLE_LABELS[(user?.role as UserRole)] ?? user?.role}
            </span>
            {user?.isEmailVerified ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> E-mail vérifié
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/10 text-warning">
                E-mail non vérifié
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Profile details */}
      <div className="bg-card rounded-lg border border-border p-6 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Informations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nom complet</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Adresse e-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Rôle</label>
            <input value={ROLE_LABELS[(user?.role as UserRole)] ?? user?.role ?? ""} disabled className={inputCls} />
            <p className="text-xs text-muted-foreground mt-1">Seul un administrateur peut modifier les rôles.</p>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleSaveProfile}
            disabled={savingProfile || !profileDirty}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </button>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-card rounded-lg border border-border p-6 space-y-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-muted-foreground" /> Changer le mot de passe
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Mot de passe actuel</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nouveau mot de passe</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Confirmer</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleChangePassword}
            disabled={savingPassword}
            className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-accent disabled:opacity-50 flex items-center gap-2"
          >
            {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            Mettre à jour le mot de passe
          </button>
        </div>
      </div>
    </div>
  );
}
