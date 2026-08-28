import { useEffect, useState } from 'react';
import {
  Settings,
  Building2,
  Users as UsersIcon,
  FileText,
  Image,
  ScrollText,
  Loader2,
  Save,
  Plus,
  Pencil,
  Trash2,
  Upload,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { BarangayProfile, BarangayOfficial, Profile, DocumentType, Asset, AuditLogEntry } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useBarangay } from '@/contexts/BarangayContext';
import { ROLE_LABELS, USER_ROLES, ASSET_CATEGORIES } from '@/lib/constants';
import { logAudit } from '@/lib/audit';
import { formatDate, formatDateTime } from '@/lib/age';
import { PageHeader, Badge, Modal, ConfirmDialog, EmptyState } from '@/components/ui';

type AdminTab = 'profile' | 'officials' | 'users' | 'document_types' | 'assets' | 'audit';

const TABS: { id: AdminTab; label: string; icon: typeof Settings; superAdminOnly?: boolean }[] = [
  { id: 'profile', label: 'Barangay Profile', icon: Building2 },
  { id: 'officials', label: 'Officials', icon: UsersIcon },
  { id: 'users', label: 'Users', icon: UsersIcon, superAdminOnly: true },
  { id: 'document_types', label: 'Document Types', icon: FileText },
  { id: 'assets', label: 'Assets', icon: Image },
  { id: 'audit', label: 'Audit Log', icon: ScrollText },
];

export function Administration() {
  const { profile, hasRole } = useAuth();
  const [tab, setTab] = useState<AdminTab>('profile');

  const visibleTabs = TABS.filter((t) => !t.superAdminOnly || hasRole('super_admin'));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="Administration" description="Manage barangay profile, officials, users, and system settings" />

      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {visibleTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                tab === t.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'profile' && <BarangayProfileEditor />}
      {tab === 'officials' && <OfficialsManager />}
      {tab === 'users' && hasRole('super_admin') && <UsersManager />}
      {tab === 'document_types' && <DocumentTypesManager />}
      {tab === 'assets' && <AssetsManager />}
      {tab === 'audit' && <AuditLogViewer />}
    </div>
  );
}

// ============================================================================
// BARANGAY PROFILE EDITOR
// ============================================================================
function BarangayProfileEditor() {
  const { profile: barangay, refresh } = useBarangay();
  const [form, setForm] = useState<Partial<BarangayProfile>>(barangay ?? {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (barangay) setForm(barangay);
  }, [barangay]);

  const set = (key: keyof BarangayProfile, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('barangay_profile').update(form).eq('id', 1);
    await logAudit('Barangay Profile Updated', 'barangay_profile', '1', 'Updated barangay profile');
    await refresh();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = `barangay-logo-${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('barangay-assets').upload(fileName, file);
    if (!error) {
      const { data: urlData } = supabase.storage.from('barangay-assets').getPublicUrl(fileName);
      set('logo_url', urlData.publicUrl);
    }
  };

  return (
    <div className="card p-6 space-y-4">
      {saved && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
          Profile saved successfully.
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 overflow-hidden">
          {form.logo_url ? (
            <img src={form.logo_url} alt="Logo" className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-10 w-10 text-white" />
          )}
        </div>
        <div>
          <label className="btn-secondary cursor-pointer">
            <Upload className="h-4 w-4" /> Upload Logo
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="label">Barangay Name</label><input className="input" value={form.barangay_name ?? ''} onChange={(e) => set('barangay_name', e.target.value)} /></div>
        <div><label className="label">Barangay Number</label><input className="input" value={form.barangay_number ?? ''} onChange={(e) => set('barangay_number', e.target.value)} /></div>
        <div><label className="label">City/Municipality</label><input className="input" value={form.city_municipality ?? ''} onChange={(e) => set('city_municipality', e.target.value)} /></div>
        <div><label className="label">Province</label><input className="input" value={form.province ?? ''} onChange={(e) => set('province', e.target.value)} /></div>
        <div><label className="label">Region</label><input className="input" value={form.region ?? ''} onChange={(e) => set('region', e.target.value)} /></div>
        <div><label className="label">Contact Number</label><input className="input" value={form.contact_number ?? ''} onChange={(e) => set('contact_number', e.target.value)} /></div>
        <div><label className="label">Email</label><input className="input" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} /></div>
        <div><label className="label">Website</label><input className="input" value={form.website ?? ''} onChange={(e) => set('website', e.target.value)} /></div>
        <div><label className="label">Punong Barangay</label><input className="input" value={form.punong_barangay ?? ''} onChange={(e) => set('punong_barangay', e.target.value)} /></div>
        <div className="sm:col-span-2"><label className="label">Complete Address</label><textarea className="input" rows={2} value={form.complete_address ?? ''} onChange={(e) => set('complete_address', e.target.value)} /></div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-200">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Profile
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// OFFICIALS MANAGER
// ============================================================================
function OfficialsManager() {
  const [officials, setOfficials] = useState<BarangayOfficial[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BarangayOfficial | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDelete, setShowDelete] = useState<BarangayOfficial | null>(null);

  const fetchOfficials = async () => {
    setLoading(true);
    const { data } = await supabase.from('barangay_officials').select('*').order('display_order');
    if (data) setOfficials(data as BarangayOfficial[]);
    setLoading(false);
  };

  useEffect(() => { fetchOfficials(); }, []);

  const handleSave = async (official: Partial<BarangayOfficial>) => {
    if (editing) {
      await supabase.from('barangay_officials').update(official).eq('id', editing.id);
      await logAudit('Official Updated', 'official', editing.id, `Updated ${official.name}`);
    } else {
      const { data } = await supabase.from('barangay_officials').insert(official).select().maybeSingle();
      if (data) await logAudit('Official Created', 'official', (data as BarangayOfficial).id, `Created ${official.name}`);
    }
    setShowModal(false);
    setEditing(null);
    fetchOfficials();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('barangay_officials').delete().eq('id', id);
    await logAudit('Official Deleted', 'official', id, 'Deleted official');
    fetchOfficials();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>
          <Plus className="h-4 w-4" /> Add Official
        </button>
      </div>

      {officials.length === 0 ? (
        <div className="card"><EmptyState icon={UsersIcon} title="No officials yet" description="Add barangay officials to use in document templates." /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Position</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase hidden md:table-cell">Term</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {officials.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{o.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{o.position}</td>
                  <td className="px-4 py-3 text-sm text-slate-500 hidden md:table-cell">
                    {o.term_start ? formatDate(o.term_start) : ''} — {o.term_end ? formatDate(o.term_end) : ''}
                  </td>
                  <td className="px-4 py-3"><Badge color={o.is_active ? 'green' : 'slate'}>{o.is_active ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button className="btn-ghost !px-2" onClick={() => { setEditing(o); setShowModal(true); }}><Pencil className="h-4 w-4" /></button>
                      <button className="btn-ghost !px-2 text-red-600" onClick={() => setShowDelete(o)}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OfficialFormModal open={showModal} onClose={() => { setShowModal(false); setEditing(null); }} onSave={handleSave} official={editing} />
      <ConfirmDialog open={!!showDelete} onClose={() => setShowDelete(null)} onConfirm={() => showDelete && handleDelete(showDelete.id)} title="Delete Official?" message={`Delete ${showDelete?.name}? This cannot be undone.`} confirmLabel="Delete" danger />
    </div>
  );
}

function OfficialFormModal({ open, onClose, onSave, official }: { open: boolean; onClose: () => void; onSave: (o: Partial<BarangayOfficial>) => void; official: BarangayOfficial | null }) {
  const [form, setForm] = useState<Partial<BarangayOfficial>>(official ?? { name: '', position: '', is_active: true, display_order: 0 });

  useEffect(() => { setForm(official ?? { name: '', position: '', is_active: true, display_order: 0 }); }, [official, open]);

  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleSigUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = `signature-${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('barangay-assets').upload(fileName, file);
    if (!error) {
      const { data: urlData } = supabase.storage.from('barangay-assets').getPublicUrl(fileName);
      set('signature_url', urlData.publicUrl);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={official ? 'Edit Official' : 'Add Official'} footer={
      <>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => onSave(form)}>Save</button>
      </>
    }>
      <div className="space-y-4">
        <div><label className="label">Name</label><input className="input" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} /></div>
        <div><label className="label">Position</label><input className="input" value={form.position ?? ''} onChange={(e) => set('position', e.target.value)} placeholder="e.g., Kagawad, Secretary" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Term Start</label><input type="date" className="input" value={form.term_start ?? ''} onChange={(e) => set('term_start', e.target.value || null)} /></div>
          <div><label className="label">Term End</label><input type="date" className="input" value={form.term_end ?? ''} onChange={(e) => set('term_end', e.target.value || null)} /></div>
        </div>
        <div><label className="label">Display Order</label><input type="number" className="input" value={form.display_order ?? 0} onChange={(e) => set('display_order', parseInt(e.target.value) || 0)} /></div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="is_active" checked={form.is_active ?? true} onChange={(e) => set('is_active', e.target.checked)} className="h-4 w-4 rounded text-blue-600" />
          <label htmlFor="is_active" className="text-sm font-medium text-slate-700">Active</label>
        </div>
        <div>
          <label className="label">Signature Image</label>
          {form.signature_url && <img src={form.signature_url} alt="Signature" className="h-16 mb-2 object-contain" />}
          <label className="btn-secondary cursor-pointer">
            <Upload className="h-4 w-4" /> Upload Signature
            <input type="file" accept="image/*" className="hidden" onChange={handleSigUpload} />
          </label>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// USERS MANAGER (Super Admin only)
// ============================================================================
function UsersManager() {
  const { session } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<string>('staff');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setUsers(data as Profile[]);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleRoleChange = async (id: string, role: string) => {
    await supabase.from('profiles').update({ role }).eq('id', id);
    await logAudit('User Role Changed', 'profile', id, `Role changed to ${role}`);
    fetchUsers();
  };

  const handleToggleActive = async (u: Profile) => {
    await supabase.from('profiles').update({ is_active: !u.is_active }).eq('id', u.id);
    await logAudit('User Status Changed', 'profile', u.id, `${u.is_active ? 'Deactivated' : 'Activated'} ${u.full_name}`);
    fetchUsers();
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    const { data, error: signUpError } = await supabase.auth.admin.createUser({
      email: newEmail.trim(),
      password: newPassword,
      user_metadata: { full_name: newName },
      app_metadata: { role: newRole },
    });
    if (signUpError) {
      setError(signUpError.message);
      setCreating(false);
      return;
    }
    if (data.user) {
      await supabase.from('profiles').update({ role: newRole, full_name: newName }).eq('id', data.user.id);
      await logAudit('User Created', 'profile', data.user.id, `Created ${newName} as ${newRole}`);
    }
    setShowAddModal(false);
    setNewEmail('');
    setNewName('');
    setNewPassword('');
    setNewRole('staff');
    setCreating(false);
    fetchUsers();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4" /> Add User
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase hidden sm:table-cell">Email</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Role</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-slate-800">{u.full_name || '—'}</p>
                  <p className="text-xs text-slate-500 sm:hidden">{u.id === session?.user.id ? 'You' : ''}</p>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700 hidden sm:table-cell">
                  {u.id === session?.user.id ? <span className="text-blue-600 font-medium">(You)</span> : ''}
                </td>
                <td className="px-4 py-3">
                  <select className="select !py-1 !text-xs w-32" value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}>
                    {USER_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => handleToggleActive(u)} className={`badge ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add User" footer={
        <>
          <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create User
          </button>
        </>
      }>
        <div className="space-y-4">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div><label className="label">Full Name</label><input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
          <div><label className="label">Email</label><input type="email" className="input" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
          <div><label className="label">Password</label><input type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
          <div><label className="label">Role</label>
            <select className="select" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              {USER_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================================
// DOCUMENT TYPES MANAGER
// ============================================================================
function DocumentTypesManager() {
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DocumentType | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchDocTypes = async () => {
    setLoading(true);
    const { data } = await supabase.from('document_types').select('*').order('display_order');
    if (data) setDocTypes(data as DocumentType[]);
    setLoading(false);
  };

  useEffect(() => { fetchDocTypes(); }, []);

  const handleSave = async (dt: Partial<DocumentType>) => {
    if (editing) {
      await supabase.from('document_types').update(dt).eq('id', editing.id);
      await logAudit('Document Type Updated', 'document_type', editing.id, `Updated ${dt.name}`);
    } else {
      const { data } = await supabase.from('document_types').insert(dt).select().maybeSingle();
      if (data) await logAudit('Document Type Created', 'document_type', (data as DocumentType).id, `Created ${dt.name}`);
    }
    setShowModal(false);
    setEditing(null);
    fetchDocTypes();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>
          <Plus className="h-4 w-4" /> Add Document Type
        </button>
      </div>

      {docTypes.length === 0 ? (
        <div className="card"><EmptyState icon={FileText} title="No document types yet" description="Add document types like Certificate of Residency, Indigency, etc." /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {docTypes.map((dt) => (
            <div key={dt.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50"><FileText className="h-5 w-5 text-blue-600" /></div>
                <div className="flex gap-1">
                  <button className="btn-ghost !px-2" onClick={() => { setEditing(dt); setShowModal(true); }}><Pencil className="h-4 w-4" /></button>
                </div>
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-800">{dt.name}</h3>
              <p className="text-xs text-slate-500 mt-1">{dt.description}</p>
              <div className="mt-3 flex items-center gap-2">
                {dt.default_fee > 0 && <Badge color="green">₱{dt.default_fee}</Badge>}
                <Badge color={dt.is_active ? 'blue' : 'slate'}>{dt.is_active ? 'Active' : 'Inactive'}</Badge>
                {dt.allow_download && <Badge color="teal">Downloadable</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}

      <DocTypeFormModal open={showModal} onClose={() => { setShowModal(false); setEditing(null); }} onSave={handleSave} docType={editing} />
    </div>
  );
}

function DocTypeFormModal({ open, onClose, onSave, docType }: { open: boolean; onClose: () => void; onSave: (dt: Partial<DocumentType>) => void; docType: DocumentType | null }) {
  const [form, setForm] = useState<Partial<DocumentType>>(docType ?? { name: '', code: '', description: '', default_fee: 0, is_active: true, allow_download: true, display_order: 0 });
  useEffect(() => { setForm(docType ?? { name: '', code: '', description: '', default_fee: 0, is_active: true, allow_download: true, display_order: 0 }); }, [docType, open]);
  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} title={docType ? 'Edit Document Type' : 'Add Document Type'} footer={
      <><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={() => onSave(form)}>Save</button></>
    }>
      <div className="space-y-4">
        <div><label className="label">Name</label><input className="input" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="e.g., Certificate of Residency" /></div>
        <div><label className="label">Code</label><input className="input" value={form.code ?? ''} onChange={(e) => set('code', e.target.value)} placeholder="e.g., RES" /></div>
        <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Default Fee (PHP)</label><input type="number" className="input" value={form.default_fee ?? 0} onChange={(e) => set('default_fee', parseFloat(e.target.value) || 0)} /></div>
          <div><label className="label">Display Order</label><input type="number" className="input" value={form.display_order ?? 0} onChange={(e) => set('display_order', parseInt(e.target.value) || 0)} /></div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active ?? true} onChange={(e) => set('is_active', e.target.checked)} className="h-4 w-4 rounded text-blue-600" /><span className="text-sm font-medium text-slate-700">Active</span></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.allow_download ?? true} onChange={(e) => set('allow_download', e.target.checked)} className="h-4 w-4 rounded text-blue-600" /><span className="text-sm font-medium text-slate-700">Allow Download</span></label>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// ASSETS MANAGER
// ============================================================================
function AssetsManager() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadCat, setUploadCat] = useState('logo');
  const [uploading, setUploading] = useState(false);

  const fetchAssets = async () => {
    setLoading(true);
    let query = supabase.from('asset_repository').select('*').order('created_at', { ascending: false });
    if (filterCat) query = query.eq('category', filterCat);
    const { data } = await query;
    if (data) setAssets(data as Asset[]);
    setLoading(false);
  };

  useEffect(() => { fetchAssets(); }, [filterCat]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fileName = `asset-${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('barangay-assets').upload(fileName, file);
    if (!error) {
      const { data: urlData } = supabase.storage.from('barangay-assets').getPublicUrl(fileName);
      const { data: newAsset } = await supabase.from('asset_repository').insert({
        name: uploadName || file.name,
        category: uploadCat,
        url: urlData.publicUrl,
      }).select().maybeSingle();
      if (newAsset) await logAudit('Asset Uploaded', 'asset', (newAsset as Asset).id, `Uploaded ${uploadName || file.name}`);
    }
    setUploading(false);
    setShowModal(false);
    setUploadName('');
    fetchAssets();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('asset_repository').delete().eq('id', id);
    await logAudit('Asset Deleted', 'asset', id, 'Deleted asset');
    fetchAssets();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between gap-3 mb-4">
        <select className="select sm:w-48" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
          <option value="">All Categories</option>
          {ASSET_CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
        </select>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4" /> Upload Asset
        </button>
      </div>

      {assets.length === 0 ? (
        <div className="card"><EmptyState icon={Image} title="No assets yet" description="Upload logos, seals, signatures, frames, and other reusable elements." /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {assets.map((a) => (
            <div key={a.id} className="card p-3 group">
              <div className="aspect-square rounded-lg bg-slate-50 overflow-hidden mb-2 flex items-center justify-center">
                {a.url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i) ? (
                  <img src={a.url} alt={a.name} className="max-h-full max-w-full object-contain" />
                ) : (
                  <Image className="h-8 w-8 text-slate-300" />
                )}
              </div>
              <p className="text-xs font-medium text-slate-700 truncate">{a.name}</p>
              <div className="flex items-center justify-between mt-1">
                <Badge color="slate">{a.category}</Badge>
                <button className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(a.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Upload Asset" footer={null}>
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="Asset name" /></div>
          <div><label className="label">Category</label>
            <select className="select" value={uploadCat} onChange={(e) => setUploadCat(e.target.value)}>
              {ASSET_CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
            </select>
          </div>
          <label className="btn-primary cursor-pointer w-full justify-center">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? 'Uploading...' : 'Choose File & Upload'}
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================================
// AUDIT LOG VIEWER
// ============================================================================
function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      const { data } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(100);
      if (data) setLogs(data as AuditLogEntry[]);
      setLoading(false);
    };
    fetchLogs();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date/Time</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">User</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Action</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase hidden md:table-cell">Description</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">No audit entries yet</td></tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{l.user_name ?? '—'}</td>
                  <td className="px-4 py-3"><Badge color="blue">{l.action}</Badge></td>
                  <td className="px-4 py-3 text-sm text-slate-600 hidden md:table-cell">{l.description ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
