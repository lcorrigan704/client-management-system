import { useCallback } from "react";
import { api } from "@/api/client";
import { defaultSettings } from "@/constants/defaults";

const useSettings = ({ settings, setSettings, onSuccess, onError } = {}) => {
  const updateSettings = useCallback(
    (patch) => {
      setSettings((prev) => ({ ...defaultSettings, ...(prev || {}), ...patch }));
    },
    [setSettings]
  );

  const saveSettings = useCallback(async () => {
    try {
      const response = await api.saveSettings(settings);
      setSettings(response);
      if (onSuccess) onSuccess("Settings saved.");
    } catch (error) {
      if (onError) onError(error);
    }
  }, [onError, onSuccess, setSettings, settings]);

  return { updateSettings, saveSettings };
};

export default useSettings;
