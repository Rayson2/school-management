import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Teacher } from "../../../server/db/schemas/teachers";

export type TeacherListItem = Teacher & {
  fullName: string;
  username: string;
  avatarUrl?: string | null;
};

interface TeacherState {
  teachers: TeacherListItem[];
  loading: boolean;
  error: string | null;
  fetchTeachers: (sessionId?: string) => Promise<void>;
}

export const useTeacherStore = create<TeacherState>()(
  devtools((set) => ({
    teachers: [],
    loading: true,
    error: null,
    fetchTeachers: async (sessionId = "") => {
      set({ loading: true, error: null });
      try {
        const query = new URLSearchParams();
        if (sessionId.trim()) query.set("sessionId", sessionId.trim());
        const suffix = query.toString();
        const res = await fetch(`/api/teacher/all${suffix ? `?${suffix}` : ""}`, {
          credentials: "include",
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(
            data?.error ||
              data?.message ||
              `Failed to fetch teachers (${res.status})`,
          );
        }

        if (data?.success) {
          set({ teachers: data.data, loading: false });
        } else {
          throw new Error(
            data?.error || data?.message || "Failed to fetch teachers",
          );
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
