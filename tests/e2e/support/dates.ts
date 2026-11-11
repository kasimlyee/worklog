import { addDays, isWorkingDay, nextWorkingDay, today as todayIn, weekStart, type IsoDate } from '#src/server/domain/calendar.ts';

/* Journeys run against the real clock in the app time zone (BR-02). */

export function appToday(): IsoDate {
  return todayIn(new Date(), 'Africa/Kampala');
}

export function previousWorkingDay(date: IsoDate): IsoDate {
  let day = addDays(date, -1);
  while (!isWorkingDay(day)) {
    day = addDays(day, -1);
  }
  return day;
}

/** A working day in the current week's plan (today, or Friday at the weekend). */
export function workingDayThisWeek(): IsoDate {
  const today = appToday();
  return isWorkingDay(today) ? today : addDays(weekStart(today), 4);
}

export { addDays, nextWorkingDay, weekStart };
