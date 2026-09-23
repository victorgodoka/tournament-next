export { useModal } from "@contexts/modal/modal.context"
export { useAuth } from "@contexts/auth/auth.context"
import { useEffect, useState, useRef, RefObject } from 'react';

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
