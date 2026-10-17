import { useEffect, useRef, useState } from 'react';
import { Avatar, Card, Icon, Modal, rankLabel, ruleLabels } from './components.jsx';

const compactTableQuery = '(max-width: 1100px)';
const seatPositions = [[50, 10], [9, 29], [91, 29], [9, 67], [91, 67], [28, 10], [72, 10], [9, 48], [91, 48]];
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
  return <section className="score-panel"><div className="chat-heading"><h3><Icon name="trophy" size={18} /> Scoreboard</h3><span>Out at {room.pointsToEliminate}</span></div>
    {[...room.players].sort((a, b) => a.score - b.score).map((player, index) => <div className={`score-row ${player.eliminated ? 'eliminated' : ''}`} key={player.id}>
      <span className="score-rank">{index + 1}</span><Avatar name={player.name} index={room.players.indexOf(player)} small />
      <div className="score-player"><b>{player.name}{player.id === user.id ? ' (you)' : ''}</b><span>{player.eliminated ? 'Eliminated' : player.id === room.hostId ? 'Host' : player.connected ? 'At the table' : 'Reconnecting'} · {player.lives} lives</span></div><b className="score-value">{player.score}</b>
    </div>)}
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

function WrongShowNotice({ result }) {
  if (!result?.showingId || result.successful) return null;
  const showing = result.scores.find((entry) => entry.id === result.showingId);
  return <div className="wrong-show-notice" role="status">
    <span className="wrong-show-emoji" aria-hidden="true">😅</span>
    <div><strong>Wrong show — {showing.name}</strong><span>{result.clash ? 'Clash! Same hand total.' : 'Oops! Someone has a lower hand.'} <b>+{showing.penalty} points</b></span></div>
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

export default function Game({ room, user, send, busy, connected, onRules, notify, notification }) {
  const [selected, setSelected] = useState([]);
  const [chatText, setChatText] = useState('');
  const [panel, setPanel] = useState(null);
  const [mobile, setMobile] = useState(() => window.matchMedia(compactTableQuery).matches);
  const [controlsOpen, setControlsOpen] = useState(false);
  const swipeStart = useRef(null);
  const [drawSource, setDrawSource] = useState('drawPile');
  const [discardCardId, setDiscardCardId] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [actionFeedback, setActionFeedback] = useState(null);
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
  const seconds = Math.max(0, Math.ceil((room.turnDeadline - now) / 1000));
  const nextRoundSeconds = Math.max(0, Math.ceil(((room.nextRoundDeadline ?? now) - now) / 1000));
  const isWaiting = room.status === 'waiting';
  const isFinished = room.status === 'finished';
  const isAborted = room.status === 'aborted';
  const isRoundEnd = room.status === 'roundEnd';
  const opponents = room.players.filter((player) => player.id !== user.id);
  const turnPlayer = room.players.find((player) => player.id === room.turnId);
  const activeCount = room.players.filter((player) => !player.eliminated).length;
  function dropAndDraw(event) {
    if (!canAct) return;
    if (me.hand.length - selected.length + 1 > 5) {
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
    const first = me.hand.find((entry) => entry.id === selected[0]);
    if (first && first.rank !== card.rank) {
      rejectAction(event.currentTarget, 'Select only cards with the same number or face. Deselect your cards to choose a different rank.');
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
  const lastResult = room.results.at(-1);
  const currentResult = lastResult?.round === room.round ? lastResult : null;
  const roundWinners = currentResult?.scores.filter((entry) => entry.penalty === 0) || [];
  const tableReactions = room.chat.filter((message) => reactions.some(([emoji]) => emoji === message.text)).slice(-30);
  return <div className={`game-page table-experience ${controlsOpen ? 'table-controls-open' : ''} ${room.status === 'playing' ? 'game-playing' : ''} ${isRoundEnd || isFinished ? 'game-outcome' : ''}`}
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
        <div className="felt-table">
          <div className="table-reactions">{tableReactions.map((message) => {
            const origin = message.userId === user.id ? [50, 86]
              : seatPositions[opponents.findIndex((player) => player.id === message.userId)];
            return origin ? <TableReaction key={message.id} message={message} origin={origin} /> : null;
          })}</div>
          <div className="table-grain" />
          <div className="opponents">
            {opponents.map((player, index) => <div key={player.id} style={{ '--seat-x': `${seatPositions[index][0]}%`, '--seat-y': `${seatPositions[index][1]}%` }} className={`opponent ${room.turnId === player.id ? 'opponent-active' : ''} ${player.eliminated ? 'eliminated' : ''}`}>
              <div className="opponent-avatar"><Avatar name={player.name} index={room.players.indexOf(player)} /><span className={`presence ${player.connected ? 'online' : ''}`} />
                {!isWaiting && !player.eliminated && <span className="mobile-card-count" aria-label={`${player.name} has ${player.cardCount} ${player.cardCount === 1 ? 'card' : 'cards'}`}><Icon name="cards" size={12} /><b>{player.cardCount}</b></span>}
              </div>
              <b>{player.name}</b><span>{player.eliminated ? 'Watching' : isWaiting ? 'Ready to play' : `${player.cardCount} cards · ${player.score} pts`}</span>
              <span className="player-lives">{player.lives} {player.lives === 1 ? 'life' : 'lives'}</span>
              {!isWaiting && !player.eliminated && <div className="mini-hand">{Array.from({ length: Math.min(player.cardCount, 5) }, (_, i) => <div key={i} />)}{player.cardCount > 5 && <small>+{player.cardCount - 5}</small>}</div>}
            </div>)}
            {isWaiting && Array.from({ length: Math.max(0, 2 - room.players.length) }, (_, index) => <div className="opponent empty-seat" style={{ '--seat-x': `${seatPositions[opponents.length + index][0]}%`, '--seat-y': `${seatPositions[opponents.length + index][1]}%` }} key={`empty-${index}`}><span className="empty-seat-circle"><Icon name="plus" size={22} /></span><b>Seat open</b><span>Invite a friend</span></div>)}
          </div>
          <div className="table-center">
            {isWaiting ? <div className="waiting-center"><span className="table-watermark">5<span>♠</span></span><h2>Good things come in fives.</h2><p>{room.players.length < 2 ? 'Waiting for 1 more player to begin.' : 'Ready to begin. The host can deal when everyone has joined.'}</p>
              {isHost ? <button className="button button-accent" disabled={room.players.length < 2 || busy || !connected}
                onClick={(event) => sendGameAction('game:start', { revision: room.revision }, event.currentTarget)}><Icon name="cards" size={18} /> Deal the cards</button> : <span className="waiting-host">Waiting for the host to deal…</span>}
              <span className="table-player-count">{room.players.length} / {room.capacity} players at the table</span>
            </div> : isAborted ? <div className="finished-center"><span className="eyebrow">MATCH CANCELLED</span>
              <h2>This game was aborted.</h2><p>{room.lastAction}</p>
              <button className="button button-accent" disabled={busy || !connected} onClick={() => send('room:leave', {})}>Back to the lobby <Icon name="arrow" size={17} /></button>
            </div> : isFinished ? <div className="finished-center">
              <WrongShowNotice result={currentResult} />
              <WinnerCelebration key={`match-${room.round}`} winners={room.winnerHands || []} round={room.round} match />
              {!room.winnerIds.length && <h2>Match complete. No players remain.</h2>}
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
              </div><span>LAST DROP{room.lastPlay.length > 1 ? ` · CHOOSE 1 OF ${room.lastPlay.length}` : ''}</span></div></div>
              <p className="pile-choice-hint" role="status">{myTurn ? `Tap a pile to choose · ${drawSource === 'discard' ? 'Last discard selected' : 'Draw pile selected'}` : 'Choose a pile on your turn.'}</p>
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
          </div>
          {room.status === 'playing' && !me?.eliminated && <div className="hand-actions"><span className="selection-note" role="status">{selected.length ? `${selected.length} selected · Tap again to put back` : 'Tap cards to select. Tap again to put back.'}</span>
            <button className="button button-outline hand-show" disabled={!canAct} onClick={(event) => {
              if (!room.showUnlocked) { rejectAction(event.currentTarget, 'Every active player must complete a turn before showing a hand.'); return; }
              if (selected.length) { rejectAction(event.currentTarget, 'Deselect your cards before showing your hand.'); return; }
              sendGameAction('game:show', { revision: room.revision }, event.currentTarget);
            }}>Show hand</button>
            <button className="button button-dark hand-play" disabled={!canAct} onClick={dropAndDraw}>
              {busy ? 'Playing…' : 'Drop & draw'}<Icon name="arrow" size={16} /></button>
          </div>}
          {room.lastAction && <p className="last-action" role="status"><span />{room.lastAction}</p>}
        </section>
        </div>
        {!mobile && (isRoundEnd || isFinished) && room.results.length > 0 && <Results result={room.results.at(-1)} />}
        <div className="active-rules"><span>TABLE RULES</span>{Object.entries(room.rules).filter(([, enabled]) => enabled).map(([rule]) => <span className="rule-chip" key={rule}>{ruleLabels[rule]}</span>)}<button className="text-button" onClick={onRules}>Rulebook <Icon name="arrow" size={14} /></button></div>
      </div>
      {!mobile && <aside className="game-sidebar"><Scoreboard room={room} user={user} /><Chat room={room} user={user} send={send} busy={busy} connected={connected} text={chatText} setText={setChatText} /></aside>}
    </div>
    {mobile && <nav className="game-dock" aria-label="Table tools">
      <button aria-label="Open chat" aria-haspopup="dialog" onClick={() => setPanel('chat')}><Icon name="chat" /><span>Chat</span></button>
      <button aria-label="Open scoreboard" aria-haspopup="dialog" onClick={() => setPanel('scores')}><Icon name="trophy" /><span>Scores</span></button>
      {(isRoundEnd || isFinished) && room.results.length > 0 && <button aria-label="Open round results" aria-haspopup="dialog" onClick={() => setPanel('results')}><Icon name="cards" /><span>Results</span></button>}
      <button aria-label="Open rulebook" aria-haspopup="dialog" onClick={onRules}><Icon name="book" /><span>Rules</span></button>
    </nav>}
    {mobile && panel && <Modal className={`game-tool-modal ${panel === 'chat' ? 'game-chat-modal' : ''}`} title={panel === 'chat' ? 'Table chat' : panel === 'scores' ? 'Scores' : 'Round results'}
      notification={notification} onClose={() => setPanel(null)}>
      {panel === 'chat' ? <Chat compact room={room} user={user} send={send} busy={busy} connected={connected} text={chatText} setText={setChatText} />
        : panel === 'scores' ? <Scoreboard room={room} user={user} /> : <Results result={room.results.at(-1)} />}
    </Modal>}
  </div>;
}
