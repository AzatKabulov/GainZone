/** Hand-off between a screen and the exercise picker sheet. */
type Handler = (ids: string[]) => void;

let handler: Handler | null = null;
let opts: { multi: boolean; title: string } = { multi: true, title: 'ADD EXERCISES' };

export function setPickHandler(fn: Handler, o?: Partial<typeof opts>) {
  handler = fn;
  opts = { multi: true, title: 'ADD EXERCISES', ...o };
}

export function pickOptions() {
  return opts;
}

export function deliverPick(ids: string[]) {
  const h = handler;
  handler = null;
  if (h && ids.length) h(ids);
}
