import { useState } from 'react'
import './Confetti.css'

const COLORS = ['#c68a3d', '#5fbf86', '#4fa6c4', '#c06a4e', '#96679a', '#eceef0']

function random(min, max) {
  return min + Math.random() * (max - min)
}

// Each piece flies up and out, then falls with a bit of spin.
function makePieces(count, spread) {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    color: COLORS[index % COLORS.length],
    round: index % 3 === 0,
    dx: `${random(-spread, spread)}px`,
    peak: `${random(-spread, -spread * 0.4)}px`,
    fall: `${random(spread * 0.4, spread * 1.4)}px`,
    spin: `${random(-540, 540)}deg`,
    delay: `${random(0, 80)}ms`,
  }))
}

// A confetti burst at the given screen position (x, y). Small by default;
// pass a bigger `count` and `spread` for milestones.
// Give it a new `key` each time so a fresh set of pieces is made.
function Confetti({ x, y, count = 28, spread = 150 }) {
  const [pieces] = useState(() => makePieces(count, spread))

  return (
    <div className="confetti" style={{ left: x, top: y }} aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className={piece.round ? 'round' : undefined}
          style={{
            background: piece.color,
            '--dx': piece.dx,
            '--peak': piece.peak,
            '--fall': piece.fall,
            '--spin': piece.spin,
            animationDelay: piece.delay,
          }}
        />
      ))}
    </div>
  )
}

export default Confetti
