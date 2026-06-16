import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { setTokenGetter } from "@/services/api";

interface AuthContextValue {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  isLoaded: false,
  isSignedIn: false,
  userId: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken } = useClerkAuth();

  // Wire Clerk's getToken into the Axios interceptor once
  useEffect(() => {
    setTokenGetter(() => getToken());
  }, [getToken]);

  return (
    <AuthContext.Provider
      value={{
        isLoaded,
        isSignedIn: !!isSignedIn,
        userId: userId ?? null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
