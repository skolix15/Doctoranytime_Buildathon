import { create } from 'zustand';

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  dateOfBirth?: string;
  gender?: string;
  conditions?: string[];
  medications?: string[];
  notes?: string;
}

interface FamilyState {
  activeMemberId: string | null; // null = self
  members: FamilyMember[];
  setActiveMember: (id: string | null) => void;
  setMembers: (members: FamilyMember[]) => void;
}

export const useFamilyStore = create<FamilyState>((set) => ({
  activeMemberId: null,
  members: [],
  setActiveMember: (id) => set({ activeMemberId: id }),
  setMembers: (members) => set({ members })
}));
