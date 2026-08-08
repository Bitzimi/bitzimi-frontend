/**
 * useFeatureToggle — reads and controls a named feature flag.
 *
 * Uses the admin config API to read the current value and provides
 * a toggle function to flip it.
 *
 * Usage:
 *   const { enabled, toggle, loading } = useFeatureToggle("bank_deposits");
 */
import { useState, useEffect, useCallback } from "react";
import { adminConfigService } from "../services/adminConfigService";

export interface FeatureToggleState {
  enabled:  boolean;
  loading:  boolean;
  toggling: boolean;
  toggle:   () => Promise<void>;
  reload:   () => Promise<void>;
}

export function useFeatureToggle(featureName: string, defaultValue = true): FeatureToggleState {
  const [enabled,  setEnabled]  = useState(defaultValue);
  const [loading,  setLoading]  = useState(true);
  const [toggling, setToggling] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const val = await adminConfigService.isFeatureEnabled(featureName, defaultValue);
    setEnabled(val);
    setLoading(false);
  }, [featureName, defaultValue]);

  useEffect(() => { reload(); }, [reload]);

  const toggle = useCallback(async () => {
    setToggling(true);
    const newValue = !enabled;
    const ok = await adminConfigService.setFeature(featureName, newValue);
    if (ok) setEnabled(newValue);
    setToggling(false);
  }, [featureName, enabled]);

  return { enabled, loading, toggling, toggle, reload };
}

/**
 * useMaintenanceMode — reads and controls the global maintenance mode flag.
 */
export interface MaintenanceModeState {
  enabled:  boolean;
  loading:  boolean;
  toggling: boolean;
  setEnabled: (on: boolean, message?: string) => Promise<void>;
  reload:   () => Promise<void>;
}

export function useMaintenanceMode(): MaintenanceModeState {
  const [enabled,  setEnabled]  = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [toggling, setToggling] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const val = await adminConfigService.isMaintenanceEnabled();
    setEnabled(val);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const set = useCallback(async (on: boolean, message?: string) => {
    setToggling(true);
    const ok = await adminConfigService.setMaintenance(on, message);
    if (ok) setEnabled(on);
    setToggling(false);
  }, []);

  return { enabled, loading, toggling, setEnabled: set, reload };
}
