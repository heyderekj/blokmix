import { Check, ChevronDown } from 'lucide-react'
import { Fragment, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useEscape } from '@/ui/shell/keys'

export interface DropdownOption<T extends string = string> {
  v: T
  label: string
  group?: string
}

interface DropdownProps<T extends string> {
  label: string
  value: T
  options: readonly DropdownOption<T>[]
  onChange: (value: T) => void
  className?: string
  lead?: ReactNode
  disabled?: boolean
}

const GAP = 5
const EDGE = 8
const MAX_HEIGHT = 360

/** A select-only combobox. Its listbox sits in the top layer so sidebars and dialogs cannot clip it. */
export function Dropdown<T extends string>({ label, value, options, onChange, className = '', lead, disabled }: DropdownProps<T>) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const match = useRef({ text: '', until: 0 })
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const selected = options.findIndex((option) => option.v === value)
  const optionId = (index: number) => `${id}-${index}`
  const close = () => setOpen(false)

  useEscape(open, close)
  useLayoutEffect(() => {
    const anchor = trigger.current
    const popup = list.current
    if (!open || !anchor || !popup) return

    const viewport = window.visualViewport
    const place = () => {
      const rect = anchor.getBoundingClientRect()
      const leftEdge = viewport?.offsetLeft ?? 0
      const topEdge = viewport?.offsetTop ?? 0
      const rightEdge = leftEdge + (viewport?.width ?? document.documentElement.clientWidth)
      const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight)
      const width = Math.min(Math.max(168, rect.width), rightEdge - leftEdge - 2 * EDGE)
      const below = bottomEdge - rect.bottom - GAP - EDGE
      const above = rect.top - topEdge - GAP - EDGE
      const needed = Math.min(popup.scrollHeight, MAX_HEIGHT)
      const up = below < needed && above > below
      const height = Math.max(0, Math.min(MAX_HEIGHT, up ? above : below))
      popup.style.width = `${width}px`
      popup.style.maxHeight = `${height}px`
      popup.style.left = `${Math.max(leftEdge + EDGE, Math.min(rect.left, rightEdge - width - EDGE))}px`
      popup.style.top = up ? `${rect.top - GAP - popup.offsetHeight}px` : `${rect.bottom + GAP}px`
    }
    popup.showPopover?.()
    place()
    const outside = (event: PointerEvent) => {
      const path = event.composedPath()
      if (!path.includes(anchor) && !path.includes(popup)) close()
    }
    const visibility = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) close()
    })
    visibility.observe(anchor)
    const resize = new ResizeObserver(place)
    resize.observe(anchor)
    window.addEventListener('pointerdown', outside, true)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    viewport?.addEventListener('resize', place)
    viewport?.addEventListener('scroll', place)
    return () => {
      visibility.disconnect()
      resize.disconnect()
      window.removeEventListener('pointerdown', outside, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      viewport?.removeEventListener('resize', place)
      viewport?.removeEventListener('scroll', place)
    }
  }, [open])

  useLayoutEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const show = (index = Math.max(0, selected)) => {
    match.current = { text: '', until: 0 }
    setActive(index)
    setOpen(true)
  }
  const pick = (index: number) => {
    const option = options[index]
    close()
    if (option && option.v !== value) onChange(option.v)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const { key } = event
    if (key === 'Tab') return close()
    if (event.ctrlKey || event.metaKey || event.altKey) return

    if (key === 'ArrowDown' || key === 'ArrowUp') {
      const delta = key === 'ArrowDown' ? 1 : -1
      if (open) setActive((index) => Math.max(0, Math.min(options.length - 1, index + delta)))
      else show(selected >= 0 ? selected : delta === 1 ? 0 : options.length - 1)
    } else if (key === 'Home' || key === 'End') {
      const index = key === 'Home' ? 0 : options.length - 1
      if (open) setActive(index)
      else show(index)
    } else if (key === 'Enter' || key === ' ') {
      if (open) pick(active)
      else show()
    } else if (key.length === 1) {
      const now = Date.now()
      const text = (now < match.current.until ? match.current.text + key : key).toLocaleLowerCase()
      const query = Array.from(text).every((char) => char === text[0]) ? text[0] : text
      const from = open ? active : selected
      for (let step = 1; step <= options.length; step++) {
        const index = (from + step) % options.length
        if (!options[index].label.toLocaleLowerCase().startsWith(query)) continue
        if (open) setActive(index)
        else show(index)
        break
      }
      match.current = { text, until: now + 600 }
    } else {
      return
    }
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <span className="contents">
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={open ? optionId(active) : undefined}
        disabled={disabled || options.length === 0}
        onClick={(event) => {
          event.stopPropagation()
          if (open) close()
          else show()
        }}
        onKeyDown={onKeyDown}
        onBlur={(event) => {
          if (!list.current?.contains(event.relatedTarget)) close()
        }}
        className={`flex min-h-8 min-w-0 cursor-pointer items-center gap-2 rounded-lg bg-white px-2.5 text-left text-[13px] font-medium text-zinc-800 shadow-[inset_0_0_0_1px_rgb(24_24_27/0.12)] outline-none transition-shadow hover:shadow-[inset_0_0_0_1px_rgb(24_24_27/0.24)] focus-visible:ring-2 focus-visible:ring-[#da397e]/60 aria-expanded:ring-2 aria-expanded:ring-[#da397e]/45 disabled:cursor-default disabled:opacity-50 ${className}`}
      >
        {lead}
        <span className="min-w-0 flex-1 truncate">{options[selected]?.label ?? value}</span>
        <ChevronDown size={14} aria-hidden className={`shrink-0 text-zinc-500 motion-safe:transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          ref={list}
          id={id}
          popover="manual"
          role="listbox"
          aria-label={label}
          className="thin-scroll fixed inset-auto z-[1000] m-0 overflow-y-auto overscroll-contain rounded-xl border border-zinc-950/10 bg-white p-1.5 text-left text-[13px] text-zinc-800 shadow-[0_12px_32px_-12px_rgb(24_24_27/0.25),0_4px_10px_-5px_rgb(24_24_27/0.15)]"
          onMouseDown={(event) => {
            if ((event.target as HTMLElement).closest('[role="option"]')) event.preventDefault()
          }}
        >
          {options.map((option, index) => (
            <Fragment key={option.v}>
              {option.group && options[index - 1]?.group !== option.group && (
                <div aria-hidden className="px-2.5 pb-1 pt-2 text-[11px] font-semibold text-zinc-500">{option.group}</div>
              )}
              <div
                id={optionId(index)}
                role="option"
                aria-selected={index === selected}
                onPointerMove={(event) => {
                  if (event.pointerType === 'mouse') setActive(index)
                }}
                onClick={(event) => {
                  event.stopPropagation()
                  pick(index)
                }}
                className={`flex min-h-9 cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 leading-snug [overflow-wrap:anywhere] [@media(pointer:coarse)]:min-h-11 ${index === active ? 'bg-[#fceaf2] text-[#571638]' : ''} ${index === selected ? 'font-semibold' : ''}`}
              >
                {option.group && <span className="sr-only">{option.group}: </span>}
                <span>{option.label}</span>
                {index === selected && <Check size={15} aria-hidden className="shrink-0 text-[#ad2262]" />}
              </div>
            </Fragment>
          ))}
        </div>
      )}
    </span>
  )
}
