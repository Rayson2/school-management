import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Student } from "../../../server/db/schemas/students";

export type StudentListItem = Student & {
  fullName: string;
  username: string;
  avatarUrl?: string | null;
  sessionName: string;
  className: string;
};

interface StudentState {
  students: StudentListItem[];
  loading: boolean;
  error: string | null;
  fetchStudents: (sessionId?: string) => Promise<void>;
}

export const useStudentStore = create<StudentState>()(
  devtools((set) => ({
    students: [],
    loading: true,
    error: null,
    fetchStudents: async (sessionId = "") => {
      set({ loading: true, error: null });
      try {
        const query = new URLSearchParams();
        if (sessionId.trim()) query.set("sessionId", sessionId.trim());
        const suffix = query.toString();
        const res = await fetch(`/api/student/all${suffix ? `?${suffix}` : ""}`);
        if (!res.ok) {
          throw new Error("Failed to fetch students");
        }
        const data = await res.json();
        if (data.success) {
          set({ students: data.data, loading: false });
        } else {
          throw new Error(data.message || "Failed to fetch students");
        }
      } catch (err) {
        set({
          error:
            err instanceof Error ? err.message : "An unknown error occurred",
          loading: false,
        });
      }
    },
  })),
);
