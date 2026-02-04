import { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";

const useAuth = () => {
  const [user, setUser] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    try {
      const status = await api.authStatus();
      setNeedsSetup(Boolean(status.needs_setup));
      setUser(status.user || null);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (payload) => {
    const status = await api.authLogin(payload);
    setNeedsSetup(Boolean(status.needs_setup));
    setUser(status.user || null);
    return status;
  }, []);

  const setup = useCallback(async (payload) => {
    const status = await api.authSetup(payload);
    setNeedsSetup(Boolean(status.needs_setup));
    setUser(status.user || null);
    return status;
  }, []);

  const logout = useCallback(async () => {
    await api.authLogout();
    setUser(null);
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return {
    user,
    needsSetup,
    loading,
    login,
    setup,
    logout,
    refreshStatus,
  };
};

export default useAuth;
