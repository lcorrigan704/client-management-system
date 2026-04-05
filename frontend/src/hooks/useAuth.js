import { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";

const useAuth = () => {
  const [user, setUser] = useState(null);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [workspaceRole, setWorkspaceRole] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    try {
      const status = await api.authStatus();
      setNeedsSetup(Boolean(status.needs_setup));
      setUser(status.user || null);
      setActiveWorkspace(status.active_workspace || null);
      setWorkspaceRole(status.workspace_role || null);
      setWorkspaces(status.workspaces || []);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (payload) => {
    const status = await api.authLogin(payload);
    setNeedsSetup(Boolean(status.needs_setup));
    setUser(status.user || null);
    setActiveWorkspace(status.active_workspace || null);
    setWorkspaceRole(status.workspace_role || null);
    setWorkspaces(status.workspaces || []);
    return status;
  }, []);

  const setup = useCallback(async (payload) => {
    const status = await api.authSetup(payload);
    setNeedsSetup(Boolean(status.needs_setup));
    setUser(status.user || null);
    setActiveWorkspace(status.active_workspace || null);
    setWorkspaceRole(status.workspace_role || null);
    setWorkspaces(status.workspaces || []);
    return status;
  }, []);

  const logout = useCallback(async () => {
    await api.authLogout();
    setUser(null);
    setActiveWorkspace(null);
    setWorkspaceRole(null);
    setWorkspaces([]);
  }, []);

  const switchWorkspace = useCallback(async (workspaceId) => {
    await api.switchWorkspace(workspaceId);
    await refreshStatus();
  }, [refreshStatus]);

  const createWorkspace = useCallback(async (payload) => {
    await api.createWorkspace(payload);
    await refreshStatus();
  }, [refreshStatus]);

  const setDefaultWorkspace = useCallback(async (workspaceId) => {
    await api.setDefaultWorkspace(workspaceId);
    await refreshStatus();
  }, [refreshStatus]);

  const updateWorkspace = useCallback(async (workspaceId, payload) => {
    await api.updateWorkspace(workspaceId, payload);
    await refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return {
    user,
    activeWorkspace,
    workspaceRole,
    workspaces,
    needsSetup,
    loading,
    login,
    setup,
    logout,
    switchWorkspace,
    createWorkspace,
    setDefaultWorkspace,
    updateWorkspace,
    refreshStatus,
  };
};

export default useAuth;
