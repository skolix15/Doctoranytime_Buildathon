import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{ doctorId?: string; doctorName?: string; qnaId?: string; answerSnippet?: string }>;
  confidenceScore?: number;
  urgencyLevel?: string;
  bookingIntent?: {
    doctorId?: string;
    doctorName?: string;
    specialty?: string;
    service?: string;
    preferredDate?: string;
    preferredTime?: string;
    forFamilyMemberId?: string;
    notes?: string;
  } | null;
  suggestedDoctors?: Array<{
    _id: string;
    profile: { firstName: string; lastName: string };
    specialties: string[];
    stats?: { rating?: number; reviewCount?: number };
  }>;
  timestamp: Date;
}

interface AssistantState {
  sessionId: string | null;
  messages: Message[];
  isStreaming: boolean;
  activeFamilyMemberId: string | null;
  popupOpen: boolean;
  popupPrefill: string | null;
  addMessage: (msg: Message) => void;
  setMessages: (msgs: Message[]) => void;
  setSessionId: (id: string) => void;
  setStreaming: (v: boolean) => void;
  setActiveFamilyMember: (id: string | null) => void;
  clearSession: () => void;
  updateLastMessage: (patch: Partial<Message>) => void;
  openPopup: (prefill?: string) => void;
  closePopup: () => void;
}

export const useAssistantStore = create<AssistantState>((set) => ({
  sessionId: null,
  messages: [],
  isStreaming: false,
  activeFamilyMemberId: null,
  popupOpen: false,
  popupPrefill: null,
  addMessage: (msg) => set(s => ({ messages: [...s.messages, msg] })),
  setMessages: (msgs) => set({
    isStreaming: false,
    messages: msgs
      .filter(m => m.content && m.content.trim().length > 0)
      .map(m => ({
        ...m,
        timestamp: m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp)
      }))
  }),
  setSessionId: (id) => {
    localStorage.setItem('assistantSessionId', id);
    set({ sessionId: id });
  },
  setStreaming: (v) => set({ isStreaming: v }),
  setActiveFamilyMember: (id) => set({ activeFamilyMemberId: id }),
  clearSession: () => {
    localStorage.removeItem('assistantSessionId');
    set({ sessionId: null, messages: [], isStreaming: false });
  },
  updateLastMessage: (patch) => set(s => {
    const msgs = [...s.messages];
    if (msgs.length > 0) msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], ...patch };
    return { messages: msgs };
  }),
  openPopup: (prefill) => set({ popupOpen: true, popupPrefill: prefill ?? null }),
  closePopup: () => set({ popupOpen: false, popupPrefill: null }),
}));
