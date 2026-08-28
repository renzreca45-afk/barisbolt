/** Centralized age calculation — the single source of truth for all age logic in BARIS. */

export function calculateAge(dob: string | Date | null | undefined): number | null {
  if (!dob) return null;
  const birthDate = typeof dob === 'string' ? new Date(dob) : dob;
  if (isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function isSenior(dob: string | Date | null | undefined): boolean {
  const age = calculateAge(dob);
  return age !== null && age >= 60;
}

export function getAgeBracket(dob: string | Date | null | undefined): string | null {
  const age = calculateAge(dob);
  if (age === null) return null;
  if (age <= 4) return '0-4';
  if (age <= 12) return '5-12';
  if (age <= 17) return '13-17';
  if (age <= 24) return '18-24';
  if (age <= 59) return '25-59';
  return '60+';
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatShortDate(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function getFullName(r: {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  suffix?: string;
}): string {
  const parts = [r.first_name, r.middle_name, r.last_name].filter((p) => p && p.trim());
  const name = parts.join(' ').trim();
  return r.suffix ? `${name} ${r.suffix}`.trim() : name;
}
