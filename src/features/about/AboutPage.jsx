import { useState } from 'react'
import BackLink from '../../shared/ui/BackLink.jsx'
import { version } from '../../../package.json'
import BlocksDiagram from './BlocksDiagram.jsx'
import DatabaseModel from './DatabaseModel.jsx'
import DataFlowDiagram from './DataFlowDiagram.jsx'
import DeployDiagram from './DeployDiagram.jsx'
import QualitySection from './QualitySection.jsx'
import RemindersDiagram from './RemindersDiagram.jsx'
import StackSection from './StackSection.jsx'
import './about.css'

const TOPICS = [
  { id: 'overview', label: 'Overview', Section: DeployDiagram },
  { id: 'blocks', label: 'Building blocks', Section: BlocksDiagram },
  { id: 'data', label: 'Data flow', Section: DataFlowDiagram },
  { id: 'database', label: 'Database', Section: DatabaseModel },
  { id: 'reminders', label: 'Reminders', Section: RemindersDiagram },
  { id: 'quality', label: 'Security & tests', Section: QualitySection },
  { id: 'stack', label: 'Tech stack', Section: StackSection },
]

// Settings → How it's built (design v3 §2.6, S1): the architecture of v2/v3
// in a few pictures. One topic at a time, chosen from a dropdown (owner,
// mockup review). Loaded only when opened (separate file in the build).
function AboutPage() {
  const [topic, setTopic] = useState('overview')
  const { Section, label } = TOPICS.find((item) => item.id === topic)

  return (
    <div className="about-page">
      <BackLink href="#/settings">Settings</BackLink>
      <h1 className="page-title">How it’s built</h1>
      <label className="about-topic">
        <span>Topic</span>
        <select className="input" value={topic} onChange={(event) => setTopic(event.target.value)}>
          {TOPICS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {/* key: a new topic fades in again */}
      <section key={topic} className="arch-panel" aria-label={label}>
        <Section version={version} />
      </section>
    </div>
  )
}

export default AboutPage
