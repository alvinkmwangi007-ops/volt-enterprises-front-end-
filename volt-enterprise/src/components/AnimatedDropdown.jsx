import { useEffect, useRef, useState } from 'react'
import './AnimatedDropdown.css'

function AnimatedDropdown({
  id,
  label,
  name,
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  required = false,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef(null)
  const selectedIndex = options.findIndex((option) => option.value === value)

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const handleTriggerKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setIsOpen(true)
      const direction = event.key === 'ArrowDown' ? 1 : -1
      const nextIndex = selectedIndex < 0
        ? (direction > 0 ? 0 : options.length - 1)
        : (selectedIndex + direction + options.length) % options.length
      onChange(options[nextIndex].value)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setIsOpen((open) => !open)
    }
  }

  return (
    <div className={`animated-dropdown seller-field${isOpen ? ' is-open' : ''}`} ref={rootRef}>
      <span id={`${id}-label`}>{label}{required ? ' *' : ''}</span>
      <select
        className="animated-dropdown-validation"
        name={name}
        value={value}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" />
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <button
        id={id}
        className={`animated-dropdown-trigger${isOpen ? ' is-open' : ''}`}
        type="button"
        disabled={disabled}
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-controls={`${id}-options`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-required={required}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={selectedIndex < 0 ? 'is-placeholder' : ''}>
          {selectedIndex < 0 ? placeholder : options[selectedIndex].label}
        </span>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="m3 6 5 5 5-5" />
        </svg>
      </button>
      <div
        id={`${id}-options`}
        className={`animated-dropdown-menu${isOpen ? ' is-open' : ''}`}
        role="listbox"
        aria-labelledby={`${id}-label`}
        aria-hidden={!isOpen}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={value === option.value}
            tabIndex={isOpen ? 0 : -1}
            className={value === option.value ? 'is-selected' : ''}
            onClick={() => {
              onChange(option.value)
              setIsOpen(false)
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default AnimatedDropdown
