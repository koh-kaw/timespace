import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  addDays,
  addMonths,
  addYears,
  differenceInMilliseconds,
} from 'date-fns';

export type ScaleKind = 'decade' | 'year' | 'month' | 'week' | 'day';

export type ScaleRange = {
  kind: ScaleKind;
  start: Date;
  end: Date;
  divisions: number;
  label: string;
  subLabel: string;
};

export function getScaleRange(kind: ScaleKind, anchor: Date = new Date()): ScaleRange {
  switch (kind) {
    case 'decade': {
      const startYear = Math.floor(anchor.getFullYear() / 10) * 10;
      const start = new Date(startYear, 0, 1);
      const end = new Date(startYear + 10, 0, 1);
      return {
        kind,
        start,
        end,
        divisions: 10,
        label: '10年',
        subLabel: `${startYear} - ${startYear + 9}`,
      };
    }
    case 'year': {
      const start = startOfYear(anchor);
      const end = addYears(start, 1);
      return {
        kind,
        start,
        end,
        divisions: 12,
        label: '1年',
        subLabel: `${anchor.getFullYear()}`,
      };
    }
    case 'month': {
      const start = startOfMonth(anchor);
      const end = addMonths(start, 1);
      const days = Math.round(differenceInMilliseconds(end, start) / (1000 * 60 * 60 * 24));
      return {
        kind,
        start,
        end,
        divisions: days,
        label: '1ヶ月',
        subLabel: `${anchor.getFullYear()}年${anchor.getMonth() + 1}月`,
      };
    }
    case 'week': {
      const start = startOfWeek(anchor, { weekStartsOn: 1 });
      const end = addDays(start, 7);
      return {
        kind,
        start,
        end,
        divisions: 7,
        label: '1週間',
        subLabel: `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate() - 1}`,
      };
    }
    case 'day':
    default: {
      const start = startOfDay(anchor);
      const end = endOfDay(anchor);
      return {
        kind: 'day',
        start,
        end: addDays(start, 1),
        divisions: 24,
        label: '1日',
        subLabel: `${anchor.getFullYear()}/${anchor.getMonth() + 1}/${anchor.getDate()}`,
      };
    }
  }
}

export const SCALE_ORDER: ScaleKind[] = ['decade', 'year', 'month', 'week', 'day'];

export function zoomOut(kind: ScaleKind): ScaleKind | null {
  const idx = SCALE_ORDER.indexOf(kind);
  return idx > 0 ? SCALE_ORDER[idx - 1] : null;
}

export function zoomIn(kind: ScaleKind): ScaleKind | null {
  const idx = SCALE_ORDER.indexOf(kind);
  return idx >= 0 && idx < SCALE_ORDER.length - 1 ? SCALE_ORDER[idx + 1] : null;
}

/** Convert a Date to a normalized [0, 1) position within a range. */
export function positionInRange(date: Date, range: ScaleRange): number {
  const total = range.end.getTime() - range.start.getTime();
  const pos = date.getTime() - range.start.getTime();
  return Math.max(0, Math.min(1, pos / total));
}

/** Convert a [0, 1) position to a polar angle in radians. 0 = top (12 o'clock), clockwise. */
export function positionToAngle(position: number): number {
  return position * 2 * Math.PI - Math.PI / 2;
}

/** SVG arc path from startAngle to endAngle (radians) at given radii. */
export function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number
): string {
  const x1o = cx + rOuter * Math.cos(startAngle);
  const y1o = cy + rOuter * Math.sin(startAngle);
  const x2o = cx + rOuter * Math.cos(endAngle);
  const y2o = cy + rOuter * Math.sin(endAngle);
  const x1i = cx + rInner * Math.cos(startAngle);
  const y1i = cy + rInner * Math.sin(startAngle);
  const x2i = cx + rInner * Math.cos(endAngle);
  const y2i = cy + rInner * Math.sin(endAngle);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${x1o} ${y1o} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${rInner} ${rInner} 0 ${large} 0 ${x1i} ${y1i} Z`;
}

/** Slice index (0 .. divisions-1) → [startDate, endDate]. */
export function sliceToTimeRange(
  index: number,
  range: ScaleRange
): { start: Date; end: Date } {
  const total = range.end.getTime() - range.start.getTime();
  const sliceMs = total / range.divisions;
  return {
    start: new Date(range.start.getTime() + index * sliceMs),
    end: new Date(range.start.getTime() + (index + 1) * sliceMs),
  };
}


// ─── Drill-down range from a task ────────────────────────────────────────────

/**
 * Given a parent task's duration, pick the most natural slice unit.
 * Returns a ScaleRange covering the task's time window, divided into
 * human-readable increments.
 *
 * Examples:
 *   30 min  → 5 min × 6
 *   1 hour  → 5 min × 12
 *   2 hours → 15 min × 8
 *   3 hours → 30 min × 6
 *   6 hours → 1 hour × 6
 *   12 hours→ 1 hour × 12
 *   24 hours→ 1 hour × 24
 *   48 hours→ 2 hours × 24
 */
export function drillRangeFromTask(
  start: Date,
  end: Date,
  parentTitle: string,
): ScaleRange {
  const totalMs = end.getTime() - start.getTime();
  const totalMin = totalMs / 60_000;

  // Pick slice unit (in minutes) that gives 6–24 divisions
  const candidates = [1, 2, 5, 10, 15, 20, 30, 60, 120, 180, 240, 360, 720];
  let sliceMin = 5;
  for (const c of candidates) {
    const divisions = Math.round(totalMin / c);
    if (divisions >= 4 && divisions <= 24) {
      sliceMin = c;
      break;
    }
  }

  const divisions = Math.max(2, Math.round(totalMin / sliceMin));

  const labelForUnit = (min: number) => {
    if (min < 60) return `${min}分`;
    return `${min / 60}時間`;
  };

  return {
    kind: 'day', // reuse 'day' kind so existing circle logic works
    start,
    end,
    divisions,
    label: parentTitle,
    subLabel: `${labelForUnit(sliceMin)}単位`,
  };
}
