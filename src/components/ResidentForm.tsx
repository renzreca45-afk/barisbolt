import { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Resident, Household } from '@/lib/types';
import {
  PUROKS,
  VILLAGES,
  SEXES,
  CIVIL_STATUSES,
  RELATIONSHIPS,
  VERIFICATION_STATUSES,
} from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { logAudit } from '@/lib/audit';
import { getFullName } from '@/lib/age';

interface ResidentFormProps {
  resident: Resident | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function ResidentForm({ resident, onSaved, onCancel }: ResidentFormProps) {
  const { session, canEdit } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [duplicates, setDuplicates] = useState<Resident[]>([]);

  const [form, setForm] = useState<Partial<Resident>>(
    resident ?? {
      first_name: '',
      middle_name: '',
      last_name: '',
      suffix: '',
      nationality: 'Filipino',
      registered_voter: 'unknown',
      verification_status: 'for_verification',
      is_indigent: false,
      is_pwd: false,
      is_registered_senior: false,
      is_solo_parent: false,
      solo_parent_registered: false,
      is_4ps: false,
      is_ofw: false,
    },
  );

  useEffect(() => {
    const fetchHouseholds = async () => {
      const { data } = await supabase
        .from('households')
        .select('*')
        .order('household_id_display', { ascending: true })
        .limit(500);
      if (data) setHouseholds(data as Household[]);
    };
    fetchHouseholds();
  }, []);

  // Duplicate detection
  useEffect(() => {
    const checkDuplicates = async () => {
      if (!form.first_name?.trim() || !form.last_name?.trim()) {
        setDuplicates([]);
        return;
      }
      const { data } = await supabase
        .from('residents')
        .select('*')
        .ilike('first_name', `%${form.first_name.trim()}%`)
        .ilike('last_name', `%${form.last_name.trim()}%`)
        .neq('id', resident?.id ?? '00000000-0000-0000-0000-000000000000')
        .limit(5);
      if (data) setDuplicates(data as Resident[]);
    };
    const timer = setTimeout(checkDuplicates, 400);
    return () => clearTimeout(timer);
  }, [form.first_name, form.last_name, resident?.id]);

  const set = (key: keyof Resident, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!canEdit()) return;
    setError(null);
    setSaving(true);

    const data = {
      ...form,
      updated_by: session?.user.id,
    } as Partial<Resident>;

    try {
      if (resident) {
        const { error: updateError } = await supabase
          .from('residents')
          .update(data)
          .eq('id', resident.id);
        if (updateError) throw updateError;
        await logAudit('Resident Updated', 'resident', resident.id, `Updated ${getFullName(form)}`);
      } else {
        data.created_by = session?.user.id;
        const { data: newRec, error: insertError } = await supabase
          .from('residents')
          .insert(data)
          .select()
          .maybeSingle();
        if (insertError) throw insertError;
        if (newRec) {
          await logAudit('Resident Created', 'resident', (newRec as Resident).id, `Created ${getFullName(form)}`);
        }
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save resident');
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    { id: 'personal', label: 'Personal' },
    { id: 'contact', label: 'Contact' },
    { id: 'address', label: 'Address / Household' },
    { id: 'social', label: 'Social Classification' },
    { id: 'education', label: 'Education' },
    { id: 'employment', label: 'Employment' },
    { id: 'verification', label: 'Verification' },
  ];

  return (
    <div className="space-y-6">
      {duplicates.length > 0 && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3">
          <div className="flex items-center gap-2 text-yellow-800 font-medium text-sm">
            <AlertCircle className="h-4 w-4" /> Possible Duplicate Detected
          </div>
          <p className="text-xs text-yellow-700 mt-1">
            {duplicates.length} resident{duplicates.length > 1 ? 's' : ''} with similar name already exist:
          </p>
          <ul className="mt-2 text-xs text-yellow-700 list-disc list-inside">
            {duplicates.map((d) => (
              <li key={d.id}>
                {getFullName(d)} — {d.purok ?? 'Unknown purok'} {d.village ? `(${d.village})` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Personal */}
      <fieldset className="card p-5">
        <legend className="text-sm font-bold text-slate-800 px-2">Personal Information</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
          <div>
            <label className="label">First Name *</label>
            <input className="input" value={form.first_name ?? ''} onChange={(e) => set('first_name', e.target.value)} />
          </div>
          <div>
            <label className="label">Middle Name</label>
            <input className="input" value={form.middle_name ?? ''} onChange={(e) => set('middle_name', e.target.value)} />
          </div>
          <div>
            <label className="label">Last Name *</label>
            <input className="input" value={form.last_name ?? ''} onChange={(e) => set('last_name', e.target.value)} />
          </div>
          <div>
            <label className="label">Suffix</label>
            <input className="input" value={form.suffix ?? ''} onChange={(e) => set('suffix', e.target.value)} placeholder="Jr, Sr, III..." />
          </div>
          <div>
            <label className="label">Date of Birth</label>
            <input type="date" className="input" value={form.date_of_birth ?? ''} onChange={(e) => set('date_of_birth', e.target.value || null)} />
          </div>
          <div>
            <label className="label">Sex</label>
            <select className="select" value={form.sex ?? ''} onChange={(e) => set('sex', e.target.value || null)}>
              <option value="">Select...</option>
              {SEXES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Civil Status</label>
            <select className="select" value={form.civil_status ?? ''} onChange={(e) => set('civil_status', e.target.value || null)}>
              <option value="">Select...</option>
              {CIVIL_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Nationality</label>
            <input className="input" value={form.nationality ?? ''} onChange={(e) => set('nationality', e.target.value)} />
          </div>
          <div>
            <label className="label">Place of Birth</label>
            <input className="input" value={form.place_of_birth ?? ''} onChange={(e) => set('place_of_birth', e.target.value)} />
          </div>
          <div>
            <label className="label">Religion</label>
            <input className="input" value={form.religion ?? ''} onChange={(e) => set('religion', e.target.value)} />
          </div>
        </div>
      </fieldset>

      {/* Contact */}
      <fieldset className="card p-5">
        <legend className="text-sm font-bold text-slate-800 px-2">Contact Information</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
          <div>
            <label className="label">Contact Number</label>
            <input className="input" value={form.contact_number ?? ''} onChange={(e) => set('contact_number', e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div />
          <div>
            <label className="label">Emergency Contact Name</label>
            <input className="input" value={form.emergency_contact_name ?? ''} onChange={(e) => set('emergency_contact_name', e.target.value)} />
          </div>
          <div>
            <label className="label">Emergency Contact Number</label>
            <input className="input" value={form.emergency_contact_number ?? ''} onChange={(e) => set('emergency_contact_number', e.target.value)} />
          </div>
          <div>
            <label className="label">Emergency Contact Relationship</label>
            <input className="input" value={form.emergency_contact_relationship ?? ''} onChange={(e) => set('emergency_contact_relationship', e.target.value)} />
          </div>
        </div>
      </fieldset>

      {/* Address / Household */}
      <fieldset className="card p-5">
        <legend className="text-sm font-bold text-slate-800 px-2">Address / Household</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
          <div>
            <label className="label">Household</label>
            <select className="select" value={form.household_id ?? ''} onChange={(e) => set('household_id', e.target.value || null)}>
              <option value="">None / Individual</option>
              {households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.household_id_display ?? h.id.slice(0, 8)} — {h.complete_address || h.purok || 'No address'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Relationship to Head</label>
            <select className="select" value={form.relationship_to_head ?? ''} onChange={(e) => set('relationship_to_head', e.target.value || null)}>
              <option value="">Select...</option>
              {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
            </select>
          </div>
          <div />
          <div>
            <label className="label">Purok</label>
            <select className="select" value={form.purok ?? ''} onChange={(e) => set('purok', e.target.value || null)}>
              <option value="">Select...</option>
              {PUROKS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Village</label>
            <select className="select" value={form.village ?? ''} onChange={(e) => set('village', e.target.value || null)}>
              <option value="">Select...</option>
              {VILLAGES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div />
          <div>
            <label className="label">Block</label>
            <input className="input" value={form.block ?? ''} onChange={(e) => set('block', e.target.value)} />
          </div>
          <div>
            <label className="label">Lot</label>
            <input className="input" value={form.lot ?? ''} onChange={(e) => set('lot', e.target.value)} />
          </div>
          <div />
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label">Complete Address</label>
            <input className="input" value={form.complete_address ?? ''} onChange={(e) => set('complete_address', e.target.value)} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label">Residency Information</label>
            <input className="input" value={form.residency_info ?? ''} onChange={(e) => set('residency_info', e.target.value)} placeholder="e.g., Resident since 2010" />
          </div>
        </div>
      </fieldset>

      {/* Social Classification */}
      <fieldset className="card p-5">
        <legend className="text-sm font-bold text-slate-800 px-2">Social Classification</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_indigent" checked={form.is_indigent ?? false} onChange={(e) => set('is_indigent', e.target.checked)} className="h-4 w-4 rounded text-blue-600" />
            <label htmlFor="is_indigent" className="text-sm font-medium text-slate-700">Indigent</label>
          </div>
          <div>
            <label className="label">Indigent Source</label>
            <input className="input" value={form.indigent_source ?? ''} onChange={(e) => set('indigent_source', e.target.value)} />
          </div>
          <div />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_pwd" checked={form.is_pwd ?? false} onChange={(e) => set('is_pwd', e.target.checked)} className="h-4 w-4 rounded text-blue-600" />
            <label htmlFor="is_pwd" className="text-sm font-medium text-slate-700">PWD</label>
          </div>
          <div>
            <label className="label">PWD Details</label>
            <input className="input" value={form.pwd_details ?? ''} onChange={(e) => set('pwd_details', e.target.value)} placeholder="Type of disability" />
          </div>
          <div />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_registered_senior" checked={form.is_registered_senior ?? false} onChange={(e) => set('is_registered_senior', e.target.checked)} className="h-4 w-4 rounded text-blue-600" />
            <label htmlFor="is_registered_senior" className="text-sm font-medium text-slate-700">Registered Senior Citizen</label>
          </div>
          <div>
            <label className="label">Senior Registration Source</label>
            <input className="input" value={form.senior_registration_source ?? ''} onChange={(e) => set('senior_registration_source', e.target.value)} />
          </div>
          <div />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_solo_parent" checked={form.is_solo_parent ?? false} onChange={(e) => set('is_solo_parent', e.target.checked)} className="h-4 w-4 rounded text-blue-600" />
            <label htmlFor="is_solo_parent" className="text-sm font-medium text-slate-700">Solo Parent</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="solo_parent_registered" checked={form.solo_parent_registered ?? false} onChange={(e) => set('solo_parent_registered', e.target.checked)} className="h-4 w-4 rounded text-blue-600" />
            <label htmlFor="solo_parent_registered" className="text-sm font-medium text-slate-700">Registered (Solo Parent)</label>
          </div>
          <div>
            <label className="label">Solo Parent Source</label>
            <input className="input" value={form.solo_parent_source ?? ''} onChange={(e) => set('solo_parent_source', e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_4ps" checked={form.is_4ps ?? false} onChange={(e) => set('is_4ps', e.target.checked)} className="h-4 w-4 rounded text-blue-600" />
            <label htmlFor="is_4ps" className="text-sm font-medium text-slate-700">4Ps Member</label>
          </div>
          <div>
            <label className="label">4Ps Source</label>
            <input className="input" value={form.four_ps_source ?? ''} onChange={(e) => set('four_ps_source', e.target.value)} />
          </div>
          <div />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_ofw" checked={form.is_ofw ?? false} onChange={(e) => set('is_ofw', e.target.checked)} className="h-4 w-4 rounded text-blue-600" />
            <label htmlFor="is_ofw" className="text-sm font-medium text-slate-700">OFW</label>
          </div>
          <div>
            <label className="label">OFW Source</label>
            <input className="input" value={form.ofw_source ?? ''} onChange={(e) => set('ofw_source', e.target.value)} />
          </div>
          <div />
          <div>
            <label className="label">Registered Voter</label>
            <select className="select" value={form.registered_voter ?? 'unknown'} onChange={(e) => set('registered_voter', e.target.value)}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div>
            <label className="label">Voter Registration Source</label>
            <input className="input" value={form.voter_registration_source ?? ''} onChange={(e) => set('voter_registration_source', e.target.value)} placeholder="Precinct / location" />
          </div>
        </div>
      </fieldset>

      {/* Education */}
      <fieldset className="card p-5">
        <legend className="text-sm font-bold text-slate-800 px-2">Education</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          <div>
            <label className="label">School</label>
            <input className="input" value={form.school ?? ''} onChange={(e) => set('school', e.target.value)} />
          </div>
          <div>
            <label className="label">Current Enrollment</label>
            <input className="input" value={form.current_enrollment ?? ''} onChange={(e) => set('current_enrollment', e.target.value)} placeholder="Grade / Year / Not enrolled" />
          </div>
          <div>
            <label className="label">Highest Educational Attainment</label>
            <input className="input" value={form.highest_education ?? ''} onChange={(e) => set('highest_education', e.target.value)} />
          </div>
          <div>
            <label className="label">Course / Strand</label>
            <input className="input" value={form.course_strand ?? ''} onChange={(e) => set('course_strand', e.target.value)} />
          </div>
        </div>
      </fieldset>

      {/* Employment */}
      <fieldset className="card p-5">
        <legend className="text-sm font-bold text-slate-800 px-2">Employment</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
          <div>
            <label className="label">Employment Status</label>
            <input className="input" value={form.employment_status ?? ''} onChange={(e) => set('employment_status', e.target.value)} placeholder="Employed / Unemployed / Self-employed" />
          </div>
          <div>
            <label className="label">Occupation</label>
            <input className="input" value={form.occupation ?? ''} onChange={(e) => set('occupation', e.target.value)} />
          </div>
          <div>
            <label className="label">Employer</label>
            <input className="input" value={form.employer ?? ''} onChange={(e) => set('employer', e.target.value)} />
          </div>
          <div>
            <label className="label">Place of Work</label>
            <input className="input" value={form.place_of_work ?? ''} onChange={(e) => set('place_of_work', e.target.value)} />
          </div>
          <div>
            <label className="label">Employment Type</label>
            <input className="input" value={form.employment_type ?? ''} onChange={(e) => set('employment_type', e.target.value)} placeholder="Full-time / Part-time / Contract" />
          </div>
          <div />
          <div>
            <label className="label">Monthly Income (PHP)</label>
            <input type="number" className="input" value={form.monthly_income ?? ''} onChange={(e) => set('monthly_income', e.target.value ? parseFloat(e.target.value) : null)} />
          </div>
          <div>
            <label className="label">Daily Income (PHP)</label>
            <input type="number" className="input" value={form.daily_income ?? ''} onChange={(e) => set('daily_income', e.target.value ? parseFloat(e.target.value) : null)} />
          </div>
        </div>
      </fieldset>

      {/* Verification */}
      <fieldset className="card p-5">
        <legend className="text-sm font-bold text-slate-800 px-2">Verification</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
          <div>
            <label className="label">Verification Status</label>
            <select className="select" value={form.verification_status ?? 'for_verification'} onChange={(e) => set('verification_status', e.target.value)}>
              {VERIFICATION_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Verified Date</label>
            <input type="date" className="input" value={form.verified_date ?? ''} onChange={(e) => set('verified_date', e.target.value || null)} />
          </div>
          <div />
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label">Verification Notes</label>
            <textarea className="input" rows={2} value={form.verification_notes ?? ''} onChange={(e) => set('verification_notes', e.target.value)} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label">Administrative Notes (Private — staff only)</label>
            <textarea className="input" rows={2} value={form.admin_notes ?? ''} onChange={(e) => set('admin_notes', e.target.value)} />
          </div>
        </div>
      </fieldset>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-white py-4 border-t border-slate-200 -mx-6 px-6">
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save Resident</>}
        </button>
      </div>
    </div>
  );
}
