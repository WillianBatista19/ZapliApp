'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type SuggestedUser = {
  id: string
  username: string
  display_name: string | null
}

type Props = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  rows?: number
}

export default function MentionInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
  autoFocus,
  rows = 1,
}: Props) {
  const supabase     = useMemo(() => createClient(), [])
  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [suggestions,   setSuggestions]   = useState<SuggestedUser[]>([])
  const [activeMention, setActiveMention] = useState<{ start: number; query: string } | null>(null)

  // Position cursor at end when auto-focused (pre-filled reply inputs)
  useEffect(() => {
    if (!autoFocus || !textareaRef.current) return
    const el = textareaRef.current
    el.focus()
    const len = el.value.length
    el.setSelectionRange(len, len)
  }, [autoFocus])

  // Close dropdown on click outside
  useEffect(() => {
    if (!suggestions.length) return
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setSuggestions([])
        setActiveMention(null)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [suggestions.length])

  function getActiveMention(text: string, cursor: number) {
    let i = cursor - 1
    while (i >= 0 && text[i] !== ' ' && text[i] !== '\n') {
      if (text[i] === '@') return { start: i, query: text.slice(i + 1, cursor) }
      i--
    }
    return null
  }

  function scheduleSearch(mention: { start: number; query: string } | null) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!mention || mention.query.length === 0) { setSuggestions([]); return }

    debounceRef.current = setTimeout(async () => {
      const q = mention.query
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(6)
      setSuggestions((data as SuggestedUser[]) ?? [])
    }, 200)
  }

  function detect(text: string, cursor: number) {
    const mention = getActiveMention(text, cursor)
    setActiveMention(mention)
    scheduleSearch(mention)
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value)
    detect(e.target.value, e.target.selectionStart ?? e.target.value.length)
  }

  // Handles cursor movement (arrow keys, click-inside) without a value change
  function handleSelect() {
    const el = textareaRef.current
    if (el) detect(el.value, el.selectionStart ?? 0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      setSuggestions([])
      setActiveMention(null)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (suggestions.length > 0) {
        insertMention(suggestions[0].username)
      } else {
        onSubmit()
      }
    }
  }

  function insertMention(username: string) {
    if (!activeMention) return
    const el       = textareaRef.current
    const current  = el?.value ?? value          // read fresh DOM value
    const cursor   = el?.selectionStart ?? current.length
    const before   = current.slice(0, activeMention.start)
    const after    = current.slice(cursor)
    const inserted = `${before}@${username} ${after}`
    onChange(inserted)
    setSuggestions([])
    setActiveMention(null)

    // Reposition cursor after the inserted mention
    setTimeout(() => {
      if (!el) return
      const pos = activeMention.start + username.length + 2 // "@" + username + " "
      el.focus()
      el.setSelectionRange(pos, pos)
    }, 0)
  }

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onSelect={handleSelect}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-[#D4537E]/50 focus:ring-1 focus:ring-[#D4537E] disabled:opacity-50"
      />

      {suggestions.length > 0 && (
        <ul className="absolute left-0 top-full z-30 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
          {suggestions.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                // onMouseDown + preventDefault keeps textarea focus before the click resolves
                onMouseDown={(e) => { e.preventDefault(); insertMention(u.username) }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-800"
              >
                <span className="font-semibold text-zinc-200">{u.display_name || u.username}</span>
                <span className="text-zinc-500">@{u.username}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
