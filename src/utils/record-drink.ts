import { invoke } from "@tauri-apps/api/core";

export interface DrinkReceipt {
  date: string;
  total: number;
  goal: number;
  added: boolean;
  goalReached: boolean;
}

export function recordDrink(amount: number, requestId: string, reminderSession?: string) {
  return invoke<DrinkReceipt>("record_drink", {
    amount, requestId, reminderSession: reminderSession ?? null,
  });
}
