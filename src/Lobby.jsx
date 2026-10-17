import { useState } from 'react';
import { Avatar, Card, Icon, ruleLabels } from './components.jsx';

export default function Lobby({ user, rooms, onCreate, onJoin, onRules, connected, onSignIn }) {
  const [code, setCode] = useState('');
  const [filter, setFilter] = useState('all');
  const joinable = rooms.filter((room) => room.status === 'waiting');
  const filtered = joinable.filter((room) => filter !== 'open' || room.count < room.capacity);
  return <>
    <section className="hero">
      <div className="hero-text">
        <span className="eyebrow"><span className="tiny-diamond">♦</span> GOOD COMPANY. GREAT HANDS.</span>
        <h1>A little luck.<br />A lot <em>less.</em></h1>
        <p>Bring your friends. Play your cards.<br className="desktop-break" /> Keep your score low and the good times rolling.</p>
        <button className="button button-dark" onClick={user ? onCreate : onSignIn}>
          <Icon name="plus" size={18} /> {user ? 'Create a table' : 'Let’s play'} <Icon name="arrow" size={18} />
        </button>
        <div className="hero-details"><span><Icon name="users" size={15} /> 3–10 players</span><span className="detail-dot" /><span>Free to play. Made for friends.</span></div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
        <span className="floating-suit suit-one">♣</span><span className="floating-suit suit-two">♦</span>
        <div className="hero-card hero-card-back"><Card back /></div>
        <div className="hero-card hero-card-king"><Card card={{ rank: 13, suit: 'spades' }} /></div>
        <div className="hero-card hero-card-ace"><Card card={{ rank: 1, suit: 'hearts' }} /></div>
        <span className="hero-sticker"><span>LESS IS</span><b>MORE</b><span>EST. 2026</span></span>
        <span className="handwritten">Your kind of card night.</span>
      </div>
    </section>

    <div className="lobby-layout">
      <section className="tables-section">
        <div className="section-heading"><div><span className="eyebrow">FIND YOUR PEOPLE</span><h2>Take a seat<span className="count-pill">{joinable.length}</span></h2></div>
          <div className={`connection-label ${connected ? '' : 'offline'}`}><span />{connected ? 'Live tables' : user ? 'Connecting' : 'Enter your name to join'}</div>
        </div>
        <div className="table-toolbar"><div className="filter-tabs">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All tables</button>
          <button className={filter === 'open' ? 'active' : ''} onClick={() => setFilter('open')}>Open seats</button>
        </div><span className="toolbar-note">A good hand starts with a good table.</span></div>
        <div className="room-list">
          {filtered.map((room, index) => <article className="room-list-item" key={room.code}>
            <span className={`table-symbol symbol-${index % 3}`}>{['♠', '♥', '♣'][index % 3]}</span>
            <div className="room-description"><h3>{room.name}</h3><p>Hosted by {room.host}<span> · </span>{Object.entries(room.rules).filter(([, enabled]) => enabled).map(([rule]) => ruleLabels[rule]).slice(0, 2).join(' + ')}</p></div>
            <div className="room-occupancy"><Icon name="users" size={17} /><b>{room.count}</b><span>/ {room.capacity}</span></div>
            <button className="button button-outline button-small" disabled={room.count >= room.capacity}
              onClick={() => user ? onJoin(room.code) : onSignIn()}>{room.count >= room.capacity ? 'Full' : 'Join table'}<Icon name="arrow" size={15} /></button>
          </article>)}
          {!filtered.length && <div className="empty-tables">
            <div className="empty-card-stack"><Card small back /><Card small card={{ rank: 1, suit: 'spades' }} /></div>
            <h3>{user ? 'Be the first at the table.' : 'Your next card night starts here.'}</h3>
            <p>{user ? 'Create a room, share the code, and get your people together.' : 'Enter your name, start a table, and invite a few familiar faces.'}</p>
            <button className="text-button" onClick={user ? onCreate : onSignIn}>{user ? 'Start a new table' : 'Get in on the game'} <Icon name="arrow" size={16} /></button>
          </div>}
        </div>
        <div className="table-bottom-note"><span>♣</span> No stakes. No pressure. Just one more round.</div>
      </section>

      <aside className="lobby-sidebar">
        <section className="join-panel">
          <span className="panel-icon"><Icon name="users" size={23} /></span>
          <h3>Got an invite?</h3><p>Your friends saved you a seat.<br />Enter their table code to join.</p>
          <form onSubmit={(event) => { event.preventDefault(); user ? onJoin(code) : onSignIn(); }}>
            <label className="sr-only" htmlFor="table-code">Six-character table code</label>
            <div className="code-input-wrap"><input id="table-code" placeholder="TABLE CODE" value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())} minLength={6} maxLength={6} pattern="[A-Z2-9]{6}" required autoComplete="off" />
              <button type="submit" aria-label="Join table with code"><Icon name="arrow" size={20} /></button></div>
          </form>
        </section>
        <section className="learn-panel"><div className="learn-top"><span>NEW TO THE TABLE?</span><Icon name="book" size={20} /></div>
          <h3>Small hand.<br />Big possibilities.</h3><p>Five cards, a few simple rules,<br />and a healthy bit of rivalry.</p>
          <button className="text-button" onClick={onRules}>Learn the game <Icon name="arrow" size={16} /></button>
        </section>
      </aside>
    </div>
    <section className="features-strip">
      <div><span className="feature-icon"><Icon name="cards" size={23} /></span><div><h4>Easy to pick up</h4><p>Five cards. Countless ways to play.</p></div></div>
      <div><span className="feature-icon"><Icon name="users" size={23} /></span><div><h4>Better together</h4><p>Across the table or across the world.</p></div></div>
      <div><span className="feature-icon"><Icon name="trophy" size={23} /></span><div><h4>Low score. High spirits.</h4><p>Choose your points limit. Stay in the game.</p></div></div>
    </section>
  </>;
}

export function Leaderboard({ entries, loading }) {
  return <section className="data-page"><span className="eyebrow">A LITTLE FRIENDLY COMPETITION</span><h1>The low-score club.</h1><p className="muted">Completed matches. Bragging rights earned, never bought.</p>
    {loading ? <p className="loading-state" role="status">Loading the leaderboard…</p> : entries.length ? <div className="leaderboard-list">
      <div className="leaderboard-row leaderboard-heading"><span>Rank</span><span>Player</span><span>Wins</span><span>Played</span><span>Avg. score</span></div>
      {entries.map((entry, index) => <div className="leaderboard-row" key={entry.id}><b className="rank-number">{String(index + 1).padStart(2, '0')}</b><span className="leaderboard-name"><Avatar name={entry.name} index={index} small /><b>{entry.name}</b></span><b>{entry.wins}</b><span>{entry.played}</span><span>{entry.average}</span></div>)}
    </div> : <div className="data-empty"><Icon name="trophy" size={36} /><h3>A fresh scoreboard.</h3><p>Finish a match to earn your place here.</p></div>}
  </section>;
}

export function History({ entries, user, loading }) {
  return <section className="data-page"><span className="eyebrow">YOUR CORNER OF THE TABLE</span><h1>Good to see you, {user.name}.</h1><p className="muted">Your last 20 completed matches, all in one place.</p>
    {loading ? <p className="loading-state" role="status">Loading your matches…</p> : !entries.length ? <div className="data-empty"><Icon name="clock" size={36} /><h3>Every player starts somewhere.</h3><p>Your completed matches will appear here.</p></div> :
      <div className="history-list">{entries.map((entry) => <article className="history-item" key={entry.id}>
        <span className={`history-result ${entry.won ? 'won' : ''}`}><Icon name={entry.won ? 'trophy' : 'cards'} /></span>
        <div><h3>{entry.won ? 'A win for the books' : 'Another good card night'}</h3><p>Table {entry.room_code} · {new Date(entry.completed_at).toLocaleDateString()} · {entry.results.length} rounds</p></div>
        <span className="history-score">{entry.score}<small>points</small></span>
      </article>)}</div>}
  </section>;
}
