function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

export function formatFriendly(iso: string, timezone = 'UTC'): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso

  const now = new Date()
  const sameYear = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric' })
    .format(d) === new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric' }).format(now)

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    day:    'numeric',
    month:  'long',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''

  const day     = ordinal(parseInt(get('day'), 10))
  const month   = get('month')
  const year    = get('year')
  const hour    = get('hour')
  const min     = get('minute')
  const ampm    = parseInt(hour, 10) < 12 ? 'am' : 'pm'

  const time  = `${hour}:${min}${ampm}`
  return sameYear ? `${day} ${month} at ${time}` : `${day} ${month} ${year} at ${time}`
}

export function formatFriendlyDate(iso: string, timezone = 'UTC'): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso

  const now = new Date()
  const sameYear = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric' })
    .format(d) === new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric' }).format(now)

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    day:   'numeric',
    month: 'long',
    year:  'numeric',
  }).formatToParts(d)

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  const day   = ordinal(parseInt(get('day'), 10))
  const month = get('month')
  const year  = get('year')

  return sameYear ? `${day} ${month}` : `${day} ${month} ${year}`
}
