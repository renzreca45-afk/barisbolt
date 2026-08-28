import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Pencil,
  Archive,
  FileText,
  Phone,
  Mail,
  MapPin,
  Home,
  GraduationCap,
  Briefcase,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Resident, Household, Transaction } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { navigate } from '@/lib/router';
import { calculateAge, formatDate, getFullName, formatCurrency, isSenior } from '@/lib/age';
import { logAudit } from '@/lib/audit';
import { Modal, ConfirmDialog, Badge, EmptyState } from '@/components/ui';
import { ResidentAvatar, ResidentBadges, VerificationBadge } from '@/components/ResidentShared';
import { ResidentForm } from '@/components/ResidentForm';

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className="text-sm text-slate-800 mt-0.5">{value || '—'}</span>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: typeof Home; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-slate-400" />
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">{children}</div>
    </div>
  );
}

export function ResidentProfile({ residentId }: { residentId: string }) {
  const { canEdit, canDelete, session } = useAuth();
  const [resident, setResident] = useState<Resident | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<Resident[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const fetchResident = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('residents')
      .select('*')
      .eq('id', residentId)
      .maybeSingle();
    if (error || !data) {
      setLoading(false);
      return;
    }
    const r = data as Resident;
    setResident(r);

    if (r.household_id) {
      const { data: hData } = await supabase
        .from('households')
        .select('*')
        .eq('id', r.household_id)
        .maybeSingle();
      if (hData) setHousehold(hData as Household);

      const { data: members } = await supabase
        .from('residents')
        .select('*')
        .eq('household_id', r.household_id)
        .neq('id', residentId)
        .order('relationship_to_head');
      if (members) setHouseholdMembers(members as Resident[]);
    }

    const { data: txns } = await supabase
      .from('transactions')
      .select('*')
      .eq('resident_id', residentId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (txns) setTransactions(txns as Transaction[]);

    setLoading(false);
  };

  useEffect(() => {
    fetchResident();
  }, [residentId]);

  const handleArchive = async () => {
    if (!resident) return;
    const newStatus = resident.verification_status === 'archived' ? 'for_verification' : 'archived';
    await supabase.from('residents').update({ verification_status: newStatus, updated_by: session?.user.id }).eq('id', resident.id);
    await logAudit(newStatus === 'archived' ? 'Resident Archived' : 'Resident Unarchived', 'resident', resident.id, `${getFullName(resident)}`);
    fetchResident();
  };

  const handleDelete = async () => {
    if (!resident || !canDelete()) return;
    await supabase.from('residents').delete().eq('id', resident.id);
    await logAudit('Resident Deleted', 'resident', resident.id, `Deleted ${getFullName(resident)}`);
    navigate('residents');
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!resident) {
    return (
      <div className="p-6">
        <div className="card">
          <EmptyState icon={AlertCircle} title="Resident not found" description="This resident may have been deleted." />
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button className="btn-ghost" onClick={() => setEditing(false)}>
            <ArrowLeft className="h-4 w-4" /> Back to Profile
          </button>
          <h1 className="text-xl font-bold text-slate-900">Edit Resident</h1>
        </div>
        <ResidentForm
          resident={resident}
          onSaved={() => {
            setEditing(false);
            fetchResident();
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  const age = calculateAge(resident.date_of_birth);
  const senior = isSenior(resident.date_of_birth);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <button className="btn-ghost self-start" onClick={() => navigate('residents')}>
          <ArrowLeft className="h-4 w-4" /> Back to Residents
        </button>
      </div>

      <div className="card p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <ResidentAvatar r={resident} size="lg" />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900">{getFullName(resident)}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {age !== null && <Badge color="slate">Age: {age}</Badge>}
              {resident.sex && <Badge color={resident.sex === 'male' ? 'blue' : 'purple'}>{resident.sex}</Badge>}
              <VerificationBadge status={resident.verification_status} />
              {senior && <Badge color="yellow">Senior Citizen (60+)</Badge>}
            </div>
            <div className="mt-3">
              <ResidentBadges r={resident} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 self-start">
            {canEdit() && (
              <button className="btn-primary" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" /> Edit
              </button>
            )}
            {canEdit() && (
              <button className="btn-secondary" onClick={() => setShowArchive(true)}>
                <Archive className="h-4 w-4" /> {resident.verification_status === 'archived' ? 'Unarchive' : 'Archive'}
              </button>
            )}
            {canDelete() && (
              <button className="btn-danger" onClick={() => setShowDelete(true)}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SectionCard title="Personal Information" icon={Home}>
          <InfoRow label="First Name" value={resident.first_name} />
          <InfoRow label="Middle Name" value={resident.middle_name} />
          <InfoRow label="Last Name" value={resident.last_name} />
          <InfoRow label="Suffix" value={resident.suffix} />
          <InfoRow label="Date of Birth" value={formatDate(resident.date_of_birth)} />
          <InfoRow label="Age" value={age !== null ? `${age} years` : null} />
          <InfoRow label="Sex" value={resident.sex} />
          <InfoRow label="Civil Status" value={resident.civil_status} />
          <InfoRow label="Nationality" value={resident.nationality} />
          <InfoRow label="Place of Birth" value={resident.place_of_birth} />
          <InfoRow label="Religion" value={resident.religion} />
        </SectionCard>

        <SectionCard title="Contact Information" icon={Phone}>
          <InfoRow label="Contact Number" value={resident.contact_number} />
          <InfoRow label="Email" value={resident.email} />
          <InfoRow label="Emergency Contact Name" value={resident.emergency_contact_name} />
          <InfoRow label="Emergency Contact Number" value={resident.emergency_contact_number} />
          <InfoRow label="Emergency Contact Relationship" value={resident.emergency_contact_relationship} />
        </SectionCard>

        <SectionCard title="Address / Household" icon={MapPin}>
          <InfoRow label="Purok" value={resident.purok} />
          <InfoRow label="Village" value={resident.village} />
          <InfoRow label="Block" value={resident.block} />
          <InfoRow label="Lot" value={resident.lot} />
          <InfoRow label="Complete Address" value={resident.complete_address} />
          <InfoRow label="Residency Info" value={resident.residency_info} />
          <InfoRow label="Household" value={household?.household_id_display ?? 'Individual'} />
          <InfoRow label="Relationship to Head" value={resident.relationship_to_head?.replace('_', ' ')} />
        </SectionCard>

        <SectionCard title="Social Classification" icon={CheckCircle}>
          <InfoRow label="Indigent" value={resident.is_indigent ? `Yes${resident.indigent_source ? ` (${resident.indigent_source})` : ''}` : 'No'} />
          <InfoRow label="PWD" value={resident.is_pwd ? `Yes${resident.pwd_details ? ` — ${resident.pwd_details}` : ''}` : 'No'} />
          <InfoRow label="Senior Citizen (by age)" value={senior ? 'Yes (60+)' : 'No'} />
          <InfoRow label="Registered Senior" value={resident.is_registered_senior ? `Yes${resident.senior_registration_source ? ` (${resident.senior_registration_source})` : ''}` : 'No'} />
          <InfoRow label="Solo Parent" value={resident.is_solo_parent ? `Yes${resident.solo_parent_registered ? ' (Registered)' : ''}` : 'No'} />
          <InfoRow label="4Ps Member" value={resident.is_4ps ? `Yes${resident.four_ps_source ? ` (${resident.four_ps_source})` : ''}` : 'No'} />
          <InfoRow label="OFW" value={resident.is_ofw ? `Yes${resident.ofw_source ? ` (${resident.ofw_source})` : ''}` : 'No'} />
          <InfoRow label="Registered Voter" value={resident.registered_voter === 'yes' ? `Yes${resident.voter_registration_source ? ` (${resident.voter_registration_source})` : ''}` : resident.registered_voter === 'no' ? 'No' : 'Unknown'} />
        </SectionCard>

        <SectionCard title="Education" icon={GraduationCap}>
          <InfoRow label="School" value={resident.school} />
          <InfoRow label="Current Enrollment" value={resident.current_enrollment} />
          <InfoRow label="Highest Education" value={resident.highest_education} />
          <InfoRow label="Course / Strand" value={resident.course_strand} />
        </SectionCard>

        <SectionCard title="Employment" icon={Briefcase}>
          <InfoRow label="Employment Status" value={resident.employment_status} />
          <InfoRow label="Occupation" value={resident.occupation} />
          <InfoRow label="Employer" value={resident.employer} />
          <InfoRow label="Place of Work" value={resident.place_of_work} />
          <InfoRow label="Employment Type" value={resident.employment_type} />
          <InfoRow label="Monthly Income" value={resident.monthly_income ? formatCurrency(resident.monthly_income) : null} />
          <InfoRow label="Daily Income" value={resident.daily_income ? formatCurrency(resident.daily_income) : null} />
        </SectionCard>
      </div>

      {/* Verification */}
      <div className="card p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-800">Verification & Administrative Notes</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <InfoRow label="Verification Status" value={resident.verification_status.replace(/_/g, ' ')} />
          <InfoRow label="Verified Date" value={formatDate(resident.verified_date)} />
          <InfoRow label="Verification Notes" value={resident.verification_notes} />
          <InfoRow label="Administrative Notes" value={resident.admin_notes} />
          <InfoRow label="Source ID" value={resident.source_id} />
          <InfoRow label="Source Resident ID" value={resident.source_resident_id} />
        </div>
      </div>

      {/* Household members */}
      {household && householdMembers.length > 0 && (
        <div className="card p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-bold text-slate-800">Household Members</h3>
            </div>
            <button
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
              onClick={() => navigate('households', { id: household.id })}
            >
              View Household
            </button>
          </div>
          <div className="space-y-1">
            {householdMembers.map((m) => (
              <button
                key={m.id}
                onClick={() => navigate('residents', { id: m.id })}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors text-left"
              >
                <ResidentAvatar r={m} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{getFullName(m)}</p>
                  <p className="text-xs text-slate-500">{m.relationship_to_head?.replace('_', ' ') ?? 'Member'}</p>
                </div>
                <span className="text-xs text-slate-400">{calculateAge(m.date_of_birth)} yrs</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-bold text-slate-800">Document Transactions</h3>
          </div>
          {canEdit() && (
            <button
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
              onClick={() => navigate('documents', { residentId: resident.id })}
            >
              Generate Document
            </button>
          )}
        </div>
        {transactions.length > 0 ? (
          <div className="space-y-1">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-800">{t.purpose || 'Document'}</p>
                  <p className="text-xs text-slate-500">{formatDate(t.date_requested)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {t.fee > 0 && <span className="text-xs text-slate-500">{formatCurrency(t.fee)}</span>}
                  <Badge color={t.status === 'released' ? 'green' : t.status === 'cancelled' ? 'red' : 'yellow'}>
                    {t.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-4 text-center">No transactions yet</p>
        )}
      </div>

      <ConfirmDialog
        open={showArchive}
        onClose={() => setShowArchive(false)}
        onConfirm={handleArchive}
        title={resident.verification_status === 'archived' ? 'Unarchive Resident?' : 'Archive Resident?'}
        message={
          resident.verification_status === 'archived'
            ? 'This resident will be visible again in lists and reports.'
            : 'This resident will be hidden from lists and reports but the data is preserved.'
        }
        confirmLabel={resident.verification_status === 'archived' ? 'Unarchive' : 'Archive'}
      />

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Resident?"
        message="This permanently removes the resident record. This action cannot be undone."
        confirmLabel="Delete Permanently"
        danger
      />
    </div>
  );
}
