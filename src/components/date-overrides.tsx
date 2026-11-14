import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateOverride, deleteDateOverride, saveDateOverride } from "@/lib/reminder-dates";
import { ScheduleStatus } from "@/hooks/use-reminder-settings";

const reasons = {
  extra_workday: "补班日，覆盖星期规则",
  day_off: "休假日，覆盖星期规则",
  weekly_workday: "按星期规则提醒",
  weekly_day_off: "今天未设置星期提醒",
};

export function DateOverrides({ rules, status, onSave }: {
  rules: DateOverride[];
  status: ScheduleStatus;
  onSave: (rules: DateOverride[]) => Promise<boolean>;
}) {
  const [date, setDate] = useState(status.day.date);
  const [remind, setRemind] = useState(false);
  const [editingDate, setEditingDate] = useState<string>();
  const [error, setError] = useState("");

  const reset = () => {
    setDate(status.day.date);
    setRemind(false);
    setEditingDate(undefined);
    setError("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const next = saveDateOverride(rules, { date, remind }, editingDate);
      if (await onSave(next)) reset();
    } catch (error) {
      setError((error as Error).message);
    }
  };

  return (
    <section aria-labelledby="date-overrides-title" className="rounded-lg border p-3 shadow-xs mb-4">
      <h4 id="date-overrides-title" className="text-sm font-medium">日期提醒</h4>
      <p className="text-[0.8rem] text-muted-foreground mt-1">
        补班日提醒，休假日不提醒；指定日期优先于星期规则。
      </p>
      <p className="text-[0.8rem] text-muted-foreground">
        提醒仍遵循时间范围、每日目标和暂停设置。
      </p>
      <div role="status" data-schedule-today={status.day.date} data-schedule-remind={String(status.day.remind)}
        className="rounded-md bg-muted p-2 my-3 text-sm">
        <p className="font-medium">今日（{status.day.date}）计划：{status.day.remind ? "提醒" : "不提醒"}</p>
        <p className="text-xs text-muted-foreground">{reasons[status.day.reason]}</p>
        {status.day.remind && (status.goal_reached || !status.in_time_range) && (
          <p className="text-xs text-muted-foreground">
            {status.goal_reached ? "今日目标已完成，停止定时提醒" : "当前不在提醒时段"}
          </p>
        )}
      </div>
      <form onSubmit={submit} className="space-y-2" aria-label="日期规则">
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-xs space-y-1 min-w-0 flex-1">
            <span>日期</span>
            <Input type="date" aria-label="规则日期" value={date} min="0001-01-01" max="9999-12-31"
              required onChange={(event) => { setDate(event.target.value); setError(""); }} />
          </label>
          <label className="text-xs space-y-1">
            <span>安排</span>
            <select aria-label="日期安排" value={remind ? "workday" : "day-off"}
              onChange={(event) => setRemind(event.target.value === "workday")}
              className="block h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="day-off">休假日</option>
              <option value="workday">补班日</option>
            </select>
          </label>
          <Button type="submit" size="sm" className="h-9">{editingDate ? "保存修改" : "添加日期"}</Button>
          {editingDate && <Button type="button" variant="outline" size="sm" className="h-9" onClick={reset}>取消</Button>}
        </div>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </form>
      {rules.length === 0 ? (
        <p className="text-xs text-muted-foreground mt-3">暂无指定日期，按星期规则提醒。</p>
      ) : (
        <ul className="mt-3 divide-y" aria-label="已设置的日期">
          {rules.map((rule) => (
            <li key={rule.date} data-rule-date={rule.date} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>{rule.date} · {rule.remind ? "补班日 · 提醒" : "休假日 · 不提醒"}</span>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" aria-label={`编辑 ${rule.date}`}
                  onClick={() => { setDate(rule.date); setRemind(rule.remind); setEditingDate(rule.date); setError(""); }}>编辑</Button>
                <Button type="button" variant="ghost" size="sm" aria-label={`删除 ${rule.date}`}
                  onClick={async () => {
                    if (await onSave(deleteDateOverride(rules, rule.date)) && editingDate === rule.date) reset();
                  }}>删除</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
