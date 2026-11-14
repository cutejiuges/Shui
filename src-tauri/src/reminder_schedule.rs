//! Local calendar exceptions override the weekly schedule, never the other timer gates.
use chrono::{Datelike, NaiveDate, NaiveTime};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{collections::BTreeMap, sync::Mutex};
use tauri_plugin_store::StoreExt;

use crate::core::store::settings::{config_store_category, store_files, AppSettings};

static SETTINGS_WRITE: Mutex<()> = Mutex::new(());

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct DateOverride {
    pub date: String,
    pub remind: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ScheduleReason {
    ExtraWorkday,
    DayOff,
    WeeklyWorkday,
    WeeklyDayOff,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DaySchedule {
    pub date: String,
    pub remind: bool,
    pub reason: ScheduleReason,
}

fn valid_date(value: &str) -> bool {
    if value.len() != 10 {
        return false;
    }
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map(|date| date.year() >= 1 && date.format("%Y-%m-%d").to_string() == value)
        .unwrap_or(false)
}

/// Ignore damaged entries in old/manually edited files. Valid duplicate dates use
/// the last entry; new writes reject duplicates instead of guessing user intent.
pub fn read_date_overrides(value: Option<&Value>) -> Vec<DateOverride> {
    let mut dates = BTreeMap::new();
    if let Some(entries) = value.and_then(Value::as_array) {
        for entry in entries {
            if let Ok(rule) = serde_json::from_value::<DateOverride>(entry.clone()) {
                if valid_date(&rule.date) {
                    dates.insert(rule.date.clone(), rule);
                }
            }
        }
    }
    dates.into_values().collect()
}

pub fn day_schedule(date: NaiveDate, weekdays: &[u64], overrides: &[DateOverride]) -> DaySchedule {
    let date_string = date.format("%Y-%m-%d").to_string();
    let exception = overrides.iter().rev().find(|rule| rule.date == date_string);
    let (remind, reason) = match exception {
        Some(rule) if rule.remind => (true, ScheduleReason::ExtraWorkday),
        Some(_) => (false, ScheduleReason::DayOff),
        None if weekdays.contains(&(date.weekday().num_days_from_sunday() as u64)) => {
            (true, ScheduleReason::WeeklyWorkday)
        }
        None => (false, ScheduleReason::WeeklyDayOff),
    };
    DaySchedule {
        date: date_string,
        remind,
        reason,
    }
}

impl DaySchedule {
    pub fn reason_text(&self) -> &'static str {
        match self.reason {
            ScheduleReason::ExtraWorkday => "补班日，按设定时段提醒",
            ScheduleReason::DayOff => "休假日，今天不提醒",
            ScheduleReason::WeeklyWorkday => "按星期规则提醒",
            ScheduleReason::WeeklyDayOff => "今天未设置星期提醒",
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ScheduleStatus {
    pub day: DaySchedule,
    pub in_time_range: bool,
    pub goal_reached: bool,
}

#[derive(Serialize)]
pub struct ReminderSettingsResponse {
    config: Value,
    status: ScheduleStatus,
}

#[tauri::command]
pub fn get_reminder_schedule_status(app_handle: tauri::AppHandle) -> ScheduleStatus {
    let settings = AppSettings::load_from_store::<tauri::Wry>(&app_handle);
    ScheduleStatus {
        day: settings.schedule,
        in_time_range: settings.is_in_time_range,
        goal_reached: settings.today_drink_amount >= settings.gold,
    }
}

#[tauri::command]
pub fn get_reminder_settings(
    app_handle: tauri::AppHandle,
) -> Result<ReminderSettingsResponse, String> {
    let status = get_reminder_schedule_status(app_handle.clone());
    let store = app_handle
        .store(store_files::CONFIG)
        .map_err(|e| e.to_string())?;
    let mut config = store
        .get(config_store_category::ALERT)
        .filter(Value::is_object)
        .unwrap_or_else(|| json!({}));
    config["dateOverrides"] = json!(read_date_overrides(config.get("dateOverrides")));
    Ok(ReminderSettingsResponse { config, status })
}

/// Validate before touching the store. Merge only changed fields so an unrelated
/// settings write cannot erase a date exception or another newly added field.
fn merge_patch(existing: &Value, patch: Value) -> Result<Value, String> {
    let fields = patch.as_object().ok_or("提醒设置必须是对象")?;
    let mut merged = existing.as_object().cloned().unwrap_or_default();
    for (field, value) in fields {
        let normalized = match field.as_str() {
            "dateOverrides" => {
                let mut rules: Vec<DateOverride> =
                    serde_json::from_value(value.clone()).map_err(|_| "日期规则格式无效")?;
                let mut seen = std::collections::BTreeSet::new();
                for rule in &rules {
                    if !valid_date(&rule.date) {
                        return Err("请输入有效日期（YYYY-MM-DD）".into());
                    }
                    if !seen.insert(&rule.date) {
                        return Err("同一天只能设置一条日期规则".into());
                    }
                }
                rules.sort_by(|a, b| a.date.cmp(&b.date));
                json!(rules)
            }
            "weekdays" => {
                let mut days: Vec<u64> =
                    serde_json::from_value(value.clone()).map_err(|_| "星期设置无效")?;
                if days.iter().any(|day| *day > 6) {
                    return Err("星期必须在 0 到 6 之间".into());
                }
                days.sort_unstable();
                days.dedup();
                json!(days)
            }
            "gold" | "gap" => {
                let number = value
                    .as_str()
                    .and_then(|s| s.parse::<u64>().ok())
                    .filter(|n| *n > 0 && (field != "gap" || *n <= u64::MAX / 60))
                    .ok_or("目标和提醒间隔必须是正整数")?;
                json!(number.to_string())
            }
            "timeStart" | "timeEnd" => {
                let text = value.as_str().ok_or("提醒时段格式无效")?;
                if !NaiveTime::parse_from_str(text, "%H:%M")
                    .map(|time| time.format("%H:%M").to_string() == text)
                    .unwrap_or(false)
                {
                    return Err("提醒时段格式无效".into());
                }
                value.clone()
            }
            "whitelist_apps" => {
                let apps: Vec<String> =
                    serde_json::from_value(value.clone()).map_err(|_| "应用白名单格式无效")?;
                json!(apps)
            }
            _ => return Err(format!("未知提醒设置：{field}")),
        };
        merged.insert(field.clone(), normalized);
    }
    if fields.contains_key("timeStart") || fields.contains_key("timeEnd") {
        let start = merged
            .get("timeStart")
            .and_then(Value::as_str)
            .unwrap_or("09:00");
        let end = merged
            .get("timeEnd")
            .and_then(Value::as_str)
            .unwrap_or("18:00");
        if end != "00:00" && start >= end {
            return Err("结束时间必须晚于开始时间".into());
        }
    }
    Ok(Value::Object(merged))
}

#[tauri::command]
pub fn update_reminder_settings(
    app_handle: tauri::AppHandle,
    patch: Value,
) -> Result<ReminderSettingsResponse, String> {
    let _write = SETTINGS_WRITE.lock().map_err(|_| "无法保存提醒设置")?;
    let store = app_handle
        .store(store_files::CONFIG)
        .map_err(|e| e.to_string())?;
    let previous = store
        .get(config_store_category::ALERT)
        .unwrap_or_else(|| json!({}));
    let merged = merge_patch(&previous, patch)?;
    store.set(config_store_category::ALERT, merged);
    if let Err(error) = store.save() {
        store.set(config_store_category::ALERT, previous);
        return Err(format!("保存提醒设置失败：{error}"));
    }
    crate::commands::reset_timer();
    get_reminder_settings(app_handle)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn date(value: &str) -> NaiveDate {
        NaiveDate::parse_from_str(value, "%Y-%m-%d").unwrap()
    }
    fn rule(value: &str, remind: bool) -> DateOverride {
        DateOverride {
            date: value.into(),
            remind,
        }
    }

    #[test]
    fn legacy_weekly_schedule_and_sunday_numbering_are_preserved() {
        assert_eq!(
            day_schedule(date("2026-11-16"), &[1, 2, 3, 4, 5], &[]).reason,
            ScheduleReason::WeeklyWorkday
        );
        assert_eq!(
            day_schedule(date("2026-11-15"), &[1, 2, 3, 4, 5], &[]).reason,
            ScheduleReason::WeeklyDayOff
        );
        assert!(day_schedule(date("2026-11-15"), &[0], &[]).remind);
        assert!(!day_schedule(date("2026-11-16"), &[], &[]).remind);
    }

    #[test]
    fn extra_workday_overrides_an_unselected_weekend() {
        let schedule = day_schedule(date("2026-11-14"), &[], &[rule("2026-11-14", true)]);
        assert!(schedule.remind);
        assert_eq!(schedule.reason, ScheduleReason::ExtraWorkday);
    }

    #[test]
    fn day_off_overrides_a_selected_weekday_and_expires_the_next_day() {
        let rules = [rule("2026-11-16", false)];
        let schedule = day_schedule(date("2026-11-16"), &[1, 2], &rules);
        assert!(!schedule.remind);
        assert_eq!(schedule.reason, ScheduleReason::DayOff);
        assert_eq!(
            day_schedule(date("2026-11-17"), &[1, 2], &rules).reason,
            ScheduleReason::WeeklyWorkday
        );
    }

    #[test]
    fn exceptions_match_calendar_days_across_year_and_leap_day_boundaries() {
        let rules = [rule("2028-02-29", true), rule("2026-12-31", false)];
        assert!(day_schedule(date("2028-02-29"), &[], &rules).remind);
        assert!(!day_schedule(date("2028-03-01"), &[], &rules).remind);
        assert!(!day_schedule(date("2026-12-31"), &[0, 1, 2, 3, 4, 5, 6], &rules).remind);
        assert!(day_schedule(date("2027-01-01"), &[0, 1, 2, 3, 4, 5, 6], &rules).remind);
    }

    #[test]
    fn invalid_or_missing_saved_entries_do_not_break_the_weekly_schedule() {
        for value in [
            None,
            Some(json!(null)),
            Some(json!({})),
            Some(json!([
                {"date":"2027-02-29", "remind":false},
                {"date":"2026-11-16", "remind":"false"},
                {"date":"2026-11-16", "remind":false, "extra":true}
            ])),
        ] {
            let rules = read_date_overrides(value.as_ref());
            assert!(rules.is_empty());
            assert!(day_schedule(date("2026-11-16"), &[1], &rules).remind);
        }
        assert_eq!(
            read_date_overrides(Some(&json!([
                {"date":"2026-11-16", "remind":false},
                {"date":"2026-11-16", "remind":true}
            ]))),
            vec![rule("2026-11-16", true)]
        );
    }

    #[test]
    fn saves_reject_impossible_noncanonical_and_duplicate_dates() {
        for invalid in [
            "2027-02-29",
            "2026-04-31",
            "2026-2-03",
            "0000-01-01",
            "2026-11-14T00:00:00Z",
            "10000-01-01",
        ] {
            assert!(
                merge_patch(
                    &json!({}),
                    json!({"dateOverrides":[{"date":invalid,"remind":true}]})
                )
                .is_err(),
                "{invalid}"
            );
        }
        assert!(merge_patch(
            &json!({}),
            json!({"dateOverrides":[
                {"date":"2026-11-16","remind":true}, {"date":"2026-11-16","remind":false}
            ]})
        )
        .is_err());
        assert!(merge_patch(
            &json!({}),
            json!({"dateOverrides":[{"date":"2026-11-16","remind":"true"}]})
        )
        .is_err());
    }

    #[test]
    fn create_edit_delete_and_unrelated_patches_preserve_existing_settings() {
        let existing = json!({"weekdays":[1,2,3,4,5],"gap":"20","futureSetting":true});
        let created = merge_patch(
            &existing,
            json!({"dateOverrides":[
                {"date":"2028-02-29","remind":true}, {"date":"2026-11-16","remind":false}
            ]}),
        )
        .unwrap();
        assert_eq!(created["dateOverrides"][0]["date"], "2026-11-16");
        let updated = merge_patch(&created, json!({"gap":"30"})).unwrap();
        assert_eq!(updated["dateOverrides"], created["dateOverrides"]);
        assert_eq!(updated["futureSetting"], true);
        let edited = merge_patch(
            &updated,
            json!({"dateOverrides":[{"date":"2026-11-17","remind":true}]}),
        )
        .unwrap();
        assert_eq!(edited["weekdays"], existing["weekdays"]);
        let deleted = merge_patch(&edited, json!({"dateOverrides":[]})).unwrap();
        assert_eq!(deleted["dateOverrides"], json!([]));
        assert_eq!(deleted["gap"], "30");
    }

    #[test]
    fn patch_validation_prevents_invalid_timer_settings_and_supports_atomic_time_changes() {
        for patch in [
            json!({"weekdays":[7]}),
            json!({"gap":"0"}),
            json!({"gap":"18446744073709551615"}),
            json!({"gold":0}),
            json!({"unknown":true}),
            json!({"timeStart":"25:00"}),
        ] {
            assert!(merge_patch(&json!({}), patch).is_err());
        }
        let existing = json!({"timeStart":"09:00", "timeEnd":"18:00"});
        assert!(merge_patch(&existing, json!({"timeStart":"18:00"})).is_err());
        assert!(merge_patch(&existing, json!({"timeStart":"18:00","timeEnd":"18:30"})).is_ok());
        assert!(merge_patch(&existing, json!({"timeStart":"23:30","timeEnd":"00:00"})).is_ok());
    }
}
