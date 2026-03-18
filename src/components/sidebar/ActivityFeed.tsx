import { activityIcons } from '../../utils/presence'
import { safeTime } from '../../utils/time'
import type { ActivityItem } from '../../world'
import { InlineMarkdown } from '../shared/Markdown'

export function ActivityFeed({ activity, dataSource }: {
  activity: ActivityItem[]
  dataSource: 'seed' | 'live'
}) {
  return (
    <div className="activity-feed" role="tabpanel" aria-live="polite">
      {activity.length === 0 && (dataSource === 'seed' ? (
        <>
          <div className="feed-skeleton" />
          <div className="feed-skeleton" />
          <div className="feed-skeleton" />
        </>
      ) : (
        <p className="feed-empty">No activity yet</p>
      ))}
      {activity.map(item => (
        <div key={item.id} className={`feed-entry feed-${item.kind}`}>
          <span className="feed-icon" aria-hidden="true">{activityIcons[item.kind] ?? '\u25CB'}</span>
          <div className="feed-body">
            <span className="feed-text"><InlineMarkdown text={item.text} /></span>
            <span className="feed-time">{safeTime(item.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
