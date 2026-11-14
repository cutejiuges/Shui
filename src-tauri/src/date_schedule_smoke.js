// Compiled only into the isolated native-smoke build. Exercise the real React
// forms and production IPC in WebKit/WebView2, without a browser test dependency.
(async () => {
  const checks = [];
  const invoke = (command, args) => window.__TAURI_INTERNALS__.invoke(command, args);
  const report = (result) => invoke("plugin:event|emit", {
    event: "native-smoke-report", payload: { kind: "date-schedule", ...result, checks },
  });
  const assert = (condition, description) => {
    if (!condition) throw new Error(description);
    checks.push(description);
  };
  const wait = async (predicate, description) => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (await predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out: ${description}`);
  };
  const ready = () => document.querySelector('[data-reminder-settings-ready="true"]');
  const get = () => invoke("get_reminder_settings");
  const button = (label) => document.querySelector(`[aria-label="${label}"]`);
  const fill = (label, value) => {
    const element = button(label);
    if (!element) throw new Error(`Missing control: ${label}`);
    const prototype = element.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const submit = () => document.querySelector('form[aria-label="日期规则"] button[type="submit"]').click();
  const saved = async (predicate, description) => {
    await wait(async () => ready() && predicate(await get()), description);
    // Wait for the UI response as well as the persistent backend write.
    await wait(() => ready(), description);
  };
  try {
    await invoke("update_reminder_settings", { patch: {
      weekdays: [], dateOverrides: [], gap: "20", timeStart: "00:00", timeEnd: "00:00",
    } });
    document.querySelector('a[href="/setting/reminder/"]').click();
    await wait(() => ready(), "reminder settings load");
    const today = (await get()).status.day.date;
    const other = today === "2099-01-02" ? "2099-01-03" : "2099-01-02";
    assert(document.querySelector('[data-schedule-remind="false"]')?.textContent.includes("未设置星期提醒"),
      "the native settings page explains today's weekly fallback");

    fill("规则日期", today);
    fill("日期安排", "workday");
    submit();
    await saved((s) => s.config.dateOverrides.length === 1 && s.status.day.reason === "extra_workday",
      "add extra workday");
    await wait(() => document.querySelector('[data-schedule-remind="true"]'), "today UI reflects extra workday");
    assert(document.querySelector(`[data-rule-date="${today}"]`)?.textContent.includes("补班日"),
      "adding an extra workday through the form overrides an unselected weekday");

    submit();
    await wait(() => document.querySelector('[role="alert"]')?.textContent.includes("同一天"), "duplicate date validation");
    assert((await get()).config.dateOverrides.length === 1, "duplicate dates are rejected without overwriting a saved rule");

    button(`编辑 ${today}`).click();
    fill("日期安排", "day-off");
    submit();
    await saved((s) => s.status.day.reason === "day_off", "edit rule type");
    assert(!(await get()).status.day.remind, "editing a rule changes today's schedule to a day off");

    button(`编辑 ${today}`).click();
    fill("规则日期", other);
    [...document.querySelectorAll('form[aria-label="日期规则"] button')].find((b) => b.textContent === "取消").click();
    assert((await get()).config.dateOverrides[0].date === today, "canceling an edit preserves the saved date");

    button(`编辑 ${today}`).click();
    fill("规则日期", other);
    submit();
    await saved((s) => s.config.dateOverrides[0].date === other && s.status.day.reason === "weekly_day_off", "move rule date");
    assert((await get()).status.day.reason === "weekly_day_off", "moving a date rule restores the original day's weekly fallback");
    button(`删除 ${other}`).click();
    await saved((s) => s.config.dateOverrides.length === 0, "delete date rule");
    assert(!document.querySelector('[data-rule-date]'), "deleting a date rule removes its native settings row");

    const day = new Date(`${today}T12:00:00`).getDay();
    const weekdayLabel = `星期${["日", "一", "二", "三", "四", "五", "六"][day]}`;
    button(weekdayLabel).click();
    await saved((s) => s.status.day.reason === "weekly_workday", "enable weekday");
    fill("规则日期", today);
    fill("日期安排", "day-off");
    submit();
    await saved((s) => s.status.day.reason === "day_off", "day off overrides weekly schedule");
    assert(!(await get()).status.day.remind, "a day off overrides a selected weekday");
    button(`删除 ${today}`).click();
    await saved((s) => s.status.day.reason === "weekly_workday", "delete day off");
    assert((await get()).status.day.remind, "deleting a day off restores the selected weekly schedule");
    submit();
    await saved((s) => s.status.day.reason === "day_off", "recreate day off");

    const before = (await get()).config;
    for (const rules of [
      [{ date: "2027-02-29", remind: true }],
      [{ date: today, remind: true }, { date: today, remind: false }],
    ]) {
      let rejected = false;
      try { await invoke("update_reminder_settings", { patch: { dateOverrides: rules } }); }
      catch (_) { rejected = true; }
      assert(rejected && JSON.stringify((await get()).config) === JSON.stringify(before),
        "production IPC rejects invalid or duplicate date rules without modifying settings");
    }
    await invoke("update_reminder_settings", { patch: { gap: "30" } });
    assert(JSON.stringify((await get()).config.dateOverrides) === JSON.stringify(before.dateOverrides),
      "an unrelated settings save preserves date rules");
    await report({ passed: true, today });
  } catch (error) {
    await report({ passed: false, error: String(error) });
  }
})();
