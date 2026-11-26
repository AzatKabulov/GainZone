import { useData, type Metric, type Profile } from '@/store/data';

export function useProfile(): Profile | undefined {
  return useData((s) =>
    Object.values(s.profile)
      .filter((p) => !p.deleted)
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))[0],
  );
}

export function saveProfile(patch: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at' | 'deleted'>>) {
  const s = useData.getState();
  const cur = Object.values(s.profile)
    .filter((p) => !p.deleted)
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))[0];
  if (cur) s.patch('profile', cur.id, patch);
  else s.create('profile', patch);
}

export function metricsSorted(all: Record<string, Metric>): Metric[] {
  return Object.values(all)
    .filter((m) => !m.deleted)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.updated_at < b.updated_at ? -1 : 1));
}

export function bmi(weight: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (!weight || !heightCm) return null;
  const h = heightCm / 100;
  return Math.round((weight / (h * h)) * 10) / 10;
}
