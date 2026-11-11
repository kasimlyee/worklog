import { describe, expect, it } from 'vitest';
import { isoDate as d } from './calendar.ts';
import { isValidReportStart, reportPeriodLabel, reportRange, reportStartFor, shiftReportPeriod } from './report-periods.ts';

describe('report periods', () => {
  it('R-01: daily is any date, weekly starts Monday, monthly starts on the 1st', () => {
    expect(isValidReportStart('daily', d('2026-11-14'))).toBe(true);
    expect(isValidReportStart('weekly', d('2026-11-09'))).toBe(true);
    expect(isValidReportStart('weekly', d('2026-11-10'))).toBe(false);
    expect(isValidReportStart('monthly', d('2026-11-01'))).toBe(true);
    expect(isValidReportStart('monthly', d('2026-11-02'))).toBe(false);
  });

  it('R-01: finds the period containing a date', () => {
    expect(reportStartFor('daily', d('2026-11-14'))).toBe('2026-11-14');
    expect(reportStartFor('weekly', d('2026-11-14'))).toBe('2026-11-09');
    expect(reportStartFor('monthly', d('2026-11-14'))).toBe('2026-11-01');
  });

  it('BR-18: a weekly range runs to Sunday so weekend work can appear', () => {
    expect(reportRange('daily', d('2026-11-10'))).toEqual({ from: '2026-11-10', to: '2026-11-10' });
    expect(reportRange('weekly', d('2026-11-09'))).toEqual({ from: '2026-11-09', to: '2026-11-15' });
    expect(reportRange('monthly', d('2026-02-01'))).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('R-03: labels each period', () => {
    expect(reportPeriodLabel('daily', d('2026-11-14'))).toBe('Saturday 14 Nov 2026');
    expect(reportPeriodLabel('weekly', d('2026-11-09'))).toBe('Week of 9–13 Nov 2026');
    expect(reportPeriodLabel('monthly', d('2026-11-01'))).toBe('November 2026');
  });

  it('moves to the previous and next period', () => {
    expect(shiftReportPeriod('daily', d('2026-11-16'), -1)).toBe('2026-11-15');
    expect(shiftReportPeriod('weekly', d('2026-11-09'), 1)).toBe('2026-11-16');
    expect(shiftReportPeriod('monthly', d('2026-12-01'), 1)).toBe('2027-01-01');
    expect(shiftReportPeriod('monthly', d('2026-12-01'), -1)).toBe('2026-11-01');
  });
});
