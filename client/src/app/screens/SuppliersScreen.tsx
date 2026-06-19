import { useEffect, useState } from 'react';
import { Mail, Phone, Star, Package, Truck, Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { supplierService, Supplier } from '../../services/supplier.service';
import { Modal } from '../components/common/Modal';

const STATUS_CLASS: Record<string, string> = {
  active: 'bg-success/10 text-success',
  pending: 'bg-warning/10 text-warning',
  inactive: 'bg-muted text-muted-foreground',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Actif',
  pending: 'En attente',
  inactive: 'Inactif',
};

interface FormState {
  name: string;
  contact: string;
  phone: string;
  status: Supplier['status'];
  orders: string;
  rating: string;
}

const emptyForm: FormState = { name: '', contact: '', phone: '', status: 'active', orders: '0', rating: '5' };

export function SuppliersScreen() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchSuppliers = async () => {
    try {
      const res = await supplierService.getAll();
      setSuppliers(res.data);
    } catch {
      setError('Échec du chargement des fournisseurs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };
  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ name: s.name, contact: s.contact, phone: s.phone, status: s.status, orders: String(s.orders), rating: String(s.rating) });
    setFormError(null);
    setModalOpen(true);
  };
  const setField = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name || !form.contact || !form.phone) {
      setFormError('Le nom, le contact et le téléphone sont obligatoires.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload: Partial<Supplier> = {
      name: form.name.trim(),
      contact: form.contact.trim(),
      phone: form.phone.trim(),
      status: form.status,
      orders: Number(form.orders) || 0,
      rating: Number(form.rating) || 0,
    };
    try {
      if (editing) await supplierService.update(editing._id, payload);
      else await supplierService.create(payload);
      await fetchSuppliers();
      setModalOpen(false);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Échec de l\'enregistrement du fournisseur.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: Supplier) => {
    if (!window.confirm(`Supprimer le fournisseur « ${s.name} » ?`)) return;
    try {
      await supplierService.delete(s._id);
      await fetchSuppliers();
    } catch {
      alert('Échec de la suppression du fournisseur.');
    }
  };

  if (loading) return <div className="p-6 text-muted-foreground">Chargement des fournisseurs…</div>;
  if (error) return <div className="p-6 text-destructive">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Fournisseurs</h2>
          <p className="text-muted-foreground mt-1">{suppliers.length} fournisseurs enregistrés</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
          <Plus className="w-4 h-4" />
          <span className="text-sm">Ajouter un fournisseur</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {suppliers.map((s) => (
          <div key={s._id} className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Truck className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{s.name}</h3>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_CLASS[s.status] ?? STATUS_CLASS.inactive}`}>{STATUS_LABEL[s.status] ?? s.status}</span>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2"><Mail className="w-4 h-4" /> {s.contact}</p>
              <p className="flex items-center gap-2"><Phone className="w-4 h-4" /> {s.phone}</p>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <span className="flex items-center gap-2 text-sm text-foreground">
                <Package className="w-4 h-4 text-muted-foreground" /> {s.orders} commandes
              </span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                  <Star className="w-4 h-4 text-warning fill-warning" /> {s.rating.toFixed(1)}
                </span>
                <button onClick={() => openEdit(s)} className="p-1.5 hover:bg-accent rounded" title="Modifier">
                  <Edit className="w-4 h-4 text-muted-foreground" />
                </button>
                <button onClick={() => handleDelete(s)} className="p-1.5 hover:bg-accent rounded" title="Supprimer">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Modifier le fournisseur' : 'Ajouter un fournisseur'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent">Annuler</button>
            <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Enregistrer' : 'Ajouter'}
            </button>
          </>
        }
      >
        {formError && <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">{formError}</div>}
        <div className="space-y-3">
          <Field label="Nom *"><input value={form.name} onChange={(e) => setField('name', e.target.value)} className="w-full px-4 py-2 bg-input-background border border-border rounded-lg" placeholder="MedSupply SARL" /></Field>
          <Field label="E-mail de contact *"><input value={form.contact} onChange={(e) => setField('contact', e.target.value)} className="w-full px-4 py-2 bg-input-background border border-border rounded-lg" placeholder="contact@medsupply.ma" /></Field>
          <Field label="Téléphone *"><input value={form.phone} onChange={(e) => setField('phone', e.target.value)} className="w-full px-4 py-2 bg-input-background border border-border rounded-lg" placeholder="+212 5 22 00 00 00" /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Statut">
              <select value={form.status} onChange={(e) => setField('status', e.target.value)} className="w-full px-4 py-2 bg-input-background border border-border rounded-lg">
                <option value="active">Actif</option>
                <option value="pending">En attente</option>
                <option value="inactive">Inactif</option>
              </select>
            </Field>
            <Field label="Commandes"><input type="number" value={form.orders} onChange={(e) => setField('orders', e.target.value)} className="w-full px-4 py-2 bg-input-background border border-border rounded-lg" /></Field>
            <Field label="Note"><input type="number" step="0.1" min="0" max="5" value={form.rating} onChange={(e) => setField('rating', e.target.value)} className="w-full px-4 py-2 bg-input-background border border-border rounded-lg" /></Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}
