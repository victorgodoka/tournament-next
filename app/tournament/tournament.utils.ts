import { TournamentPlayerStats, TournamentDetail, TournamentSettings, TournamentUser, TournamentDuelProps, Duel } from "./tournament.types";
import { calculateWinRate } from "../profile/profile.utils";

export const decodeDuelData = (data: number): TournamentSettings => {
  const result = {
    mode: '',
    mr: 0,
    region: '',
    timer: 0,
    draw: false,
    startingHand: 0,
    noShuffle: false,
    isPublic: false,
    startlp: 0,
    duelRule: 0,
    allowBeta: false
  };

  const mode = (data & 0b11);
  result.mode = mode === 1 ? 'Match' : mode === 2 ? 'Tag' : 'Single';
  result.mr = (data >> 2) & 0b111;

  const region = (data >> 5) & 0b111;
  result.region = region === 1 ? 'TCG' : region === 2 ? 'OCG' : region === 3 ? 'Worlds' : region === 4 ? 'All' : 'Duel Links';
  result.timer = (data >> 8) & 0xFF;
  result.draw = ((data >> 16) & 0b1) === 1;

  result.startingHand = (data >> 17) & 0b11111;
  result.noShuffle = ((data >> 22) & 0b1) === 1;
  result.isPublic = ((data >> 23) & 0b1) === 1;

  result.startlp = (data >> 24) & 0xFF;

  // Bits 32+ are outside the 32-bit range that JS's `>>`/`&` operators can
  // read (they coerce operands to Int32 first), so shift via division instead.
  result.duelRule = Math.floor(data / 2 ** 32) & 0b111;
  result.allowBeta = (Math.floor(data / 2 ** 35) & 0b1) === 1;

  return result as TournamentSettings;
}

/**
 * Detect players who dropped out. A dropped player stops being paired, so they
 * appear in fewer rounds than were actually played. Returns, per user id, how
 * many rounds they missed (0 = played every round). A bye counts as appearing.
 */
export function detectDropouts(data: TournamentDetail): Map<string, number> {
  const totalRounds = data.rounds.length;
  const appearances = new Map<string, number>();
  for (const user of data.users) appearances.set(user.user_id, 0);

  for (const round of data.rounds) {
    // Count each player at most once per round.
    const present = new Set<string>();
    if (round.bye && appearances.has(round.bye)) present.add(round.bye);
    for (const duel of round.duels) {
      if (appearances.has(duel.duelist1)) present.add(duel.duelist1);
      if (appearances.has(duel.duelist2)) present.add(duel.duelist2);
    }
    for (const id of present) appearances.set(id, appearances.get(id)! + 1);
  }

  const missedByUser = new Map<string, number>();
  for (const user of data.users) {
    const missed = totalRounds - (appearances.get(user.user_id) ?? 0);
    missedByUser.set(user.user_id, Math.max(0, missed));
  }
  return missedByUser;
}

export function calculateTiebreakers(data: TournamentDetail): TournamentPlayerStats[] {
  const missedByUser = detectDropouts(data);

  const winPercentageById = new Map<string, number>();
  for (const user of data.users) {
    const wins = user.stats.wins || 0;
    const draws = user.stats.draws || 0;
    const losses = user.stats.loses || 0;
    winPercentageById.set(user.user_id, calculateWinRate(wins, losses, draws));
  }

  const opponentsById = new Map<string, string[]>();
  const lostRoundsById = new Map<string, number[]>();
  for (const user of data.users) {
    opponentsById.set(user.user_id, []);
    lostRoundsById.set(user.user_id, []);
  }

  data.rounds.forEach(round => {
    round.duels.forEach(room => {
      if (room.duelist1 !== round.bye && opponentsById.has(room.duelist1)) {
        opponentsById.get(room.duelist1)!.push(room.duelist2);
        if (room.result === 0) {
          lostRoundsById.get(room.duelist1)!.push(round.phase);
        }
      }
      if (room.duelist2 !== round.bye && opponentsById.has(room.duelist2)) {
        opponentsById.get(room.duelist2)!.push(room.duelist1);
        if (room.result === 1) {
          lostRoundsById.get(room.duelist2)!.push(round.phase);
        }
      }
    });
  });

  const opponentWinPercentage = (playerId: string): number => {
    const opponents = opponentsById.get(playerId) ?? [];
    if (opponents.length === 0) return 0;
    const total = opponents.reduce(
      (sum, opponentId) => sum + (winPercentageById.get(opponentId) ?? 0),
      0,
    );
    return total / opponents.length;
  };

  const opponentOpponentWinPercentage = (playerId: string): number => {
    const opponents = opponentsById.get(playerId) ?? [];
    if (opponents.length === 0) return 0;

    let total = 0;
    let count = 0;
    opponents.forEach(opponentId => {
      const opponentOpponents = opponentsById.get(opponentId) ?? [];
      opponentOpponents.forEach(opponentOpponentId => {
        total += winPercentageById.get(opponentOpponentId) ?? 0;
        count++;
      });
    });

    return count > 0 ? total / count : 0;
  };

  const playerStats = data.users.map(user => {
    const wins = user.stats.wins || 0;
    const draws = user.stats.draws || 0;
    // Missed rounds from dropping are counted as losses in the standings.
    const droppedRounds = missedByUser.get(user.user_id) ?? 0;
    const losses = (user.stats.loses || 0) + droppedRounds;

    const lostRounds = lostRoundsById.get(user.user_id) ?? [];
    const totalOpponentWinPercentage = opponentWinPercentage(user.user_id);
    const totalOpponentOpponentWinPercentage = opponentOpponentWinPercentage(user.user_id);
    const sumOfSquaresOfLostRounds = lostRounds.reduce((sum, round) => sum + (round * round), 0);

    const AA = Math.max(0, Math.min(Math.round(user.stats.rating), 99)).toString().padStart(2, '0');
    const BBB = Math.min(Math.round(totalOpponentWinPercentage * 10), 999).toString().padStart(3, '0');
    const CCC = Math.min(Math.round(totalOpponentOpponentWinPercentage * 10), 999).toString().padStart(3, '0');
    const DDD = Math.min(sumOfSquaresOfLostRounds, 999).toString().padStart(3, '0');

    const tiebreaker = `${AA}${BBB}${CCC}${DDD}`;

    const winPercentage = calculateWinRate(wins, losses, draws).toFixed(2);

    return {
      id: user.user_id,
      username: user.username,
      displayname: user.displayname,
      avatar: user.avatar,
      rating: user.stats.rating,
      wins,
      draws,
      losses,
      winPercentage,
      tiebreaker,
      dropped: droppedRounds > 0,
      droppedRounds,
    };
  });

  return playerStats.sort((a, b) => {
    const tiebreakerA = parseInt(a.tiebreaker);
    const tiebreakerB = parseInt(b.tiebreaker);
    return tiebreakerB - tiebreakerA;
  });
}

export const getMockByeDuelProps = (bye: string, startTime: string): Duel => {
  const mockedGames = { game1: 0, game2: 0, game3: 0 }
  return {
    room_id: 999,
    duelist1: bye,
    duelist2: "bye",
    winner: bye,
    result: 3,
    results: mockedGames,
    reasons: mockedGames,
    first: 0,
    end: startTime,
    usage: startTime,
  }
}
