import type { GroupView } from '../services/schedule/home'
import { groupHeading } from '../services/schedule/format'
import { ShowtimeCard } from './ShowtimeCard'

export function ShowtimeGroup({
  group,
  now,
  onToggle,
}: {
  group: GroupView
  now: Date
  onToggle: (id: string) => void
}) {
  return (
    <section className="group">
      {group.sessions.length > 1 && (
        <h2 className="group__title">
          {groupHeading(group.finish, group.sessions.length, group.shortestMargin, group.shortestScreen)}
        </h2>
      )}
      {group.sessions.map((view) => (
        <ShowtimeCard key={view.session.id} view={view} now={now} onToggle={onToggle} />
      ))}
    </section>
  )
}
