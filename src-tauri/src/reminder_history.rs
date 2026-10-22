use chrono::Local;
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use tauri_plugin_store::StoreExt;

pub const STORE: &str = "reminder_history_store.json";

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Outcome {
    Confirmed,
    Skipped,
    TimedOut,
}

#[derive(Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct DaySummary {
    completed: u64,
    confirmed: u64,
    skipped: u64,
    timed_out: u64,
    display_seconds: u64,
}

impl DaySummary {
    fn record(&mut self, outcome: Outcome, duration: Duration) {
        self.completed += 1;
        match outcome {
            Outcome::Confirmed => self.confirmed += 1,
            Outcome::Skipped => self.skipped += 1,
            Outcome::TimedOut => self.timed_out += 1,
        }
        // A suspended machine must not turn a 30-second reminder into hours of rest.
        self.display_seconds += duration.as_secs().min(30);
    }
}

pub struct Session {
    day: String,
    started: Instant,
}

#[derive(Default)]
pub struct Tracker {
    active: Option<Session>,
}

impl Tracker {
    pub fn token(&self) -> Option<Instant> {
        self.active.as_ref().map(|session| session.started)
    }

    pub fn begin(&mut self) -> bool {
        if self.active.is_some() {
            return false;
        }
        self.active = Some(Session {
            day: Local::now().format("%Y%m%d").to_string(),
            started: Instant::now(),
        });
        true
    }

    pub fn finish(&mut self, app: &tauri::AppHandle, outcome: Outcome) {
        let Some(session) = self.active.take() else {
            return;
        };
        let result = (|| -> Result<(), String> {
            let store = app.store(STORE).map_err(|e| e.to_string())?;
            let mut day: DaySummary = match store.get(&session.day) {
                Some(value) => serde_json::from_value(value).map_err(|e| e.to_string())?,
                None => DaySummary::default(),
            };
            day.record(outcome, session.started.elapsed());
            store.set(
                session.day,
                serde_json::to_value(day).map_err(|e| e.to_string())?,
            );
            store.save().map_err(|e| e.to_string())
        })();
        if let Err(error) = result {
            // Statistics failure must never prevent closing or restarting the timer.
            eprintln!("保存提醒统计失败: {error}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn outcomes_and_duration_are_accumulated() {
        let mut day = DaySummary::default();
        day.record(Outcome::Confirmed, Duration::from_secs(12));
        day.record(Outcome::Skipped, Duration::from_secs(3));
        day.record(Outcome::TimedOut, Duration::from_secs(30));
        assert_eq!(
            (day.completed, day.confirmed, day.skipped, day.timed_out),
            (3, 1, 1, 1)
        );
        assert_eq!(day.display_seconds, 45);
        let restored: DaySummary =
            serde_json::from_value(serde_json::to_value(day).unwrap()).unwrap();
        assert_eq!(restored.display_seconds, 45);
    }

    #[test]
    fn suspended_time_is_capped() {
        let mut day = DaySummary::default();
        day.record(Outcome::TimedOut, Duration::from_secs(7200));
        assert_eq!(day.display_seconds, 30);
    }

    #[test]
    fn multiple_windows_share_one_session() {
        let mut tracker = Tracker::default();
        assert!(tracker.begin());
        let first_token = tracker.token();
        assert!(!tracker.begin());
        assert_eq!(tracker.token(), first_token);
        assert!(tracker.active.take().is_some());
        assert!(tracker.active.take().is_none());
        assert_eq!(tracker.token(), None);
        assert!(tracker.begin());
        assert_ne!(tracker.token(), first_token);
    }

    #[test]
    fn closing_after_midnight_keeps_start_date() {
        let mut tracker = Tracker {
            active: Some(Session {
                day: "20261022".into(),
                started: Instant::now(),
            }),
        };
        let ended = tracker.active.take().unwrap();
        assert_eq!(ended.day, "20261022");
    }
}
