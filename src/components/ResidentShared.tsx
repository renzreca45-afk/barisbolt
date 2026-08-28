import { calculateAge, getFullName, isSenior } from '@/lib/age';
import type { Resident } from '@/lib/types';
import { Badge } from '@/components/ui';

export function ResidentBadges({ r }: { r: Resident }) {
  const age = calculateAge(r.date_of_birth);
  const senior = isSenior(r.date_of_birth);

  return (
    <div className="flex flex-wrap gap-1.5">
      {r.sex && <Badge color={r.sex === 'male' ? 'blue' : 'purple'}>{r.sex === 'male' ? 'Male' : 'Female'}</Badge>}
      {age !== null && <Badge color="slate">Age {age}</Badge>}
      {senior && <Badge color="yellow">Senior</Badge>}
      {r.is_registered_senior && <Badge color="orange">Reg. Senior</Badge>}
      {r.is_pwd && <Badge color="teal">PWD</Badge>}
      {r.is_indigent && <Badge color="red">Indigent</Badge>}
      {r.is_solo_parent && <Badge color="green">Solo Parent</Badge>}
      {r.is_ofw && <Badge color="indigo">OFW</Badge>}
      {r.is_4ps && <Badge color="purple">4Ps</Badge>}
      {r.registered_voter === 'yes' && <Badge color="blue">Voter</Badge>}
    </div>
  );
}

export function ResidentAvatar({ r, size = 'md' }: { r: Resident; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-16 w-16 text-xl',
  };
  const initials = `${r.first_name?.charAt(0) ?? ''}${r.last_name?.charAt(0) ?? ''}`.toUpperCase();
  const bgClass = r.sex === 'female' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700';

  return (
    <div className={`flex items-center justify-center rounded-full font-semibold flex-shrink-0 ${sizes[size]} ${bgClass}`}>
      {initials || '?'}
    </div>
  );
}

export function VerificationBadge({ status }: { status: Resident['verification_status'] }) {
  const map = {
    imported: { color: 'slate', label: 'Imported' },
    for_verification: { color: 'yellow', label: 'For Verification' },
    verified: { color: 'green', label: 'Verified' },
    archived: { color: 'red', label: 'Archived' },
  } as const;
  const v = map[status];
  return <Badge color={v.color}>{v.label}</Badge>;
}

export { getFullName };
