// Final match standings, ranked by who stayed in the match longest:
// winners first, then players still in, then whoever went out most recently.
// Players who went out together are split by lower points; exact ties share a place.
export function matchStandings(room) {
  const winners = new Set(room.winnerIds || []);
  const stayed = (player) => (player.winner ? 3 : !player.eliminated ? 2 : 1);
  const rows = room.players.map((player) => ({
    ...player,
    winner: winners.has(player.id),
    zeroRounds: (room.results || []).filter((result) =>
      result.scores.some((entry) => entry.id === player.id && entry.penalty === 0)).length,
  }));
  const compare = (a, b) => stayed(b) - stayed(a)
    || (a.eliminated && b.eliminated ? (b.outSeq ?? 0) - (a.outSeq ?? 0) : 0)
    || a.score - b.score;
  rows.sort((a, b) => compare(a, b) || a.name.localeCompare(b.name));
  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    row.place = row.winner ? 1 : previous && compare(previous, row) === 0 ? previous.place : index + 1;
  });
  return rows;
}

export function standingStatus(player) {
  if (player.winner) return 'Champion';
  if (!player.eliminated) return 'Survived';
  const round = player.outRound ? ` in round ${player.outRound}` : '';
  return player.left ? `Left${round}` : `Out${round}`;
}
