import { DATABASE_TABLES, RELATIONS } from './databaseTables.js'

// "Database": every table with what it holds and its main columns.
function DatabaseModel() {
  const groups = [...new Set(DATABASE_TABLES.map((table) => table.group))]
  return (
    <>
      <p className="arch-intro">
        Postgres at Supabase, one row per item. Every row carries your user id, and row level
        security lets each account read and change only its own rows.
      </p>
      {groups.map((group) => (
        <section key={group} className="db-group" aria-label={group}>
          <h3 className="db-group-title">{group}</h3>
          <ul className="db-tables">
            {DATABASE_TABLES.filter((table) => table.group === group).map((table) => (
              <li key={table.name} className="db-table">
                <span className="db-name">
                  {table.name}
                  {table.since === 'v3' && <span className="flow-tag">v3</span>}
                </span>
                <span className="db-what">{table.what}</span>
                <span className="db-columns">{table.columns}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <ul className="db-relations" aria-label="How the tables hang together">
        {RELATIONS.map((relation) => (
          <li key={relation}>{relation}</li>
        ))}
      </ul>
    </>
  )
}

export default DatabaseModel
