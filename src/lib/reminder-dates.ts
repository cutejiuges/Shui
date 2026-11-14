export interface DateOverride {
  date: string;
  remind: boolean;
}

// Calendar dates never pass through UTC: the Rust scheduler uses the local day.
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

export function readDateOverrides(value: unknown): DateOverride[] {
  const dates = new Map<string, DateOverride>();
  if (Array.isArray(value)) {
    for (const rule of value) {
      if (rule && typeof rule === "object" &&
          Object.keys(rule).every((key) => key === "date" || key === "remind") &&
          typeof rule.date === "string" && isCalendarDate(rule.date) &&
          typeof rule.remind === "boolean") {
        dates.set(rule.date, { date: rule.date, remind: rule.remind });
      }
    }
  }
  return [...dates.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function saveDateOverride(
  rules: DateOverride[], rule: DateOverride, editingDate?: string
): DateOverride[] {
  if (!isCalendarDate(rule.date)) throw new Error("请输入有效日期（YYYY-MM-DD）");
  if (rules.some((entry) => entry.date === rule.date && entry.date !== editingDate)) {
    throw new Error("同一天只能设置一条日期规则，请编辑已有规则");
  }
  return [...rules.filter((entry) => entry.date !== editingDate), rule]
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function deleteDateOverride(rules: DateOverride[], date: string): DateOverride[] {
  return rules.filter((entry) => entry.date !== date);
}
