import { useState } from 'react'
import { useOnline } from '../../shared/data/hooks.js'
import Icon from '../../shared/ui/Icon.jsx'
import GroupModal from './GroupModal.jsx'
import ListModal from './ListModal.jsx'
import { SMART_ICONS } from './listStyle.js'
import { isDeleted, isOpen, matchesSearch } from './smartLists.js'
import { FIXED_SOURCES, groupSource, inSource, isInAll } from './sources.js'
import TaskRow from './TaskRow.jsx'

// The Lists page (mockup 5, design v3 §2.4): "New list" / "New group" on
// top, search, then Important, Planned and every group in one section – a
// group's row opens all its tasks, the chevron on the right shows or hides
// its lists. Below: the lists without a group.
function ListsView({ todos, today }) {
  const online = useOnline()
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(null)
  const { groups, lists, tasks, steps } = todos

  const openTasks = tasks.filter(isOpen)
  const countFor = (source) => openTasks.filter((task) => inSource(task, source, lists)).length
  const ungrouped = lists.filter((list) => list.group_id === null)
  const listName = (task) => lists.find((list) => list.id === task.list_id)?.name ?? 'No list'
  const stepsOf = (task) => steps.filter((step) => step.task_id === task.id)

  const results = query.trim()
    ? tasks.filter((task) => !isDeleted(task) && matchesSearch(task, stepsOf(task), query)).slice(0, 50)
    : null

  return (
    <div className="lists-page">
      <div className="lists-actions">
        <button type="button" className="button-outline" onClick={() => setModal({ type: 'list' })} disabled={!online}>
          New list
        </button>
        <button type="button" className="button-outline" onClick={() => setModal({ type: 'group' })} disabled={!online}>
          New group
        </button>
      </div>

      <div className="search-field">
        <Icon name="search" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tasks"
          aria-label="Search tasks"
        />
      </div>

      {results ? (
        <section aria-label="Search results" className="search-results">
          <p className="list-meta" role="status">
            {results.length === 0 ? 'Nothing found' : `${results.length} found`}
          </p>
          <ul className="task-list">
            {results.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                today={today}
                listName={listName(task)}
                steps={stepsOf(task)}
                onToggle={todos.toggleTask}
                onStar={(item) => todos.updateTask(item.id, { important: !item.important })}
                disabled={!online}
              />
            ))}
          </ul>
        </section>
      ) : (
        <>
          <nav aria-label="Lists and groups" className="list-links">
            {FIXED_SOURCES.filter((source) => source.id !== 'all').map((source) => (
              <a key={source.id} className="list-link" href={`#/list/${source.id}`}>
                <span className={`list-icon color-${source.color}`}>
                  <Icon path={SMART_ICONS[source.id]} />
                </span>
                <span className="list-link-name">{source.name}</span>
                <span className="list-count">{countFor(source.id) || ''}</span>
              </a>
            ))}

            {groups.map((group) => {
              const groupLists = lists.filter((list) => list.group_id === group.id)
              const open = !group.collapsed
              return (
                <div key={group.id} className="list-group">
                  <div className="group-row">
                    <a className="list-link" href={`#/list/${encodeURIComponent(groupSource(group.id))}`}>
                      <span className="list-icon group-icon">
                        <Icon path={SMART_ICONS.group} />
                      </span>
                      <span className="list-link-name">{group.name}</span>
                      <span className="list-count">{countFor(groupSource(group.id)) || ''}</span>
                    </a>
                    <button
                      type="button"
                      className="section-icon-button group-chevron"
                      aria-expanded={open}
                      aria-controls={`group-${group.id}`}
                      aria-label={`${open ? 'Hide' : 'Show'} the lists of ${group.name}`}
                      onClick={() => todos.updateGroup(group.id, { collapsed: open })}
                      disabled={!online}
                    >
                      <Icon name="chevronDown" className="section-chevron" />
                    </button>
                  </div>
                  {open && (
                    <div id={`group-${group.id}`}>
                      {groupLists.length === 0 ? (
                        <p className="group-empty">No lists in this group yet.</p>
                      ) : (
                        <ListLinks lists={groupLists} countFor={countFor} nested />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {ungrouped.length > 0 && (
            <>
              <hr className="lists-divider" />
              <ListLinks lists={ungrouped} countFor={countFor} label="Lists without a group" />
            </>
          )}
        </>
      )}

      {modal?.type === 'list' && <ListModal todos={todos} onClose={() => setModal(null)} />}
      {modal?.type === 'group' && <GroupModal todos={todos} group={modal.group} onClose={() => setModal(null)} />}
    </div>
  )
}

function ListLinks({ lists, countFor, nested = false, label }) {
  return (
    <ul className={nested ? 'list-links nested' : 'list-links'} aria-label={label}>
      {lists.map((list) => (
        <li key={list.id}>
          <a className="list-link" href={`#/list/${list.id}`}>
            <span className={`list-dot color-${list.color}`} aria-hidden="true" />
            <span className="list-link-name">{list.name}</span>
            {!isInAll(list) && <span className="list-not-in-all">not in All</span>}
            <span className="list-count">{countFor(list.id) || ''}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

export default ListsView
