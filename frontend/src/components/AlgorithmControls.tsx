interface Props {
  current: number
  total: number
  playing: boolean
  disabled?: boolean
  onBack: () => void
  onForward: () => void
  onPlayToggle: () => void
  onReset: () => void
}

export function AlgorithmControls({ current, total, playing, disabled, onBack, onForward, onPlayToggle, onReset }: Props) {
  return (
    <div className="controls" aria-label="Algorithm playback controls">
      <button className="icon-button" onClick={onReset} disabled={disabled} title="Reset to first step" aria-label="Reset playback to first step">↺</button>
      <button className="icon-button" onClick={onBack} disabled={disabled || current === 0} title="Step backward" aria-label="Step backward">‹</button>
      <button className="play-button" onClick={onPlayToggle} disabled={disabled || total === 0} aria-label={playing ? 'Pause playback' : 'Play steps'}>{playing ? 'Pause' : 'Play'}</button>
      <button className="icon-button" onClick={onForward} disabled={disabled || current >= total - 1} title="Step forward" aria-label="Step forward">›</button>
      <span className="step-count">{total ? `Step ${current + 1} / ${total}` : 'Run an algorithm to begin'}</span>
    </div>
  )
}
