import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface User {
  id: string | null;
  fullName: string;
  username: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  roles: string[];
}



interface UserState {
  user: User | null;
  authChecked: boolean;
  setUser: (user: User | null) => void;
  setAuthChecked: (checked: boolean) => void;
  clearUser: () => void;
  updateUser: (user: Partial<User>) => void;
}

const useUserStore = create<UserState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        authChecked: false,
        setUser: (user) => set({ user }),
        setAuthChecked: (authChecked) => set({ authChecked }),
        clearUser: () => set({ user: null }),
        updateUser: (user) =>
          set((state) => ({
            user: state.user ? { ...state.user, ...user } : null,
          })),
      }),
      { name: "user-store" },
    ),
  ),
);

export default useUserStore;
