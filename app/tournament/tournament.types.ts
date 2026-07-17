export interface TournamentDetailResponse {
  success: boolean;
  data: TournamentDetail;
}

export type TournamentPageProps = {
  params: Promise<{ id: string }>;
}

export interface Tournament {
  id: number;
  phases: number;
  players: number;
  banlist: string;
  settings: number;
  refteam: string;
  refuntil: string;
  starttime: string;
  endtime: string | null;
  extrarules: string;
}

export interface TournamentSettings {
  mode: 'Match' | 'Tag' | 'Single'
  mr: number,
  region: 'TCG' | 'OCG' | 'Worlds' | 'Duel Links' | 'All',
  timer: number,
  draw: boolean,
  startingHand: number,
  noShuffle: boolean,
  isPublic: boolean,
  startlp: number,
  duelRule: number,
  allowBeta: boolean
}

export interface TournamentDetail {
  tournament: Tournament;
  rounds: Round[];
  users: TournamentUser[];
  topcutPlayers: TournamentUser[];
  topcutData?: TopcutData;
}

export interface Duel {
  room_id: number;
  duelist1: string;
  duelist2: string;
  winner: string | null;
  result: number;
  results: GameResults;
  reasons: GameReasons;
  first: number;
  end: string;
  usage: string;
}

export interface Round {
  id: number;
  tournament_id: number;
  phase: number;
  bye: string;
  starttime: string;
  duels: Duel[];
}

export interface TournamentUser {
  user_id: string;
  username: string;
  avatar: string;
  displayname: string;
  stats: UserStats;
  deck?: TopcutDeck;
  tiebreaker?: string;
  isBye?: boolean;
}

export interface GameResults {
  game1: number;
  game2: number;
  game3: number;
}

export interface GameReasons {
  game1: number;
  game2: number;
  game3: number;
}

export interface UserStats {
  wins: number;
  loses: number;
  draws: number;
  rating: number;
}

export interface TopcutDeck {
  code: string;
  primaryArchetype: string;
  archetypes: DeckArchetype[];
  totalCards: number;
  mainDeckSize: number;
  sideDeckSize: number;
  uniqueCards: number[];
  fullDeck: FullDeck;
}

export interface FullDeck {
  main: number[];
  side: number[];
}

export interface DeckArchetype {
  name: string;
  count: number;
  percentage: number;
}

export interface TopcutStatsArchetype {
  name: string;
  count: number;
  percentage: number;
  ids: number[];
}

export interface TopcutStatsDeck {
  primaryArchetype: string;
  archetypes: TopcutStatsArchetype[];
  qty: number;
}

export interface TopcutData {
  decks: TopcutStatsDeck[];
  totalPlayers: number;
  uniqueDecks: number;
}

export interface TournamentPlayerStats {
  id: string;
  avatar?: string;
  username: string;
  displayname?: string;
  wins: number;
  winPercentage: string;
  draws: number;
  losses: number;
  rating: number;
  tiebreaker: string;
  /** True when the player stopped appearing before the last round. */
  dropped: boolean;
  /** Rounds the player missed after dropping, counted as losses. */
  droppedRounds: number;
}

export type TournamentDuelProps = {
  duel: Duel
  users: Map<string, TournamentUser>
}