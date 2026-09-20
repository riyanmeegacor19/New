import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { api, AuthResp, TOKEN_KEY, UserT } from "@/src/api";
import { storage } from "@/src/utils/storage";

type AuthState = {
  user: UserT | null;
  hydrated: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: UserT) => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<UserT | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    (async () => {
      const token = await storage.secureGet<string>(TOKEN_KEY, "");
      if (token) {
        try {
          const me = await api<UserT>("/auth/me");
          setUserState(me);
        } catch {
          await storage.secureRemove(TOKEN_KEY);
        }
      }
      setHydrated(true);
    })();
  }, []);

  const applyAuth = useCallback(async (resp: AuthResp) => {
    await storage.secureSet(TOKEN_KEY, resp.access_token);
    setUserState(resp.user);
  }, []);

  const signIn = useCallback(
    async (username: string, password: string) => {
      const resp = await api<AuthResp>("/auth/login", {
        method: "POST",
        json: { username, password },
      });
      await applyAuth(resp);
    },
    [applyAuth],
  );

  const signUp = useCallback(
    async (username: string, password: string) => {
      const resp = await api<AuthResp>("/auth/register", {
        method: "POST",
        json: { username, password },
      });
      await applyAuth(resp);
    },
    [applyAuth],
  );

  const signOut = useCallback(async () => {
    await storage.secureRemove(TOKEN_KEY);
    setUserState(null);
    qc.clear();
    router.replace("/login");
  }, [qc, router]);

  const refresh = useCallback(async () => {
    try {
      const me = await api<UserT>("/auth/me");
      setUserState(me);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(
    () => ({ user, hydrated, signIn, signUp, signOut, setUser: setUserState, refresh }),
    [user, hydrated, signIn, signUp, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
