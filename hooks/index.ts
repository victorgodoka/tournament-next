export { useModal } from "@contexts/modal/modal.context"
export { useAuth } from "@contexts/auth/auth.context"
import { useCallback, useEffect, useState, useRef, RefObject } from 'react';

export function useIsOffScreen(): [RefObject<HTMLElement | null>, boolean] {
  const elementRef = useRef<HTMLElement | null>(null);
  const [isOffScreen, setIsOffScreen] = useState<boolean>(false);

  useEffect(() => {
    const currentElement = elementRef.current;
    if (!currentElement) return;

    // O IntersectionObserver monitora a visibilidade do elemento na tela
    const observer = new IntersectionObserver(
      ([entry]) => {
        entry && setIsOffScreen(!entry.isIntersecting);
      },
      {
        root: null, // Usa o viewport do navegador como referência
        threshold: 0, // Dispara assim que o primeiro pixel entra ou sai da tela
        rootMargin: '0px'
      }
    );

    observer.observe(currentElement);

    // Limpa o observador quando o componente é desmontado
    return () => {
      observer.unobserve(currentElement);
    };
  }, []);

  return [elementRef, isOffScreen];
}

/** Debounced lookup: fires 250 ms after typing stops, from two characters on. `search` must be stable. */
export function useSearch<T>(text: string, search: (text: string, signal: AbortSignal) => Promise<T[]>) {
  const [results, setResults] = useState<T[]>([])
  const query = text.trim()

  useEffect(() => {
    if (query.length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(() => search(query, controller.signal).then(setResults).catch(() => {}), 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, search])

  return query.length < 2 ? [] : results
}

type Resource<T> = { key: string | null; tick: number; data?: T; error?: unknown }

/**
 * Loads `load` whenever `key` changes (`null` skips), aborting the previous request. `data` stays on
 * screen while a reload runs; `setData` patches it after a write so nothing re-fetches.
 */
export function useResource<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>) {
  const loadRef = useRef(load)
  const [tick, setTick] = useState(0)
  const [state, setState] = useState<Resource<T>>({ key: null, tick: -1 })

  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    if (key === null) return
    const controller = new AbortController()
    loadRef.current(controller.signal).then(
      (data) => setState({ key, tick, data }),
      (error) => {
        if (!controller.signal.aborted) setState((s) => ({ ...s, key, tick, error }))
      },
    )
    return () => controller.abort()
  }, [key, tick])

  // Stable, so it can sit in an effect's deps (polling) without restarting it every render.
  const reload = useCallback(() => setTick((t) => t + 1), [])

  return {
    data: state.data,
    error: state.key === key && state.tick === tick ? state.error : undefined,
    loading: key !== null && (state.key !== key || state.tick !== tick),
    reload,
    setData: (update: (current: T | undefined) => T | undefined) => setState((s) => ({ ...s, data: update(s.data) })),
  }
}

/**
 * A text field that keeps its keystrokes local and hands the text to `commit` 400 ms after typing
 * stops, or on blur. For fields whose parent is expensive to re-render. Spread onto the input.
 */
export function useLazyText(value: string, commit: (text: string) => void) {
  const [text, setText] = useState(value)
  const [seen, setSeen] = useState(value)
  const commitRef = useRef(commit)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    commitRef.current = commit
  })
  useEffect(() => () => clearTimeout(timer.current), [])

  // Follow the value when it changes from outside (a reload, another tab).
  if (value !== seen) {
    setSeen(value)
    setText(value)
  }

  const flush = (next: string) => {
    clearTimeout(timer.current)
    if (next !== value) commitRef.current(next)
  }

  return {
    value: text,
    onChange: (e: { target: { value: string } }) => {
      const next = e.target.value
      setText(next)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => flush(next), 400)
    },
    onBlur: () => flush(text),
  }
}
