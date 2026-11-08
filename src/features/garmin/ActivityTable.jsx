import { formatDistance, formatDuration, formatElevation } from './garmin.js'

// The Garmin window's activities (v3.5): one row per type with count,
// distance (v3.6), moving time and elevation gain (v3.7), then the total.
function ActivityTable({ view, showMonth }) {
  return (
    <div className="garmin-block">
      <p className="garmin-label">
        <span>Activities</span>
      </p>
      {view.activities.length ? (
        <table className="garmin-activities">
          <thead>
            <tr>
              <th scope="col">Type</th>
              <th scope="col">Count</th>
              <th scope="col">Distance</th>
              <th scope="col">Moving</th>
              <th scope="col" aria-label="Elevation">
                <abbr title="Elevation gain">Elev.</abbr>
            </th>
            </tr>
          </thead>
          <tbody>
            {view.activities.map((group) => (
              <tr key={group.label}>
                <th scope="row">
                  <span className="garmin-icon" aria-hidden="true">
                    {group.icon}
                  </span>
                  {group.label}
                </th>
                <td>{group.count}×</td>
                <td>{formatDistance(group.meters)}</td>
                <td>{formatDuration(group.seconds)}</td>
                <td>{formatElevation(group.elevation)}</td>
              </tr>
            ))}
            <tr className="garmin-total">
              <th scope="row">Total</th>
              <td>{view.total.count}×</td>
              <td>{formatDistance(view.total.meters)}</td>
              <td>{formatDuration(view.total.seconds)}</td>
              <td>{formatElevation(view.total.elevation)}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p className="empty-note">No activities {showMonth ? 'this month' : 'in these 7 days'}.</p>
      )}
    </div>
  )
}

export default ActivityTable
