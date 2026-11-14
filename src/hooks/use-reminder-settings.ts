import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { DateOverride, readDateOverrides } from "@/lib/reminder-dates";

export interface ReminderConfig {
  gold: string;
  gap: string;
  weekdays: number[];
  timeStart: string;
  timeEnd: string;
  whitelist_apps: string[];
  dateOverrides: DateOverride[];
}

export interface ScheduleStatus {
  day: {
    date: string;
    remind: boolean;
    reason: "extra_workday" | "day_off" | "weekly_workday" | "weekly_day_off";
  };
  in_time_range: boolean;
  goal_reached: boolean;
}

interface SettingsResponse {
  config: Partial<ReminderConfig>;
  status: ScheduleStatus;
}

const defaults: ReminderConfig = {
  gold: "1000", gap: "20", weekdays: [], timeStart: "09:00", timeEnd: "18:00",
  whitelist_apps: [], dateOverrides: [],
};

function readConfig(value: Partial<ReminderConfig>): ReminderConfig {
  return {
    gold: typeof value.gold === "string" ? value.gold : defaults.gold,
    gap: typeof value.gap === "string" ? value.gap : defaults.gap,
    timeStart: typeof value.timeStart === "string" ? value.timeStart : defaults.timeStart,
    timeEnd: typeof value.timeEnd === "string" ? value.timeEnd : defaults.timeEnd,
    weekdays: Array.isArray(value.weekdays) ? value.weekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6) : [],
    whitelist_apps: Array.isArray(value.whitelist_apps) ? value.whitelist_apps.filter((app) => typeof app === "string") : [],
    dateOverrides: readDateOverrides(value.dateOverrides),
  };
}

export function useReminderSettings() {
  const [config, setConfig] = useState(defaults);
  const [status, setStatus] = useState<ScheduleStatus | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const writing = useRef(false);
  const revision = useRef(0);

  const loadConfig = useCallback(async () => {
    try {
      const response = await invoke<SettingsResponse>("get_reminder_settings");
      setConfig(readConfig(response.config));
      setStatus(response.status);
      setLoadError("");
      setReady(true);
    } catch (error) {
      setLoadError(`加载提醒设置失败：${String(error)}`);
    }
  }, []);

  useEffect(() => { void loadConfig(); }, [loadConfig]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (writing.current) return;
      const version = revision.current;
      try {
        const next = await invoke<ScheduleStatus>("get_reminder_schedule_status");
        if (active && version === revision.current) setStatus(next);
      } catch (error) {
        console.error("刷新今日提醒状态失败", error);
      }
    };
    // Recheck after midnight, timezone changes and restoring a hidden window.
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const savePatch = async (patch: Partial<ReminderConfig>): Promise<boolean> => {
    if (writing.current || !ready) return false;
    writing.current = true;
    revision.current += 1;
    setSaving(true);
    try {
      const response = await invoke<SettingsResponse>("update_reminder_settings", { patch });
      setConfig(readConfig(response.config));
      setStatus(response.status);
      return true;
    } catch (error) {
      toast.error(`保存提醒设置失败：${String(error)}`);
      return false;
    } finally {
      writing.current = false;
      setSaving(false);
    }
  };

  return { config, status, ready, saving, loadError, loadConfig, savePatch };
}
