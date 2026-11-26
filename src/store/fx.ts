import { create } from 'zustand';

import { nextQuote, type Quote } from '@/lib/quotes';

/** Visual rewards: a fresh line when you finish something, and full-screen celebrations. */

export interface Toast extends Quote {
  id: number;
  /** Small caps line above the text, e.g. "SET DONE". */
  label: string;
  icon?: 'check' | 'undo' | 'trophy' | 'timer';
  /** Runs when the toast is tapped (e.g. undo), then the toast closes. */
  onPress?: () => void;
}

export type OverlayKind = 'workout' | 'pr';

export interface Overlay {
  id: number;
  kind: OverlayKind;
  kicker: string;
  title: string;
  quote: Quote;
}

interface FxState {
  toast: Toast | null;
  overlay: Overlay | null;
  cheer: (label: string) => void;
  info: (label: string, text: string, opts?: { onPress?: () => void; icon?: Toast['icon']; by?: string; ms?: number }) => void;
  dismissToast: () => void;
  celebrate: (o: Omit<Overlay, 'id' | 'quote'>) => void;
  dismiss: () => void;
}

let seq = 1;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let overlayTimer: ReturnType<typeof setTimeout> | undefined;

export const useFx = create<FxState>((set, get) => {
  const show = (t: Omit<Toast, 'id'>, ms: number) => {
    const id = seq++;
    set({ toast: { ...t, id } });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null });
    }, ms);
  };
  return {
    toast: null,
    overlay: null,
    cheer: (label) => {
      const q = nextQuote();
      show({ label, ...q }, Math.min(6500, 2600 + q.text.length * 35));
    },
    info: (label, text, opts) =>
      show({ label, text, onPress: opts?.onPress, icon: opts?.icon, by: opts?.by }, opts?.ms ?? (opts?.onPress ? 4000 : 2600)),
    dismissToast: () => {
      clearTimeout(toastTimer);
      set({ toast: null });
    },
    celebrate: (o) => {
      const id = seq++;
      clearTimeout(toastTimer);
      set({ overlay: { ...o, id, quote: nextQuote() }, toast: null });
      clearTimeout(overlayTimer);
      overlayTimer = setTimeout(() => {
        if (get().overlay?.id === id) set({ overlay: null });
      }, 5200);
    },
    dismiss: () => {
      clearTimeout(overlayTimer);
      set({ overlay: null });
    },
  };
});
