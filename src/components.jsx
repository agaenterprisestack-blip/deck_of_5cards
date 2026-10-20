import { useEffect, useRef, useState } from 'react';
import * as deck from '@letele/playing-cards';

const iconPaths = {
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 4v2" /></>,
  cards: <><rect x="7" y="3" width="13" height="17" rx="2" /><path d="m7 7-4 1a2 2 0 0 0-1 2l3 11a2 2 0 0 0 2 1l7-2M13.5 8l3 4-3 4-3-4z" /></>,
  trophy: <><path d="M8 3h8v5a4 4 0 0 1-8 0zM8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 12v7M8 21h8M9 19h6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  book: <><path d="M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1zM12 5v15" /></>,
  chat: <path d="M21 11a9 9 0 0 1-9 9 10 10 0 0 1-4-1l-5 2 1-5a9 9 0 1 1 17-5z" />,
  exit: <><path d="M9 4H4v16h5M13 8l4 4-4 4M8 12h13" /></>,
  copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V3H3v13h5" /></>,
  sound: <><path d="m11 4-6 5H2v6h3l6 5zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" /></>,
  mute: <><path d="m11 4-6 5H2v6h3l6 5zM16 9l6 6M16 15l6-6" /></>,
  fullscreen: <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" />,
  minimize: <path d="M3 8h5V3M21 8h-5V3M8 21v-5H3M16 21v-5h5" />,
};

export function Icon({ name, size = 20, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{iconPaths[name] || iconPaths.cards}</svg>;
}

export function FullscreenButton({ notify, compact = false }) {
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  const label = fullscreen ? 'Exit fullscreen' : 'Enter fullscreen';
  return <button className={compact ? undefined : 'icon-button'} aria-label={label} title={label}
    aria-pressed={fullscreen} disabled={busy} onClick={async () => {
      if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) {
        notify('Fullscreen is not supported in this browser. Try opening the game in Chrome on Android.');
        return;
      }
      setBusy(true);
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch (error) {
        notify(`Could not change fullscreen mode: ${error.message}`);
      } finally { setBusy(false); }
    }}>
    <Icon name={fullscreen ? 'minimize' : 'fullscreen'} />
    {compact && <span>{fullscreen ? 'Exit full' : 'Full screen'}</span>}
  </button>;
}

export function Logo() {
  return <span className="brand"><span className="brand-mark">5<span>♠</span></span><span>5 Cards<span className="brand-dot">.</span></span></span>;
}

export function Avatar({ name = '?', index = 0, small = false }) {
  return <span className={`avatar avatar-${index % 5} ${small ? 'avatar-small' : ''}`} aria-hidden="true">
    {name.trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join('').toUpperCase()}
  </span>;
}

export const rankLabel = (rank) => ({ 0: 'JK', 1: 'A', 11: 'J', 12: 'Q', 13: 'K' })[rank] || rank;

const suitKeys = { hearts: 'H', diamonds: 'D', clubs: 'C', spades: 'S' };
const rankKeys = { 1: 'a', 11: 'j', 12: 'q', 13: 'k' };
const faceFor = (card) => card.suit === 'joker'
  ? deck.J1
  : deck[`${suitKeys[card.suit]}${rankKeys[card.rank] || card.rank}`];

export function Card({ card, back = false, selected = false, onClick, small = false, style }) {
  const joker = !back && card?.suit === 'joker';
  const className = `playing-card ${back ? 'card-back' : ''} ${small ? 'card-small' : ''} ${selected ? 'card-selected' : ''} ${joker ? 'card-joker' : ''} ${['hearts', 'diamonds'].includes(card?.suit) ? 'card-red' : ''}`;
  const Face = back ? null : faceFor(card);
  const face = back
    ? <span className="card-back-pattern"><span>5<span>♠</span></span></span>
    : <Face className="card-face-art" />;
  return onClick
    ? <button className={className} style={style} onClick={onClick} aria-pressed={selected}
      aria-label={`${joker ? 'Joker' : `${rankLabel(card.rank)} of ${card.suit}`}${selected ? ', selected' : ''}`}>{face}</button>
    : <div className={className} style={style} aria-label={back ? 'Face-down card' : joker ? 'Joker' : `${rankLabel(card.rank)} of ${card.suit}`}>{face}</div>;
}

export function Modal({ title, subtitle, onClose, children, notification, className = '' }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);
  return <dialog ref={dialog} className={`modal ${className}`} onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === dialog.current) onClose(); }} aria-labelledby="modal-title">
    <div className="modal-inner">
      <button className="icon-button modal-close" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button>
      <span className="eyebrow">THE TABLE IS WAITING</span>
      <h2 id="modal-title">{title}</h2>
      {subtitle && <p className="muted">{subtitle}</p>}
      {notification && <p className={notification.type === 'error' ? 'form-error modal-notification' : 'muted modal-notification'}
        role={notification.type === 'error' ? 'alert' : 'status'}>{notification.message}</p>}
      {children}
    </div>
  </dialog>;
}

export const ruleLabels = {
  anyCard: 'Any card', sameNumber: 'Same number', rummy: 'Rummy', continuation: 'Continuation',
};

export function RulesContent() {
  return <div className="rules-content">
    <div className="rule-intro"><span className="rule-number">5</span><p>Five cards in your hand.<br /><strong>One goal: keep it low.</strong></p></div>
    <section><h3>01 / Take your seat</h3><p>2–10 players. Everyone receives 5 cards and one card starts the discard pile. Seats follow join order clockwise; your own seat stays at the bottom of your screen. The dealer moves one active seat clockwise each round, and play begins with the next active player. 2–3 players use 1 deck, 4–5 use 2, 6–8 use 3, and 9–10 use 4. Each deck includes 2 jokers.</p></section>
    <section><h3>02 / Make your move</h3><p>Select one card or multiple cards with the same number or face (such as two 7s or two Kings). Tap a selected card again to deselect it. Tap the draw pile or any one face-up card in the latest dropped group; your choice is highlighted. All cards in a multi-card drop are shown in the center. Confirm with Drop &amp; draw to take exactly one card, never a card you are dropping this turn. A new drop covers older groups. If you do not drop, the unclaimed cards in the latest group remain available; taking its last card does not uncover older cards. Covered cards are recycled when the draw pile runs out, while the whole visible group stays on the table. Drop &amp; draw stays on the right and is enabled on your turn when connected and not submitting. Hands never exceed 5 cards: with 5 cards, tapping without selecting cards prompts you to select at least one to drop. Below 5, you may draw without dropping. If no visible discard remains, that choice is unavailable. Show hand stays on the left. Each player has 30 seconds per turn and 5 lives for the entire match. Every timeout costs one life. While lives remain, a hand with 5 cards is skipped unchanged, while a hand below 5 automatically takes one card from the draw pile; these turns count towards unlocking Show hand. On the fifth timeout, you are eliminated and stay as a spectator with chat access. Lives do not reset between rounds or after playing a turn. The last active player wins.</p>
      <ul><li><strong>Any card:</strong> drop any single card.</li><li><strong>Same number:</strong> drop a group of equal ranks, or one card matching the top discard.</li><li><strong>Rummy:</strong> drop a set of 3–4 equal ranks in different suits. Mixed-rank runs are not allowed.</li><li><strong>Continuation:</strong> a single card one rank above the top discard in the same suit.</li></ul>
      <p>Aces are low. Jokers score 0 but are not wildcards. The host can toggle rules before creating a table.</p></section>
    <section><h3>03 / Know when to show</h3><p>Everyone must complete one turn in each dealt round before anyone can show. After that, you may show any hand value at the start of your turn. A unique lowest showing player adds 0; everyone else adds their own hand value. A wrong show adds 50 to the showing player, the lowest hand or tied lowest hands add 0, and every other player adds their own hand value. Points are added to cumulative match scores, not used to reset them.</p></section>
    <section><h3>04 / The long game</h3><p>At the table’s selected points limit (any whole number from 50 to 1,001; default 201), you are eliminated and can watch. The last player standing wins. After each round, the next round is dealt automatically following a 15-second countdown; only the first round needs the host to start it. Matches cannot be finished early at current scores. The host can still abort without saving scores. Finished or aborted matches do not restart. If all draw and recyclable discard cards run out, lowest hands get 0 and the others get +50.</p></section>
    <div className="value-strip"><span>Joker <b>0</b></span><span>Ace <b>1</b></span><span>2–10 <b>Face value</b></span><span>J / Q / K <b>10 each</b></span></div>
    <p className="fine-print">Anyone can leave at any time. Leaving during a match forfeits your participation and prevents rejoining that match; the others continue with their existing cards and scores. The last active player wins. Host ownership transfers when the host leaves, and the table is removed when its last participant leaves. Disconnecting alone keeps your seat reserved for reconnecting. The host can also abort during or between rounds after confirmation, ending the game for everyone without saving scores or match history. Waiting tables expire 45 minutes after creation if the match has not started, even with players online. Joining and chat do not extend that deadline. Non-waiting tables expire after 30 minutes offline without room activity. Active tables are held in memory and reset if the backend restarts.</p>
  </div>;
}
