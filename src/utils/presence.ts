import type { PresenceState } from '../data'

export const presenceLabels: Record<PresenceState, string> = {
  off_hours: 'Off hours',
  available: 'Available',
  active: 'Active',
  in_meeting: 'In meeting',
  paused: 'Paused',
  blocked: 'Blocked'
}

export const presenceIcons: Record<PresenceState, string> = {
  off_hours: '\u263E',
  available: '\u25CF',
  active: '\u25B6',
  in_meeting: '\u25A0',
  paused: '\u2016',
  blocked: '\u2715',
}

export const activityIcons: Record<string, string> = {
  assignment: '\u25B6',
  presence: '\u25CF',
  decision: '\u2605',
  system: '\u2699'
}
