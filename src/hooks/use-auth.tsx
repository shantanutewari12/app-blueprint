import { createContext, useContext, type ReactNode } from "react";

interface AuthContextValue {
  user: null;
  session: null;
  loading: false;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const signOut = async () => {
    // No-op
  };

  return (
    <AuthContext.Provider value={{ user: null, session: null, loading: false, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
