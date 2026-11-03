import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

export const TZ = 'Asia/Kolkata'

export function nowInTz() {
  return dayjs().tz(TZ)
}

export function todayISO() {
  return nowInTz().format('YYYY-MM-DD')
}

export function formatDate(value?: string | Date | null, pattern = 'DD MMM YYYY') {
  if (!value) return '—'
  return dayjs(value).tz(TZ).format(pattern)
}

export function formatMonthYear(year: number, month: number) {
  return dayjs()
    .year(year)
    .month(month - 1)
    .format('MMMM YYYY')
}

export function currentYearMonth() {
  const n = nowInTz()
  return { year: n.year(), month: n.month() + 1 }
}

export function monthRange(year: number, month: number) {
  const start = dayjs()
    .tz(TZ)
    .year(year)
    .month(month - 1)
    .startOf('month')
  const end = start.endOf('month')
  return {
    from: start.format('YYYY-MM-DD'),
    to: end.format('YYYY-MM-DD'),
  }
}
