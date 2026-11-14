"""#33 scenarios shared by all three native CI runners."""
import time


def run(application, check):
    application.action("date-settings")
    state = application.wait(lambda s: s["date_checks"] is not None,
                             "date settings CRUD in the real WebView", timeout=120)
    result = state["date_checks"]
    assert result["passed"], result
    for description in result["checks"]:
        check(description, True)
    today = result["today"]
    application.action("close")
    application.wait(lambda s: not s["main"]["visible"], "settings hide after schedule editing")
    application.action("remind")
    application.wait(lambda s: s["timer_running"] and s["schedule"]["reason"] == "day_off"
                     and not s["should_run_timer"], "day off blocks the native timer")
    deadline = time.monotonic() + 3
    while time.monotonic() < deadline:
        state = application.wait(lambda s: True, "day off remains quiet")
        assert not state["session"] and not state["visible_reminders"], state
        time.sleep(0.1)
    check("a day off suppresses the real zero-interval timer across multiple polling cycles", True)

    application.action("finish-reminder")  # Restore the normal interval before enabling a date.
    application.wait(lambda s: s["alert"]["gap"] == "20" and s["timer_running"], "reset interval")
    application.action("date-workday")
    application.wait(lambda s: s["schedule"]["reason"] == "extra_workday" and s["should_run_timer"],
                     "extra workday enables the timer on an unselected weekday")
    application.action("remind")
    application.wait(lambda s: s["session"] and s["visible_reminders"] and s["reminder_loaded"],
                     "extra workday triggers a native reminder")
    check("an extra workday triggers the real native reminder while settings stay hidden",
          not application.state["main"]["visible"])
    application.action("finish-reminder")
    application.wait(lambda s: not s["session"] and not s["visible_reminders"] and s["timer_running"],
                     "date reminder cleanup")
    return today


def verify_restart(application, today, check):
    application.wait(lambda s: s["schedule"]["date"] == today and s["should_run_timer"],
                     "date schedule after native restart")
    check("date rules persist across a cold restart and still override the weekly schedule",
          application.state["alert"]["weekdays"] == []
          and application.state["alert"]["dateOverrides"] == [{"date": today, "remind": True}]
          and application.state["schedule"]["reason"] == "extra_workday")
