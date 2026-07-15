export const NAMES = [
  'Derek Okafor',
  'Lena Fischer',
  'Carlos Mendoza',
  'Yuki Tanaka',
  'Aisha Nkrumah',
  'Marcus Webb',
  'Sofia Reinholt',
  'James Kwon',
  'Amara Diallo',
  'Priya Sharma',
  'Alex Morgan',
  'Kevin Chen',
  'Sara Al-Sayed',
  'Michael Rodriguez',
  'Nina Patel',
];

export function getApplicantName(userId: string): string {
  if (!userId) return 'Unknown Applicant';

  // Simple deterministic hash
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  const index = Math.abs(hash) % NAMES.length;
  return NAMES[index] ?? 'Unknown Applicant';
}
