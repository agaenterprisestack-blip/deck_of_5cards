import { useEffect, useRef, useState } from 'react';
import { Avatar, Card, Icon, ruleLabels } from './components.jsx';

function Chat({ room, user, send, busy }) {
  const [text, setText] = useState('');
  const messages = useRef(null);
  useEffect(() => {
    if (messages.current) messages.current.scrollTop = messages.current.scrollHeight;
  }, [room.chat.length, room.chat.at(-1)?.id]);
  return <section className="chat-panel"><div className="chat-heading"><h3><Icon name="chat" size={18} /> Table talk</h3><span>Keep it friendly</span></div>
    <div className="chat-messages" ref={messages} role="log" aria-label="Table chat" aria-live="polite">
      {!room.chat.length && <div className="chat-empty"><span>✳</span><p>A little banter makes<br />a better card night.</p></div>}
      {room.chat.map((message) => <div key={message.id} className={`chat-message ${message.userId === user.id ? 'own-message' : ''}`}>
        <div><b>{message.userId === user.id ? 'You' : message.name}</b><time>{new Date(message.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div><p>{message.text}</p>
      </div>)}
    </div>
    <form className="chat-form" onSubmit={async (event) => {
      event.preventDefault();
      if (await send('chat:send', { text })) setText('');
    }}><label htmlFor="chat-message" className="sr-only">Message the table</label>
      <input id="chat-message" value={text} onChange={(event) => setText(event.target.value)} placeholder="Say something nice…" maxLength={280} required autoComplete="off" />
      <button className="icon-button" type="submit" aria-label="Send message" disabled={busy || !text.trim()}><Icon name="arrow" size={18} /></button>
    </form>
  </section>;
}

function Scoreboard({ room, user }) {
  return <section className="score-panel"><div className="chat-heading"><h3><Icon name="trophy" size={18} /> Scoreboard</h3><span>Out at {room.pointsToEliminate}</span></div>
    {[...room.players].sort((a, b) => a.score - b.score).map((player, index) => <div className={`score-row ${player.eliminated ? 'eliminated' : ''}`} key={player.id}>
      <span className="score-rank">{index + 1}</span><Avatar name={player.name} index={room.players.indexOf(player)} small />
      <div className="score-player"><b>{player.name}{player.id === user.id ? ' (you)' : ''}</b><span>{player.eliminated ? 'Eliminated' : player.id === room.hostId ? 'Host' : player.connected ? 'At the table' : 'Reconnecting'}</span></div><b className="score-value">{player.score}</b>
    </div>)}
  </section>;
}

function Results({ result }) {
  return <div className="round-results"><h3>{result.clash ? 'A clash at the table.' : 'The cards are on the table.'}</h3><p>{result.message}</p>
    <div className="result-rows">{result.scores.map((entry) => <div className="result-row" key={entry.id}>
      <div className="result-name"><b>{entry.name}</b><span>{entry.eliminated ? 'Eliminated' : `${entry.value} in hand`}</span></div>
      <div className="revealed-cards">{entry.hand.map((card) => <Card small key={card.id} card={card} />)}</div>
      <span className={`penalty ${entry.penalty ? 'penalty-added' : ''}`}>+{entry.penalty}</span>
    </div>)}</div>
  </div>;
}

export default function Game({ room, user, send, busy, connected, onRules, notify }) {
  const [selected, setSelected] = useState([]);
  const [drawSource, setDrawSource] = useState('drawPile');
  const [now, setNow] = useState(Date.now());
  const me = room.players.find((player) => player.id === user.id);
  const handKey = me?.hand.map((card) => card.id).join(',');
  useEffect(() => { setSelected([]); setDrawSource('drawPile'); }, [handKey, room.turnId, room.round]);
  useEffect(() => { if (!room.discard) setDrawSource('drawPile'); }, [room.discard]);
  useEffect(() => {
    if (room.status !== 'playing') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [room.status]);
  const isHost = room.hostId === user.id;
  const myTurn = room.turnId === user.id && room.status === 'playing';
  const canAct = myTurn && connected && !busy;
  const seconds = Math.max(0, Math.ceil((room.turnDeadline - now) / 1000));
  const isWaiting = room.status === 'waiting';
  const isFinished = room.status === 'finished';
  const isAborted = room.status === 'aborted';
  const isRoundEnd = room.status === 'roundEnd';
  const opponents = room.players.filter((player) => player.id !== user.id);
  const turnPlayer = room.players.find((player) => player.id === room.turnId);
  const activeCount = room.players.filter((player) => !player.eliminated).length;
  function dropAndDraw() {
    if (!canAct) return;
    if (me.hand.length - selected.length + 1 > 5) {
      notify('Select at least one card to drop before drawing. Your hand cannot exceed 5 cards.');
      return;
    }
    send('game:play', { revision: room.revision, cardIds: selected, drawSource });
  }
  function selectCard(card) {
    if (selected.includes(card.id)) {
      setSelected((previous) => previous.filter((id) => id !== card.id));
      return;
    }
    const first = me.hand.find((entry) => entry.id === selected[0]);
    if (first && first.rank !== card.rank) {
      notify('Select only cards with the same number or face. Deselect your cards to choose a different rank.');
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
  return <div className="game-page">
    <div className="game-heading"><div><span className="eyebrow">{isWaiting ? 'YOUR NEXT GREAT CARD NIGHT' : `ROUND ${room.round} · ${room.deckCount} DECK${room.deckCount === 1 ? '' : 'S'}`}</span><h1>{room.name}</h1></div>
      <div className="game-heading-actions"><button className="code-badge" onClick={copyCode} title="Copy table code">{room.code}<Icon name="copy" size={15} /></button>
        <button className="icon-button" aria-label="Game rules" onClick={onRules}><Icon name="book" /></button>
        {isHost && (room.status === 'playing' || isRoundEnd) && <button className="button button-danger button-small" disabled={busy || !connected}
          onClick={() => {
            if (window.confirm('Abort this game for everyone? No scores or match history will be saved. This cannot be undone.')) {
              send('game:abort', { revision: room.revision });
            }
          }}><Icon name="close" size={16} /> Abort game</button>}
        {(isWaiting || isFinished || isAborted) && <button className="button button-outline button-small" disabled={busy || !connected} onClick={() => send('room:leave', {})}><Icon name="exit" size={16} /> Leave</button>}
      </div>
    </div>
    {!connected && <div className="inline-warning" role="status">Connection interrupted. Reconnecting automatically; your seat is reserved.</div>}
    <div className="game-layout">
      <div className="game-main">
        <div className="felt-table">
          <div className="table-grain" />
          <div className="opponents">
            {opponents.map((player) => <div key={player.id} className={`opponent ${room.turnId === player.id ? 'opponent-active' : ''} ${player.eliminated ? 'eliminated' : ''}`}>
              <div className="opponent-avatar"><Avatar name={player.name} index={room.players.indexOf(player)} /><span className={`presence ${player.connected ? 'online' : ''}`} /></div>
              <b>{player.name}</b><span>{player.eliminated ? 'Watching' : isWaiting ? 'Ready to play' : `${player.cardCount} cards · ${player.score} pts`}</span>
              {!isWaiting && !player.eliminated && <div className="mini-hand">{Array.from({ length: Math.min(player.cardCount, 5) }, (_, i) => <div key={i} />)}{player.cardCount > 5 && <small>+{player.cardCount - 5}</small>}</div>}
            </div>)}
            {isWaiting && Array.from({ length: Math.max(0, 3 - room.players.length) }, (_, index) => <div className="opponent empty-seat" key={`empty-${index}`}><span className="empty-seat-circle"><Icon name="plus" size={22} /></span><b>Seat open</b><span>Invite a friend</span></div>)}
          </div>
          <div className="table-center">
            {isWaiting ? <div className="waiting-center"><span className="table-watermark">5<span>♠</span></span><h2>Good things come in fives.</h2><p>{room.players.length < 3 ? `Waiting for ${3 - room.players.length} more player${room.players.length === 1 ? 's' : ''} to begin.` : 'Everyone’s here. Let the good times begin.'}</p>
              {isHost ? <button className="button button-accent" disabled={room.players.length < 3 || busy || !connected}
                onClick={() => send('game:start', { revision: room.revision })}><Icon name="cards" size={18} /> Deal the cards</button> : <span className="waiting-host">Waiting for the host to deal…</span>}
              <span className="table-player-count">{room.players.length} / {room.capacity} players at the table</span>
            </div> : isAborted ? <div className="finished-center"><span className="eyebrow">MATCH CANCELLED</span>
              <h2>This game was aborted.</h2><p>{room.lastAction}</p>
              <button className="button button-accent" disabled={busy || !connected} onClick={() => send('room:leave', {})}>Back to the lobby <Icon name="arrow" size={17} /></button>
            </div> : isFinished ? <div className="finished-center"><span className="winner-trophy"><Icon name="trophy" size={42} /></span><span className="eyebrow">THAT’S A WRAP</span>
              <h2>{room.winnerIds.includes(user.id) ? 'A little less. A big win.' : 'Well played, everyone.'}</h2>
              <p>{room.players.filter((player) => room.winnerIds.includes(player.id)).map((player) => player.name).join(' & ')} {room.winnerIds.length > 1 ? 'share the win' : 'takes the win'}.</p>
              <button className="button button-accent" disabled={busy} onClick={() => send('room:leave', {})}>Back to the lobby <Icon name="arrow" size={17} /></button>
            </div> : isRoundEnd ? <div className="waiting-center"><span className="round-done">ROUND {room.round} COMPLETE</span><h2>{room.results.at(-1)?.clash ? 'A little too close.' : 'One round wiser.'}</h2><p>{room.lastAction}</p>
              {isHost ? <div className="round-actions"><button className="button button-accent" disabled={busy || !connected} onClick={() => send('game:start', { revision: room.revision })}>Deal next round <Icon name="arrow" size={17} /></button>
                <button className="table-text-button" disabled={busy || !connected} onClick={() => send('game:finish', { revision: room.revision })}>Finish match at current scores</button></div>
                : <span className="waiting-host">Waiting for the host to deal the next round…</span>}
            </div> : <><div className="pile-group"><div>
              <button type="button" className="pile-choice" aria-label="Choose draw pile" aria-pressed={drawSource === 'drawPile'} disabled={!canAct} onClick={() => setDrawSource('drawPile')}><Card back /></button>
              <span>DRAW PILE · {room.drawCount}</span></div>
              <div className="discard-stack">{room.lastPlay.length > 1 && <div className="discard-under"><Card card={room.lastPlay[0]} /></div>}
                <button type="button" className="pile-choice" aria-label="Choose last discard" aria-pressed={drawSource === 'discard'} disabled={!canAct || !room.discard} onClick={() => setDrawSource('discard')}>
                  {room.discard ? <Card card={room.discard} /> : <div className="empty-discard">No discard</div>}
                </button><span>LAST DISCARD{room.lastPlay.length > 1 ? ` · ${room.lastPlay.length} CARDS` : ''}</span></div></div>
              <p className="pile-choice-hint" role="status">{myTurn ? `Tap a pile to choose · ${drawSource === 'discard' ? 'Last discard selected' : 'Draw pile selected'}` : 'Choose a pile on your turn.'}</p>
              <div className={`turn-indicator ${myTurn ? 'your-turn' : ''}`}><span className="turn-dot" />{myTurn ? 'Your move. Make it count.' : `${turnPlayer?.name} has the turn`}<span className={seconds <= 3 ? 'timer-urgent' : ''}><Icon name="clock" size={14} />{seconds}s</span></div>
            </>}
          </div>
          <div className="felt-bottom"><span>5 CARDS SOCIAL CLUB</span><span>{isWaiting ? 'LESS IS ALWAYS MORE' : `${activeCount} PLAYERS IN THE GAME`}</span></div>
        </div>

        <section className="hand-panel">
          <div className="hand-heading"><div className={`your-hand-title ${myTurn ? 'your-hand-active' : ''}`}><Avatar name={user.name} small /><div><h3>Your hand {me?.eliminated && <span className="muted">· Watching</span>}</h3><p>{isWaiting ? 'The best seat in the house.' : myTurn ? 'Select cards to drop, or draw one.' : isRoundEnd || isFinished ? 'A fresh hand is a fresh start.' : 'Plan your next move.'}</p></div></div>
            {!isWaiting && <div className="hand-total"><span>HAND VALUE</span><b>{me?.value ?? 0}<small>pts</small></b></div>}
          </div>
          <div className="your-cards">
            {isWaiting ? Array.from({ length: 5 }, (_, index) => <Card key={index} back small />) : [...(me?.hand || [])].sort((a, b) => a.rank - b.rank || a.suit.localeCompare(b.suit)).map((card) => <Card key={card.id} card={card} selected={selected.includes(card.id)} onClick={canAct ? () => selectCard(card) : undefined} />)}
            {me?.eliminated && <p className="muted">You’re out of this match. Stay for the conversation.</p>}
          </div>
          {room.status === 'playing' && !me?.eliminated && <div className="hand-actions"><span className="selection-note" role="status">{selected.length ? `${selected.length} card${selected.length === 1 ? '' : 's'} selected · Same number or face only` : `${me.hand.length >= 5 ? 'You have 5 cards. Select at least one to drop before drawing. ' : ''}${room.showUnlocked ? 'Show any hand value at the start of your turn.' : 'Show unlocks after everyone completes one turn this round.'}`}</span>
            <button className="button button-outline hand-show" disabled={!canAct || !room.showUnlocked || selected.length > 0} onClick={() => send('game:show', { revision: room.revision })}>Show hand</button>
            <button className="button button-dark hand-play" disabled={!canAct} onClick={dropAndDraw}>
              {busy ? 'Playing…' : 'Drop & draw'}<Icon name="arrow" size={16} /></button>
          </div>}
          {room.lastAction && <p className="last-action" role="status"><span />{room.lastAction}</p>}
        </section>
        {(isRoundEnd || isFinished) && room.results.length > 0 && <Results result={room.results.at(-1)} />}
        <div className="active-rules"><span>TABLE RULES</span>{Object.entries(room.rules).filter(([, enabled]) => enabled).map(([rule]) => <span className="rule-chip" key={rule}>{ruleLabels[rule]}</span>)}<button className="text-button" onClick={onRules}>Rulebook <Icon name="arrow" size={14} /></button></div>
      </div>
      <aside className="game-sidebar"><Scoreboard room={room} user={user} /><Chat room={room} user={user} send={send} busy={busy} /></aside>
    </div>
  </div>;
}
