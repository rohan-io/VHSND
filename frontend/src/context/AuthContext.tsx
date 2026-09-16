import React, { createContext, useContext, useState, useEffect } from "react";
import { UserProfile, UserRole } from "@/src/types";
import { storage } from "@/src/utils/storage";
import { apiRequest, setAuthToken, removeAuthToken, USER_KEY, getAuthToken } from "@/src/api/client";

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: (username: string, password?: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  switchDemoPersona: (role: UserRole, username: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => { throw new Error("Unimplemented"); },
  logout: async () => {},
  switchDemoPersona: async () => {},
});

export const DEMO_USERS: { role: UserRole; username: string; label: string; subLabel: string; name: string }[] = [
  {
    role: "Health Worker",
    username: "worker01",
    label: "Smruti Malla (ANM)",
    subLabel: "CHC Jajpur Sadar • Sector A (Mangarajpur, Badatrilochanpur)",
    name: "Smruti Malla (ANM)"
  },
  {
    role: "Health Worker",
    username: "worker02",
    label: "Mamata Barik (ASHA)",
    subLabel: "CHC Sukinda • Sector B (Gandhapal, Baradiha)",
    name: "Mamata Barik (ASHA)"
  },
  {
    role: "Administrator",
    username: "admin",
    label: "Dilip Acharya (Admin / CMO)",
    subLabel: "District Health Mission • Jajpur",
    name: "Dilip Acharya"
  }
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    checkSavedAuth();
  }, []);

  const checkSavedAuth = async () => {
    try {
      const savedUser = await storage.getItem<UserProfile>(USER_KEY, null);
      const token = await getAuthToken();
      if (savedUser && token) {
        setUser(savedUser);
      }
    } catch (e) {
      console.warn("Auth check error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password?: string): Promise<UserProfile> => {
    setIsLoading(true);
    try {
      const pwd = password || (username === "admin" ? "Admin@123" : "Worker@123");
      const res = await apiRequest<{ access_token: string; user: UserProfile }>("/auth/login", {
        method: "POST",
        body: { username, password: pwd },
      });

      await setAuthToken(res.access_token);
      await storage.setItem(USER_KEY, res.user);
      setUser(res.user);
      return res.user;
    } catch (err: any) {
      // Fallback local authentication for offline demo simulation
      const foundDemo = DEMO_USERS.find(d => d.username.toLowerCase() === username.toLowerCase());
      const fallbackUser: UserProfile = {
        id: username === "admin" ? "USR-ADMIN-001" : "USR-HW-001",
        username: username,
        name: foundDemo ? foundDemo.name : "Field Health Worker",
        role: (username === "admin" ? "Administrator" : "Health Worker") as UserRole,
        mobile: "9812345671",
        phc_center: "CHC Jajpur Sadar",
        sector: "Sector A",
        assigned_villages: ["Mangarajpur", "Badatrilochanpur"]
      };
      await setAuthToken("demo_offline_token");
      await storage.setItem(USER_KEY, fallbackUser);
      setUser(fallbackUser);
      return fallbackUser;
    } finally {
      setIsLoading(false);
    }
  };

  const switchDemoPersona = async (role: UserRole, username: string) => {
    return await login(username, username === "admin" ? "Admin@123" : "Worker@123");
  };

  const logout = async () => {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } catch {
      // ignore network errors
    } finally {
      await removeAuthToken();
      await storage.removeItem(USER_KEY);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, switchDemoPersona }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
