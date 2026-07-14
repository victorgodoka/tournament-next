import { TournamentPlayerStats, TournamentDetail, TournamentSettings } from "./tournament.types";

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

  result.duelRule = (data >> 32) & 0b111;
  result.allowBeta = ((data >> 35) & 0b1) === 1;

  return result as TournamentSettings;
}

export function calculateTiebreakers(data: TournamentDetail): TournamentPlayerStats[] {
  const playerStats = data.users.map(user => {
    const wins = user.stats.wins || 0;
    const draws = user.stats.draws || 0;
    const losses = user.stats.loses || 0;

    const opponents: string[] = [];
    const lostRounds: number[] = [];

    data.rounds.forEach((round, roundIndex) => {
      if (round.bye === user.user_id) {
        return;
      }

      round.duels.forEach(room => {
        if (room.duelist1 === user.user_id) {
          opponents.push(room.duelist2);
          if (room.result === 0) {
            lostRounds.push(roundIndex + 1); // Round numbers are 1-indexed
          }
        } else if (room.duelist2 === user.user_id) {
          opponents.push(room.duelist1);
          if (room.result === 1) {
            lostRounds.push(roundIndex + 1); // Round numbers are 1-indexed
          }
        }
      });
    });

    let totalOpponentWinPercentage = 0;
    if (opponents.length > 0) {
      opponents.forEach(opponentId => {
        const opponentWinPercentage = calculatePlayerWinPercentage(opponentId, data);
        totalOpponentWinPercentage += opponentWinPercentage;
      });
      totalOpponentWinPercentage = totalOpponentWinPercentage / opponents.length;
    }

    let totalOpponentOpponentWinPercentage = 0;
    if (opponents.length > 0) {
      opponents.forEach(opponentId => {
        const opponentOpponentWinPercentage = calculateOpponentOpponentWinPercentage(opponentId, data);
        totalOpponentOpponentWinPercentage += opponentOpponentWinPercentage;
      });
      totalOpponentOpponentWinPercentage = totalOpponentOpponentWinPercentage / opponents.length;
    }

    const sumOfSquaresOfLostRounds = lostRounds.reduce((sum, round) => sum + (round * round), 0);

    const AA = Math.min(user.stats.rating, 99).toString().padStart(2, '0');
    const BBB = Math.min(Math.round(totalOpponentWinPercentage * 10), 999).toString().padStart(3, '0');
    const CCC = Math.min(Math.round(totalOpponentOpponentWinPercentage * 10), 999).toString().padStart(3, '0');
    const DDD = Math.min(sumOfSquaresOfLostRounds, 999).toString().padStart(3, '0');

    const tiebreaker = `${AA}${BBB}${CCC}${DDD}`;

    const totalMatches = wins + draws + losses;
    const winPercentage = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(2) : "0.00";

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
    };
  });

  return playerStats.sort((a, b) => {
    const tiebreakerA = parseInt(a.tiebreaker);
    const tiebreakerB = parseInt(b.tiebreaker);
    return tiebreakerB - tiebreakerA;
  });
}

function calculatePlayerWinPercentage(playerId: string, data: TournamentDetail): number {
  const tableData = data.users.find(t => t.user_id === playerId)?.stats;
  if (!tableData) return 0;

  const wins = tableData.wins || 0;
  const draws = tableData.draws || 0;
  const losses = tableData.loses || 0;
  const totalMatches = wins + draws + losses;

  if (totalMatches === 0) return 0;

  return (wins / totalMatches) * 100;
}


function calculateOpponentOpponentWinPercentage(playerId: string, data: TournamentDetail): number {
  const opponents: string[] = [];

  data.rounds.forEach(round => {
    if (round.bye === playerId) {
      return;
    }

    round.duels.forEach(room => {
      if (room.duelist1 === playerId) {
        opponents.push(room.duelist2);
      } else if (room.duelist2 === playerId) {
        opponents.push(room.duelist1);
      }
    });
  });

  if (opponents.length === 0) return 0;

  let totalOpponentOpponentWinPercentage = 0;
  let totalOpponentOpponents = 0;

  opponents.forEach(opponentId => {
    const opponentOpponents: string[] = [];

    data.rounds.forEach(round => {
      if (round.bye === opponentId) {
        return;
      }

      round.duels.forEach(room => {
        if (room.duelist1 === opponentId) {
          opponentOpponents.push(room.duelist2);
        } else if (room.duelist2 === opponentId) {
          opponentOpponents.push(room.duelist1);
        }
      });
    });

    opponentOpponents.forEach(opponentOpponentId => {
      const winPercentage = calculatePlayerWinPercentage(opponentOpponentId, data);
      totalOpponentOpponentWinPercentage += winPercentage;
      totalOpponentOpponents++;
    });
  });

  return totalOpponentOpponents > 0 ? totalOpponentOpponentWinPercentage / totalOpponentOpponents : 0;
}
