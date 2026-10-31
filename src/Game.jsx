import { useEffect, useRef, useState } from 'react';
import { Avatar, Card, Icon, Modal, rankLabel, ruleLabels } from './components.jsx';

const compactTableQuery = '(max-width: 1100px)';
const clockwiseSeatLayouts = {
  1: [[50, 10]],
  2: [[9, 48], [91, 48]],
  3: [[9, 67], [50, 10], [91, 67]],
  4: [[9, 67], [28, 10], [72, 10], [91, 67]],
  5: [[9, 67], [9, 29], [50, 10], [91, 29], [91, 67]],
  6: [[9, 67], [9, 29], [28, 10], [72, 10], [91, 29], [91, 67]],
  7: [[9, 67], [9, 48], [9, 29], [50, 10], [91, 29], [91, 48], [91, 67]],
  8: [[9, 67], [9, 48], [9, 29], [28, 10], [72, 10], [91, 29], [91, 48], [91, 67]],
  9: [[9, 67], [9, 48], [9, 29], [28, 10], [50, 10], [72, 10], [91, 29], [91, 48], [91, 67]],
};
const seatAt = (layout, index) => layout[index] || [50, 10];
const reactions = [
  ['😂', 'Laugh'], ['😅', 'Oops'], ['👏', 'Applause'],
  ['🎉', 'Celebrate'], ['👍', 'Thumbs up'], ['🤔', 'Thinking'],
  ['❤️', 'Heart'], ['😡', 'Angry'],
];

function TableReaction({ message, origin }) {
  const [visible, setVisible] = useState(() => Date.now() < message.at + 4000);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), Math.max(0, Math.min(4000, message.at + 4000 - Date.now())));
    return () => clearTimeout(timer);
  }, [message.at]);
  if (!visible) return null;
  const label = reactions.find(([emoji]) => emoji === message.text)[1];
  const [x, y] = origin;
  const drift = x < 50 ? 35 : x > 50 ? -35 : 18;
  return <div className="table-reaction" style={{ '--reaction-x': `${x}%`, '--reaction-y': `${y}%`,
    '--reaction-drift': `${drift}px`, '--reaction-rise': y <= 10 ? '75px' : '-100px' }}
    role="status" aria-label={`${message.name}: ${label}`}>
    <span aria-hidden="true">{message.text}</span>
  </div>;
}

function Chat({ room, user, send, busy, connected, text, setText, compact = false }) {
  const messages = useRef(null);
  const [historyVisible, setHistoryVisible] = useState(!compact);
  useEffect(() => {
    if (messages.current) messages.current.scrollTop = messages.current.scrollHeight;
  }, [room.chat.length, room.chat.at(-1)?.id, historyVisible]);
  return <section className="chat-panel"><div className="chat-heading"><h3><Icon name="chat" size={18} /> Table talk</h3><span>Keep it friendly</span></div>
    <button type="button" className="chat-history-toggle" aria-expanded={historyVisible} aria-controls="table-chat-history"
      onClick={() => setHistoryVisible((visible) => !visible)}>{historyVisible ? 'Hide history' : 'Show history'} · {room.chat.length}</button>
    <div id="table-chat-history" hidden={!historyVisible} className="chat-messages" ref={messages} role="log" aria-label="Table chat" aria-live="polite">
      {!room.chat.length && <div className="chat-empty"><span>✳</span><p>A little banter makes<br />a better card night.</p></div>}
      {room.chat.map((message) => <div key={message.id} className={`chat-message ${message.userId === user.id ? 'own-message' : ''}`}>
        <div><b>{message.userId === user.id ? 'You' : message.name}</b><time>{new Date(message.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div><p>{message.text}</p>
      </div>)}
    </div>
    <div className="chat-reactions" role="group" aria-label="Send a table reaction">
      {reactions.map(([emoji, label]) => <button key={emoji} type="button" aria-label={`Send ${label} reaction`}
        disabled={busy || !connected} onClick={() => send('chat:send', { text: emoji })}>{emoji}</button>)}
    </div>
    <form className="chat-form" onSubmit={async (event) => {
      event.preventDefault();
      if (await send('chat:send', { text })) setText('');
    }}><label htmlFor="chat-message" className="sr-only">Message the table</label>
      <input id="chat-message" value={text} onChange={(event) => setText(event.target.value)} placeholder="Say something nice…" maxLength={280} required autoComplete="off" />
      <button className="icon-button" type="submit" aria-label="Send message" disabled={busy || !connected || !text.trim()}><Icon name="arrow" size={18} /></button>
    </form>
  </section>;
}

function Scoreboard({ room, user }) {
  const players = [...room.players].sort((a, b) => a.score - b.score);
  return <section className="score-panel"><div className="chat-heading"><h3><Icon name="trophy" size={18} /> Round points</h3><span>Out at {room.pointsToEliminate}</span></div>
    <div className="round-score-history">
      <div className="round-score-scroll">
        <table>
          <thead><tr><th scope="col">Round</th>{players.map((player) =>
            <th scope="col" key={player.id} title={player.name} className={`${player.eliminated ? 'round-score-out' : ''} ${player.id === user.id ? 'round-score-you' : ''}`}>{player.id === user.id ? 'You' : player.name}</th>)}</tr></thead>
          <tbody>{room.results.map((result) => <tr key={result.round}>
            <th scope="row">R{result.round}</th>
            {players.map((player) => {
              const score = result.scores.find((entry) => entry.id === player.id);
              return <td className={score?.penalty === 0 ? 'round-score-zero' : ''} key={player.id}>
                {score ? `+${score.penalty}` : '—'}
              </td>;
            })}
          </tr>)}</tbody>
          <tfoot><tr><th scope="row">Total</th>{players.map((player) =>
            <td className="round-score-total" key={player.id}>{player.score}</td>)}</tr></tfoot>
        </table>
      </div>
      {!room.results.length && <p className="round-score-empty">Points will appear after the first completed round.</p>}
    </div>
  </section>;
}

function WinnerCelebration({ winners, round, match = false }) {
  if (!winners.length) return null;
  return <section className={`winner-celebration ${winners.length > 3 ? 'many-winners' : ''}`} aria-label={match ? 'Match winners' : 'Round winners'}>
    <div className="winner-confetti" aria-hidden="true">{Array.from({ length: 60 }, (_, index) =>
      <i key={index} style={{
        '--origin': index % 2 ? '92%' : '8%',
        '--spread': (index % 2 ? -1 : 1) * (0.3 + ((index * 7) % 19) / 15),
        '--lift': `${-55 - (index * 13) % 85}px`,
        '--spin': `${(index % 2 ? -1 : 1) * (360 + (index * 47) % 540)}deg`,
        '--delay': `${Math.floor(index / 20) * 160 + (index % 5) * 18}ms`,
        '--duration': `${2800 + (index * 37) % 1000}ms`,
      }}><span /></i>)}</div>
    <div className="winner-badge"><Icon name="trophy" size={20} /><span>{match ? 'MATCH' : `ROUND ${round}`}<b>{winners.length > 1 ? 'WINNERS' : 'WINNER'}</b></span></div>
    <p className="sr-only" role="status">{winners.map((winner) => winner.name).join(' & ')} {winners.length > 1 ? 'win' : 'wins'} {match ? 'the match' : `round ${round}`}!</p>
    <div className="winner-grid" style={{ '--winner-columns': Math.min(winners.length, 3) }}>{winners.map((winner) => <div className="winner-player" key={winner.id}>
      <strong title={winner.name}>{winner.name}</strong>
      <div className="winning-cards" aria-label={`${winner.name}'s winning cards`}>{winner.hand.map((card) => <Card small key={card.id} card={card} />)}</div>
    </div>)}</div>
  </section>;
}

const placeLabel = (place) => ['1st', '2nd', '3rd'][place - 1] || `${place}th`;

// Final standings: winners first, then players still in, then lowest score.
function matchStandings(room) {
  const winners = new Set(room.winnerIds || []);
  return room.players.map((player) => ({
    ...player,
    winner: winners.has(player.id),
    zeroRounds: room.results.filter((result) =>
      result.scores.some((entry) => entry.id === player.id && entry.penalty === 0)).length,
  })).sort((a, b) => b.winner - a.winner || a.eliminated - b.eliminated || a.score - b.score
    || a.name.localeCompare(b.name));
}

function MatchScorecard({ room, user, busy, notify, onClose, onLeave }) {
  const standings = matchStandings(room);
  const winners = standings.filter((player) => player.winner);
  const rounds = room.results.length;
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const headline = winners.length
    ? `${winners.map((player) => player.id === user.id ? 'You' : player.name).join(' & ')} ${winners.length > 1 || winners[0].id === user.id ? 'win' : 'wins'} the match!`
    : 'Match complete';
  async function copyResult() {
    const lines = standings.map((player, index) =>
      `${placeLabel(index + 1)}  ${player.name} · ${player.score} pts${player.winner ? ' 🏆' : player.eliminated ? ' (out)' : ''}`);
    const text = [`5 Cards · ${room.name}`, headline, `${rounds} round${rounds === 1 ? '' : 's'} · out at ${room.pointsToEliminate} pts`, '', ...lines].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      notify('Scorecard copied. Paste it anywhere to share.');
    } catch {
      notify('Copy is not available here. Take a screenshot to share your scorecard.');
    }
  }
  return <div className="scorecard-overlay" role="dialog" aria-modal="true" aria-labelledby="scorecard-title">
    <section className="scorecard">
      <header className="scorecard-head">
        <span className="scorecard-trophy" aria-hidden="true"><Icon name="trophy" size={26} /></span>
        <span className="scorecard-eyebrow">MATCH COMPLETE · {room.name}</span>
        <h2 id="scorecard-title">{headline}</h2>
        <div className="scorecard-stats">
          <span><b>{rounds}</b>Round{rounds === 1 ? '' : 's'}</span>
          <span><b>{room.players.length}</b>Players</span>
          <span><b>{room.pointsToEliminate}</b>Out at</span>
        </div>
      </header>
      <ol className="scorecard-list">
        {standings.map((player, index) => <li key={player.id}
          className={`scorecard-row ${player.winner ? 'is-winner' : ''} ${player.eliminated ? 'is-out' : ''} ${player.id === user.id ? 'is-you' : ''}`}>
          <span className={`scorecard-place place-${index + 1}`}>{placeLabel(index + 1)}</span>
          <Avatar name={player.name} index={room.players.findIndex((entry) => entry.id === player.id)} small />
          <div className="scorecard-player">
            <b>{player.name}{player.id === user.id ? ' (you)' : ''}</b>
            <span>{player.winner ? 'Champion' : player.eliminated ? 'Eliminated' : 'Survived'} · {player.zeroRounds} zero round{player.zeroRounds === 1 ? '' : 's'}</span>
          </div>
          <span className="scorecard-points"><b>{player.score}</b>pts</span>
        </li>)}
      </ol>
      <footer className="scorecard-actions">
        <button className="button button-accent" disabled={busy} onClick={onLeave}>Back to the lobby <Icon name="arrow" size={17} /></button>
        <button className="button button-outline" onClick={copyResult}><Icon name="copy" size={16} /> Copy result</button>
        <button className="text-button" onClick={onClose}>View table</button>
      </footer>
    </section>
  </div>;
}

function WrongShowNotice({ result }) {
  if (!result?.showingId || result.successful) return null;
  const showing = result.scores.find((entry) => entry.id === result.showingId);
  return <div className="wrong-show-notice" role="status">
    <span className="wrong-show-emoji" aria-hidden="true">😅</span>
    <div><strong>Wrong show — {showing.name}</strong><span>{result.clash ? 'Clash! Lowest hand gets 0.' : 'Oops! Lowest hand gets 0.'} <b>+{showing.penalty} points</b></span></div>
  </div>;
}

function Results({ result }) {
  return <div className="round-results"><h3>{result.clash ? 'A clash at the table.' : 'The cards are on the table.'}</h3><p>{result.message}</p>
    <WrongShowNotice result={result} />
    <div className="result-rows">{result.scores.map((entry) => <div className="result-row" key={entry.id}>
      <div className="result-name"><b>{entry.name}</b><span>{entry.eliminated ? 'Eliminated' : `${entry.value} in hand`}</span></div>
      <div className={`revealed-cards ${entry.penalty === 0 ? 'winning-cards' : ''}`}>{entry.hand.map((card) => <Card small key={card.id} card={card} />)}</div>
      <span className={`penalty ${entry.penalty ? 'penalty-added' : ''}`}>+{entry.penalty}</span>
    </div>)}</div>
  </div>;
}

export default function Game({ room, user, send, busy, connected, onRules, notify, notification, onMyTurn }) {
  const [selected, setSelected] = useState([]);
  const [chatText, setChatText] = useState('');
  const [panel, setPanel] = useState(null);
  const [mobile, setMobile] = useState(() => window.matchMedia(compactTableQuery).matches);
  const [controlsOpen, setControlsOpen] = useState(false);
  const swipeStart = useRef(null);
  // Phone layout: share the hand panel's height with CSS so the piles fill the space above it.
  const feltRef = useRef(null);
  useEffect(() => {
    const felt = feltRef.current;
    const hand = felt?.querySelector('.hand-panel');
    if (!felt || !hand || typeof ResizeObserver === 'undefined') return;
    const update = () => felt.style.setProperty('--hand-h', `${hand.offsetHeight + 3}px`);
    const observer = new ResizeObserver(update);
    observer.observe(hand);
    update();
    return () => observer.disconnect();
  }, [room.status]);
  const [drawSource, setDrawSource] = useState('drawPile');
  const [discardCardId, setDiscardCardId] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [actionFeedback, setActionFeedback] = useState(null);
  const [scorecardOpen, setScorecardOpen] = useState(true);
  useEffect(() => { if (room.status === 'finished') setScorecardOpen(true); }, [room.status]);
  const feedbackSequence = useRef(0);
  function rejectAction(element, message) {
    setActionFeedback({ id: ++feedbackSequence.current, message });
    if (!element?.isConnected) return;
    element.getAnimations().filter((animation) => animation.id === 'invalid-action').forEach((animation) => animation.cancel());
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animation = element.animate(reducedMotion
      ? [{ outline: '2px solid #d9273f', outlineOffset: '3px' }, { outline: '2px solid #d9273f', outlineOffset: '3px' }]
      : [{ translate: '0' }, { translate: '-6px' }, { translate: '6px' }, { translate: '-4px' }, { translate: '4px' }, { translate: '0' }],
    { duration: 400, easing: 'ease-in-out' });
    animation.id = 'invalid-action';
  }
  function sendGameAction(event, payload, element) {
    return send(event, payload, (message) => rejectAction(element, message));
  }
  const me = room.players.find((player) => player.id === user.id);
  const handKey = me?.hand.map((card) => card.id).join(',');
  useEffect(() => { setSelected([]); setDrawSource('drawPile'); setDiscardCardId(null); }, [handKey, room.turnId, room.round]);
  const discardKey = room.lastPlay.map((card) => card.id).join(',');
  useEffect(() => { setDrawSource('drawPile'); setDiscardCardId(null); }, [discardKey]);
  useEffect(() => {
    const query = window.matchMedia(compactTableQuery);
    const update = () => { setMobile(query.matches); setPanel(null); setControlsOpen(false); swipeStart.current = null; };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!['playing', 'roundEnd'].includes(room.status)) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [room.status, room.turnDeadline, room.nextRoundDeadline]);
  const isHost = room.hostId === user.id;
  const myTurn = room.turnId === user.id && room.status === 'playing';
  const canAct = myTurn && connected && !busy;
  const canShowValue = room.showLimit == null || (me?.value ?? Infinity) <= room.showLimit;
  const seconds = Math.max(0, Math.ceil((room.turnDeadline - now) / 1000));
  // Announce the start of the player's turn: vibration, chime and tab title.
  const wasMyTurn = useRef(false);
  useEffect(() => {
    if (myTurn && !wasMyTurn.current) {
      onMyTurn?.();
      try { navigator.vibrate?.([90, 60, 90]); } catch { /* unsupported */ }
    }
    wasMyTurn.current = myTurn;
  }, [myTurn]);
  useEffect(() => {
    if (!myTurn) return;
    const original = document.title;
    document.title = '🔔 Your turn · 5 Cards';
    return () => { document.title = original; };
  }, [myTurn]);
  const nextRoundSeconds = Math.max(0, Math.ceil(((room.nextRoundDeadline ?? now) - now) / 1000));
  const isWaiting = room.status === 'waiting';
  const isFinished = room.status === 'finished';
  const isAborted = room.status === 'aborted';
  const isRoundEnd = room.status === 'roundEnd';
  const viewerIndex = room.players.findIndex((player) => player.id === user.id);
  const opponents = viewerIndex < 0 ? room.players.filter((player) => player.id !== user.id)
    : [...room.players.slice(viewerIndex + 1), ...room.players.slice(0, viewerIndex)];
  const emptySeats = isWaiting ? Math.max(0, room.capacity - room.players.length) : 0;
  const seatPositions = clockwiseSeatLayouts[opponents.length + emptySeats] || [];
  const turnPlayer = room.players.find((player) => player.id === room.turnId);
  const activeCount = room.players.filter((player) => !player.eliminated).length;
  function dropAndDraw(event) {
    if (!canAct || !selected.length) return;
    if (drawSource === 'none') {
      const top = room.lastPlay.at(-1);
      const selectedCards = selected.map((id) => me.hand.find((card) => card.id === id));
      if (!top || top.rank === 0 || !selected.length || selectedCards.some((card) => card?.rank !== top.rank)) {
        rejectAction(event.currentTarget, 'To skip the draw, drop only cards matching the last discard rank.');
        return;
      }
    } else if (me.hand.length - selected.length + 1 > 5) {
      rejectAction(event.currentTarget, 'Select at least one card to drop before drawing. Your hand cannot exceed 5 cards.');
      return;
    }
    if (drawSource === 'discard' && !room.lastPlay.some((card) => card.id === discardCardId)) {
      rejectAction(event.currentTarget, 'Choose one visible discard card to take.');
      return;
    }
    sendGameAction('game:play', { revision: room.revision, cardIds: selected, drawSource,
      ...(drawSource === 'discard' ? { discardCardId } : {}) }, event.currentTarget);
  }
  function selectCard(card, event) {
    if (selected.includes(card.id)) {
      setSelected((previous) => previous.filter((id) => id !== card.id));
      return;
    }
    const picked = [...selected.map((id) => me.hand.find((entry) => entry.id === id)), card];
    const sameRank = picked.every((entry) => entry.rank === picked[0].rank);
    // With Rummy on, cards of one suit can be collected into a run (checked again on Play).
    const naturals = picked.filter((entry) => entry.rank > 0);
    const runCandidate = room.rules.rummy && picked.length <= 4 && picked.length - naturals.length <= 1
      && naturals.every((entry) => entry.suit === naturals[0].suit);
    if (!sameRank && !runCandidate) {
      rejectAction(event.currentTarget, room.rules.rummy
        ? 'Select cards with the same number, or a Rummy run of 3–4 cards in sequence from one suit.'
        : 'Select only cards with the same number or face. Deselect your cards to choose a different rank.');
      return;
    }
    setSelected((previous) => [...previous, card.id]);
  }
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(room.code);
      notify('Table code copied. Send it to your friends.', 'success');
    } catch {
      notify(`Clipboard unavailable. Share this code: ${room.code}`);
    }
  }
  // Phone tools: shown between Show hand and Play, or in a bottom bar when there is no hand row.
  const tableTools = <>
    <button type="button" aria-label="Open chat" aria-haspopup="dialog" onClick={() => setPanel('chat')}><Icon name="chat" size={18} /><span>Chat</span></button>
    <button type="button" aria-label="Open scoreboard" aria-haspopup="dialog" onClick={() => setPanel('scores')}><Icon name="trophy" size={18} /><span>Scores</span></button>
    {(isRoundEnd || isFinished) && room.results.length > 0 && <button type="button" aria-label="Open round results" aria-haspopup="dialog" onClick={() => setPanel('results')}><Icon name="cards" size={18} /><span>Results</span></button>}
  </>;
  const lastResult = room.results.at(-1);
  const currentResult = lastResult?.round === room.round ? lastResult : null;
  const roundWinners = currentResult?.scores.filter((entry) => entry.penalty === 0) || [];
  const tableReactions = room.chat.filter((message) => reactions.some(([emoji]) => emoji === message.text)).slice(-30);
  return <div className={`game-page table-experience ${controlsOpen ? 'table-controls-open' : ''} ${room.status === 'playing' ? 'game-playing' : ''} ${isRoundEnd || isFinished ? 'game-outcome' : ''} ${myTurn ? 'my-turn' : ''} ${myTurn && seconds <= 5 ? 'my-turn-urgent' : ''}`}
    onTouchStart={(event) => {
      swipeStart.current = null;
      if (!mobile || panel || event.touches.length !== 1
        || event.target.closest('button, input, textarea, a, .playing-card, [role="dialog"]')) return;
      const touch = event.touches[0];
      swipeStart.current = { x: touch.clientX, y: touch.clientY };
    }}
    onTouchEnd={(event) => {
      const start = swipeStart.current;
      swipeStart.current = null;
      if (!start || event.touches.length || event.changedTouches.length !== 1) return;
      const touch = event.changedTouches[0];
      const distance = touch.clientY - start.y;
      if (Math.abs(distance) < 45 || Math.abs(distance) <= Math.abs(touch.clientX - start.x) * 1.5) return;
      setControlsOpen(distance > 0);
    }}
    onTouchCancel={() => { swipeStart.current = null; }}>
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{actionFeedback && <span key={actionFeedback.id}>{actionFeedback.message}</span>}</div>
    <div className="rotate-hint"><Icon name="cards" size={32} /><h2>Turn your phone sideways</h2><p>This table is designed for landscape play. Rotate your phone to see your cards and all table controls together.</p></div>
    {mobile && !controlsOpen && <button className="table-controls-handle" aria-label="Show table code and Leave controls" aria-expanded={false} aria-controls="table-heading" onClick={() => setControlsOpen(true)}><span /></button>}
    <div id="table-heading" className="game-heading" hidden={mobile && !controlsOpen}><div><span className="eyebrow">{isWaiting ? 'YOUR NEXT GREAT CARD NIGHT' : `ROUND ${room.round} · ${room.deckCount} DECK${room.deckCount === 1 ? '' : 'S'}`}</span><h1>{room.name}</h1></div>
      <div className="game-heading-actions"><button className="code-badge" onClick={copyCode} title="Copy table code">{room.code}<Icon name="copy" size={15} /></button>
        <button className="icon-button" aria-label="Game rules" onClick={onRules}><Icon name="book" /></button>
        {isHost && (room.status === 'playing' || isRoundEnd) && <button className="button button-danger button-small" disabled={busy || !connected}
          onClick={(event) => {
            if (window.confirm('Abort this game for everyone? No scores or match history will be saved. This cannot be undone.')) {
              sendGameAction('game:abort', { revision: room.revision }, event.currentTarget);
            }
          }}><Icon name="close" size={16} /> Abort game</button>}
        <button className="button button-outline button-small table-leave" disabled={busy || !connected} onClick={() => {
          if ((isWaiting || isFinished || isAborted) || window.confirm('Leave this match? You cannot rejoin it, and your opponents will continue playing.')) send('room:leave', {});
        }}><Icon name="exit" size={16} /> Leave</button>
        {mobile && <button className="table-controls-close" aria-label="Hide table controls" aria-expanded={true} aria-controls="table-heading" onClick={() => setControlsOpen(false)}><Icon name="close" size={16} /></button>}
      </div>
    </div>
    {!connected && <div className="inline-warning" role="status">Connection interrupted. Reconnecting automatically; your seat is reserved.</div>}
    <div className="game-layout">
      <div className="game-main">
        <div className="felt-table" ref={feltRef}>
          <div className="table-reactions">{tableReactions.map((message) => {
            const origin = message.userId === user.id ? [50, 86]
              : seatPositions[opponents.findIndex((player) => player.id === message.userId)];
            return origin ? <TableReaction key={message.id} message={message} origin={origin} /> : null;
          })}</div>
          <div className="table-grain" />
          <p className="sr-only" role="status">{myTurn ? 'It is your turn.' : ''}</p>
          <div className="opponents">
            {opponents.map((player, index) => <div key={player.id} style={{ '--seat-x': `${seatAt(seatPositions, index)[0]}%`, '--seat-y': `${seatAt(seatPositions, index)[1]}%` }} className={`opponent ${room.turnId === player.id ? 'opponent-active' : ''} ${player.eliminated ? 'eliminated' : ''}`}>
              <div className="opponent-avatar"><Avatar name={player.name} index={room.players.indexOf(player)} /><span className={`presence ${player.connected ? 'online' : ''}`} />
                {!isWaiting && !player.eliminated && <span className="mobile-card-count" aria-label={`${player.name} has ${player.cardCount} ${player.cardCount === 1 ? 'card' : 'cards'}`}><Icon name="cards" size={12} /><b>{player.cardCount}</b></span>}
              </div>
              <b>{player.name}</b><span>{player.eliminated ? 'Watching' : isWaiting ? 'Ready to play' : `${player.cardCount} cards · ${player.score} pts`}</span>
              <span className="player-lives">{player.lives} {player.lives === 1 ? 'life' : 'lives'}</span>
              {!isWaiting && !player.eliminated && <div className="mini-hand">{Array.from({ length: Math.min(player.cardCount, 5) }, (_, i) => <div key={i} />)}{player.cardCount > 5 && <small>+{player.cardCount - 5}</small>}</div>}
            </div>)}
            {isWaiting && Array.from({ length: emptySeats }, (_, index) => <div className="opponent empty-seat" style={{ '--seat-x': `${seatAt(seatPositions, opponents.length + index)[0]}%`, '--seat-y': `${seatAt(seatPositions, opponents.length + index)[1]}%` }} key={`empty-${index}`}><span className="empty-seat-circle"><Icon name="plus" size={22} /></span><b>Seat open</b><span>Invite a friend</span></div>)}
          </div>
          <div className="table-center">
            {isWaiting ? <div className="waiting-center"><span className="table-watermark">5<span>♠</span></span><h2>Good things come in fives.</h2><p>{room.players.length < room.capacity ? `Waiting for ${room.capacity - room.players.length} more player${room.capacity - room.players.length === 1 ? '' : 's'} to fill the table.` : 'All seats are filled. Any seated player can deal the cards.'}</p>
              <button className="button button-accent" disabled={room.players.length < room.capacity || busy || !connected}
                onClick={(event) => sendGameAction('game:start', { revision: room.revision }, event.currentTarget)}><Icon name="cards" size={18} /> Deal the cards</button>
              <span className="table-player-count">{room.players.length} / {room.capacity} players at the table</span>
            </div> : isAborted ? <div className="finished-center"><span className="eyebrow">MATCH CANCELLED</span>
              <h2>This game was aborted.</h2><p>{room.lastAction}</p>
              <button className="button button-accent" disabled={busy || !connected} onClick={() => send('room:leave', {})}>Back to the lobby <Icon name="arrow" size={17} /></button>
            </div> : isFinished ? <div className="finished-center">
              <WrongShowNotice result={currentResult} />
              <WinnerCelebration key={`match-${room.round}`} winners={room.winnerHands || []} round={room.round} match />
              {!room.winnerIds.length && <h2>Match complete. No players remain.</h2>}
              <button className="button button-outline" onClick={() => setScorecardOpen(true)}><Icon name="trophy" size={16} /> Scorecard</button>
              <button className="button button-accent" disabled={busy} onClick={() => send('room:leave', {})}>Back to the lobby <Icon name="arrow" size={17} /></button>
            </div> : isRoundEnd ? <div className="waiting-center">
              <WrongShowNotice result={currentResult} />
              <WinnerCelebration key={`round-${room.round}`} winners={roundWinners} round={room.round} />
              {!roundWinners.length && <><span className="round-done">ROUND {room.round} COMPLETE</span><h2>No zero-point winner this round.</h2></>}
              <span className="waiting-host" role="timer" aria-label="Next round countdown">{nextRoundSeconds > 0 ? `Next round starts in ${nextRoundSeconds}s` : 'Dealing the next round…'}</span>
            </div> : <><div className="pile-group"><div>
              <button type="button" className="pile-choice" aria-label="Choose draw pile" aria-pressed={drawSource === 'drawPile'} disabled={!canAct} onClick={() => setDrawSource('drawPile')}><Card back /></button>
              <span>DRAW PILE · {room.drawCount}</span></div>
              <div className="discard-stack"><div className="discard-choices" role="group" aria-label="Latest dropped cards: choose one">
                {room.lastPlay.map((card) => <button key={card.id} type="button" className="pile-choice"
                  aria-label={`Take ${card.suit === 'joker' ? 'Joker' : `${rankLabel(card.rank)} of ${card.suit}`} from latest discard`}
                  aria-pressed={drawSource === 'discard' && discardCardId === card.id} disabled={!canAct}
                  onClick={() => { setDrawSource('discard'); setDiscardCardId(card.id); }}><Card card={card} /></button>)}
                {!room.lastPlay.length && <div className="empty-discard">No discard</div>}
              </div><span>LAST DROP{room.lastPlay.length > 1 ? ` · CHOOSE 1 OF ${room.lastPlay.length}` : ''}</span></div>
              {room.rules.continuation && <div>
                <button type="button" className="pile-choice" aria-label="Skip drawing (continuation: drop cards matching the last discard rank)" aria-pressed={drawSource === 'none'} disabled={!canAct} onClick={() => { setDrawSource('none'); setDiscardCardId(null); }}><div className="empty-discard">NO DRAW</div></button>
                <span>CONTINUATION</span></div>}</div>
              <p className="pile-choice-hint" role="status">{myTurn ? `Tap a pile to choose · ${drawSource === 'discard' ? 'Last discard selected' : drawSource === 'none' ? 'No draw (continuation) selected' : 'Draw pile selected'}` : 'Choose a pile on your turn.'}</p>
              <div className={`turn-indicator ${myTurn ? 'your-turn' : ''}`}><span className="turn-dot" />{myTurn ? 'Your move. Make it count.' : `${turnPlayer?.name} has the turn`}<span className={seconds <= 3 ? 'timer-urgent' : ''}><Icon name="clock" size={14} />{seconds}s</span></div>
            </>}
          </div>
          <div className="felt-bottom"><span>5 CARDS SOCIAL CLUB</span><span>{isWaiting ? 'LESS IS ALWAYS MORE' : `${activeCount} PLAYERS IN THE GAME`}</span></div>
        <section className="hand-panel">
          <div className="hand-heading"><div className={`your-hand-title ${myTurn ? 'your-hand-active' : ''}`}><Avatar name={user.name} small /><div><h3>Your hand {me?.eliminated && <span className="muted">· Watching</span>}</h3><p>{isWaiting ? 'The best seat in the house.' : myTurn ? 'Select cards to drop, or draw one.' : isRoundEnd || isFinished ? 'A fresh hand is a fresh start.' : 'Plan your next move.'}</p></div></div>
            {!isWaiting && <div className="hand-total"><span>HAND VALUE</span><b>{me?.value ?? 0}<small>pts</small></b></div>}
          </div>
          <p className="hand-lives" role="status">{me?.lives} {me?.lives === 1 ? 'life' : 'lives'} remaining{me?.lives === 0 ? ' · Missed-turn limit reached. You are now watching.' : ''}</p>
          <div className="your-cards">
            {isWaiting ? Array.from({ length: 5 }, (_, index) => <Card key={index} back small />) : [...(me?.hand || [])].sort((a, b) => a.rank - b.rank || a.suit.localeCompare(b.suit)).map((card) => <Card key={card.id} card={card} selected={selected.includes(card.id)} onClick={canAct ? (event) => selectCard(card, event) : undefined} />)}
            {me?.eliminated && <p className="muted">You’re out of this match. Stay for the conversation.</p>}
            {room.status === 'playing' && me && !me.eliminated && !me.hand.length && <p className="muted">You dropped your last card — 0 points locked in. The round plays on without you.</p>}
          </div>
          {room.status === 'playing' && !me?.eliminated && <div className="hand-actions"><span className="selection-note" role="status">{selected.length ? `${selected.length} selected · Tap again to put back` : 'Tap cards to select. Tap again to put back.'}</span>
            {canShowValue ? <button className="button button-outline hand-show" disabled={!canAct} onClick={(event) => {
              if (!room.showUnlocked) { rejectAction(event.currentTarget, 'Every active player must complete a turn before showing a hand.'); return; }
              if (selected.length) { rejectAction(event.currentTarget, 'Deselect your cards before showing your hand.'); return; }
              sendGameAction('game:show', { revision: room.revision }, event.currentTarget);
            }}>Show hand</button> : <span className="hand-show-locked">Show at {room.showLimit} pts or less</span>}
            {mobile && <div className="hand-tools" role="group" aria-label="Table tools">{tableTools}</div>}
            <button className="button button-dark hand-play" disabled={!canAct || !selected.length}
              title={canAct && !selected.length ? 'Select at least one card to drop' : undefined} onClick={dropAndDraw}>
              {busy ? 'Playing…' : 'Play'}<Icon name="arrow" size={16} /></button>
          </div>}
          {mobile && !(room.status === 'playing' && !me?.eliminated) && !(isRoundEnd || isFinished || isAborted)
            && <div className="hand-actions"><div className="hand-tools" role="group" aria-label="Table tools">{tableTools}</div></div>}
          {room.lastAction && <p className="last-action" role="status"><span />{room.lastAction}</p>}
        </section>
        </div>
        {!mobile && (isRoundEnd || isFinished) && room.results.length > 0 && <Results result={room.results.at(-1)} />}
        <div className="active-rules"><span>TABLE RULES</span>{room.showLimit != null && <span className="rule-chip">Show ≤ {room.showLimit} pts</span>}{Object.entries(room.rules).filter(([rule, enabled]) => enabled && rule !== 'anyCard').map(([rule]) => <span className="rule-chip" key={rule}>{ruleLabels[rule]}</span>)}<button className="text-button" onClick={onRules}>Rulebook <Icon name="arrow" size={14} /></button></div>
      </div>
      {!mobile && <aside className="game-sidebar"><Scoreboard room={room} user={user} /><Chat room={room} user={user} send={send} busy={busy} connected={connected} text={chatText} setText={setChatText} /></aside>}
    </div>
    {mobile && (isRoundEnd || isFinished || isAborted) && <nav className="game-dock game-dock-row" aria-label="Table tools">{tableTools}</nav>}
    {mobile && panel && <Modal className={`game-tool-modal ${panel === 'chat' ? 'game-chat-modal' : ''}`} title={panel === 'chat' ? 'Table chat' : panel === 'scores' ? 'Scores' : 'Round results'}
      notification={notification} onClose={() => setPanel(null)}>
      {panel === 'chat' ? <Chat compact room={room} user={user} send={send} busy={busy} connected={connected} text={chatText} setText={setChatText} />
        : panel === 'scores' ? <Scoreboard room={room} user={user} /> : <Results result={room.results.at(-1)} />}
    </Modal>}
    {isFinished && scorecardOpen && <MatchScorecard room={room} user={user} busy={busy} notify={notify}
      onClose={() => setScorecardOpen(false)} onLeave={() => send('room:leave', {})} />}
  </div>;
}
