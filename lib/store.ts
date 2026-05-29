import { create } from 'zustand';
import type { Task } from './supabase';
import type { ScaleKind } from './time';

type ViewState = {
  scaleKind: ScaleKind;
  anchorDate: Date;
  drillStack: Task[];
  selectedSlice: number | null;

  setScale: (kind: ScaleKind) => void;
  setAnchor: (date: Date) => void;
  pushDrill: (task: Task) => void;
  popDrill: () => void;
  clearDrill: () => void;
  replaceDrill: (task: Task) => void;
  setSelectedSlice: (i: number | null) => void;
};

export const useViewStore = create<ViewState>((set) => ({
  scaleKind: 'day',
  anchorDate: new Date(),
  drillStack: [],
  selectedSlice: null,

  setScale: (kind) => set({ scaleKind: kind, selectedSlice: null }),
  setAnchor: (date) => set({ anchorDate: date }),
  pushDrill: (task) =>
    set((s) => ({ drillStack: [...s.drillStack, task], selectedSlice: null })),
  popDrill: () =>
    set((s) => ({ drillStack: s.drillStack.slice(0, -1), selectedSlice: null })),
  clearDrill: () => set({ drillStack: [], selectedSlice: null }),
  replaceDrill: (task) =>
    set((s) => ({ drillStack: [...s.drillStack.slice(0, -1), task], selectedSlice: null })),
  setSelectedSlice: (i) => set({ selectedSlice: i }),
}));

type SessionState = {
  userId: string | null;
  setUserId: (id: string | null) => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  userId: null,
  setUserId: (id) => set({ userId: id }),
}));
