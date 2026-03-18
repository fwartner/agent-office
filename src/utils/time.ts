/** Safe date formatting — HH:MM */
export function safeTime(raw: string): string {
  const d = new Date(raw)
  if (isNaN(d.getTime())) return '--:--'
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/** Relative time (e.g. "2m ago") */
export function relativeTime(raw: string): string {
  const d = new Date(raw)
  if (isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  if (diffMs < 0) return 'just now'
  const secs = Math.floor(diffMs / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/** Truncate text for speech bubble */
export function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max - 1) + '\u2026' : text
}
