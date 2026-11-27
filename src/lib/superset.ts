/** Supersets: consecutive exercises sharing a `superset` id are done back to back, rest after the last one. */

type Item = { superset?: string | null };

const COLORS = ['#60A5FA', '#F59E0B', '#A78BFA', '#F472B6', '#34D399'];

/** Groups must be one run of neighbours with 2+ members; anything else is cleared. */
export function normalizeSupersets<T extends Item>(list: T[]): T[] {
  const seen = new Set<string>();
  const out = list.map((x) => ({ ...x }));
  let i = 0;
  while (i < out.length) {
    const id = out[i].superset;
    if (!id) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < out.length && out[j + 1].superset === id) j++;
    if (seen.has(id) || j === i) for (let k = i; k <= j; k++) out[k].superset = null;
    seen.add(id);
    i = j + 1;
  }
  return out;
}

/** Join item i with the next one (extends an existing group). */
export function linkWithNext<T extends Item>(list: T[], i: number): T[] {
  if (i < 0 || i + 1 >= list.length) return list;
  const id = list[i].superset || list[i + 1].superset || Math.random().toString(36).slice(2, 10);
  return normalizeSupersets(list.map((x, k) => (k === i || k === i + 1 ? { ...x, superset: id } : x)));
}

export function unlink<T extends Item>(list: T[], i: number): T[] {
  return normalizeSupersets(list.map((x, k) => (k === i ? { ...x, superset: null } : x)));
}

export interface SupersetInfo {
  color: string;
  letter: string;
  first: boolean;
  last: boolean;
}

/** Display info per item (null when not in a superset). */
export function supersetInfo(list: Item[]): (SupersetInfo | null)[] {
  const order: string[] = [];
  return list.map((x, i) => {
    const id = x.superset;
    if (!id) return null;
    if (!order.includes(id)) order.push(id);
    const n = order.indexOf(id);
    return {
      color: COLORS[n % COLORS.length],
      letter: String.fromCharCode(65 + (n % 26)),
      first: list[i - 1]?.superset !== id,
      last: list[i + 1]?.superset !== id,
    };
  });
}
