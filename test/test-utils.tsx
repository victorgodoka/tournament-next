export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
export {
  renderWithAuth,
  createAuthContextValue,
  defaultAuthContextValue,
  authenticatedUser,
  createGuestUser,
} from './mocks/auth-context'
export {
  mockRouter,
  pathnameState,
  searchParamsState,
  resetNextNavigationMocks,
} from './mocks/next-navigation'
export { createPlayerStats, createLeaderboardData } from './fixtures/player.fixture'
export {
  createSavedDeck,
  createMatchHistory,
  createCard,
  createConvertedDeck,
} from './fixtures/deck.fixture'
export {
  createTournament,
  createTournamentsListData,
  createTournamentUser,
  createDuel,
  createRound,
  createTournamentDetail,
} from './fixtures/tournament.fixture'
