import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AcademicSessionState {
  selectedSessionId: string;
  setSelectedSessionId: (sessionId: string) => void;
}

export const useAcademicSessionStore = create<AcademicSessionState>()(
  persist(
    (set) => ({
      selectedSessionId: "",
      setSelectedSessionId: (sessionId) => set({ selectedSessionId: sessionId }),
    }),
    { name: "dashboard-selected-session" },
  ),
);
