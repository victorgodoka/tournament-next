import {
  createContext,
  useContext,
  type FC,
  type ReactNode,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { Card, CardsSearchParams } from '@lib/cards.types';
import { searchCards } from '@lib/cards.api';

interface CardsSearchActions {
  search: (params: CardsSearchParams) => Promise<Card[]>;
  clearSearch: () => void;
}

interface CardsSearchState {
  cards: Card[];
  isLoading: boolean;
  error: string | null;
}

type CardsSearchContextType = CardsSearchActions & CardsSearchState;

const ActionsContext = createContext<CardsSearchActions | null>(null);
const StateContext = createContext<CardsSearchState | null>(null);

/** Stable actions only — does not re-render when cards/isLoading change. */
export const useCardsSearchActions = (): CardsSearchActions => {
  const context = useContext(ActionsContext);
  if (!context) {
    throw new Error('useCardsSearchActions must be used inside CardsSearchProvider');
  }
  return context;
};

/** Card list state — re-renders on search results. */
export const useCardsSearchState = (): CardsSearchState => {
  const context = useContext(StateContext);
  if (!context) {
    throw new Error('useCardsSearchState must be used inside CardsSearchProvider');
  }
  return context;
};

export const useCardsSearch = (): CardsSearchContextType => ({
  ...useCardsSearchActions(),
  ...useCardsSearchState(),
});

export const CardsSearchProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (params: CardsSearchParams): Promise<Card[]> => {
    setIsLoading(true);
    setError(null);

    const { success, data, error } = await searchCards(params);
    if (!success) {
      setError(error || 'Unknown error');
      setCards([]);
    } else {
      setCards(data?.cards || []);
    }
    setIsLoading(false);
    return data?.cards || [];
  }, []);

  const clearSearch = useCallback(() => {
    setCards([]);
    setError(null);
  }, []);

  const actionsValue = useMemo(
    () => ({ search, clearSearch }),
    [search, clearSearch]
  );

  const stateValue = useMemo(
    () => ({ cards, isLoading, error }),
    [cards, isLoading, error]
  );

  return (
    <ActionsContext.Provider value={actionsValue}>
      <StateContext.Provider value={stateValue}>{children}</StateContext.Provider>
    </ActionsContext.Provider>
  );
};
