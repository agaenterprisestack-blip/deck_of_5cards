import { useEffect, useRef, useState } from 'react';

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
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></>,
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
        const apple = /iPhone|iPad|iPod/.test(navigator.userAgent)
          || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        notify(apple
          ? 'iPhone and iPad browsers cannot go fullscreen. Tap Share, then "Add to Home Screen", and open 5 Cards from your home screen to play fullscreen.'
          : 'Fullscreen is not supported in this browser. Try opening the game in Chrome on Android.');
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

const suitSymbols = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const cardSerif = "Georgia, 'Times New Roman', serif";

const skin = '#f4d3b5';
const skinLine = '#c99a76';
const gold = '#e0a93a';
const goldLine = '#a87a2c';

// Card face built for small screens: one large top-left rank and suit (no
// upside-down corner, so 6 and 9 never get confused) and one big center suit.
function CardFace({ card, className }) {
  const red = ['hearts', 'diamonds'].includes(card.suit);
  const color = red ? '#cf2435' : '#1b1d21';
  const suit = suitSymbols[card.suit];
  const label = String(rankLabel(card.rank));
  return <svg className={className} viewBox="0 0 100 144" aria-hidden="true">
    <rect width="100" height="144" fill="#fff" />
    <rect x="3" y="3" width="94" height="138" rx="7" fill="none" stroke="#e7e2d8" strokeWidth="1.2" />
    <g fill={color} fontFamily={cardSerif} fontWeight="700" textAnchor="middle">
      <text x="17" y="35" fontSize={label.length > 1 ? 29 : 35} letterSpacing={label.length > 1 ? -2.5 : 0}>{label}</text>
      <text x="17" y="62" fontSize="27">{suit}</text>
    </g>
    <text x="58" y={card.rank === 1 ? 118 : 112} textAnchor="middle" fontSize={card.rank === 1 ? 72 : 60} fill={color}>{suit}</text>
  </svg>;
}

// Joker: same layout as the other cards, with a jester portrait.
function JokerFace({ className }) {
  const purple = '#6a3fa0';
  const green = '#1f8a5b';
  return <svg className={className} viewBox="0 0 100 144" aria-hidden="true">
    <rect width="100" height="144" fill="#fff" />
    <rect x="3" y="3" width="94" height="138" rx="7" fill="none" stroke="#e7e2d8" strokeWidth="1.2" />
    <rect x="35" y="14" width="57" height="122" rx="9" fill="#f5effb" stroke={purple} strokeWidth="1.4" />
    <path d="M39 132 C39 110 50 102 63 102 C76 102 87 110 87 132 Z" fill={green} />
    <path d="M62 102 L62 132" stroke={purple} strokeWidth="6" />
    <path d="M40 101 L45 109 L50 101 L55 109 L60 101 L65 109 L70 101 L75 109 L80 101 L84 106 L40 106 Z" fill="#fff" stroke={purple} strokeWidth="1" strokeLinejoin="round" />
    <circle cx="62" cy="86" r="12.5" fill={skin} stroke={skinLine} strokeWidth="1" />
    <circle cx="57.5" cy="84" r="1.4" fill="#2b2523" /><circle cx="66.5" cy="84" r="1.4" fill="#2b2523" />
    <circle cx="54.5" cy="89" r="2.2" fill="#f08a96" opacity=".7" /><circle cx="69.5" cy="89" r="2.2" fill="#f08a96" opacity=".7" />
    <path d="M56 90 Q62 96 68 90" stroke="#c0283a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    <path d="M50 76 C46 65 42 57 40 49 C47 53 53 60 57 72 Z" fill={purple} />
    <path d="M74 76 C78 65 82 57 84 49 C77 53 71 60 67 72 Z" fill={green} />
    <path d="M54 74 C56 58 59 44 62 30 C65 44 68 58 70 74 Z" fill={purple} />
    <path d="M62 30 C65 44 68 58 70 74 L62 74 Z" fill={green} />
    <rect x="48" y="70" width="28" height="7" rx="3" fill={gold} stroke={goldLine} strokeWidth=".8" />
    <g fill={gold} stroke={goldLine} strokeWidth=".8"><circle cx="40" cy="48" r="3.6" /><circle cx="84" cy="48" r="3.6" /><circle cx="62" cy="29" r="3.8" /></g>
    <g fill={purple} fontFamily={cardSerif} fontWeight="700" textAnchor="middle">
      <text x="17" y="33" fontSize="25" letterSpacing="-2">JK</text>
      <text x="17" y="58" fontSize="22" fill={gold}>★</text>
    </g>
  </svg>;
}

export function Card({ card, back = false, selected = false, onClick, small = false, style }) {
  const joker = !back && card?.suit === 'joker';
  const className = `playing-card ${back ? 'card-back' : ''} ${small ? 'card-small' : ''} ${selected ? 'card-selected' : ''} ${joker ? 'card-joker' : ''} ${['hearts', 'diamonds'].includes(card?.suit) ? 'card-red' : ''}`;
  const face = back
    ? <span className="card-back-pattern"><span>5<span>♠</span></span></span>
    : joker ? <JokerFace className="card-face-art" /> : <CardFace card={card} className="card-face-art card-face-custom" />;
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
    <section><h3>01 / Take your seat</h3><p>2–10 players. The first deal unlocks only when every seat at the table is filled; any seated player can then deal. Everyone receives 5 cards and one card starts the discard pile. Seats follow join order clockwise; your own seat stays at the bottom of your screen. The dealer moves one active seat clockwise each round, and play begins with the next active player. 2–3 players use 1 deck, 4–5 use 2, 6–8 use 3, and 9–10 use 4. Each deck includes 2 jokers.</p></section>
    <section><h3>02 / Make your move</h3><p>Select one card or multiple cards with the same number or face (such as two 7s or two Kings), or with Rummy on, a run of 3–4 cards in sequence from one suit. Tap a selected card again to deselect it. Tap the draw pile or any one face-up card in the latest dropped group; your choice is highlighted. All cards in a multi-card drop are shown in the center. Confirm with Play to take exactly one card, never a card you are dropping this turn. A new drop covers older groups. If you do not drop, the unclaimed cards in the latest group remain available; taking its last card does not uncover older cards. Covered cards are recycled when the draw pile runs out, while the whole visible group stays on the table. Play stays on the right and is enabled on your turn when connected and not submitting. Hands never exceed 5 cards: every turn you must drop at least one card, so Play stays disabled until you select one. If no visible discard remains, that choice is unavailable. Show hand stays on the left. Each player has 15 seconds per turn and 5 lives for the entire match. Every timeout costs one life. While lives remain, a timed-out turn is skipped with your hand unchanged (no drop, no draw); these turns count towards unlocking Show hand. On the fifth timeout, you are eliminated and stay as a spectator with chat access. Lives do not reset between rounds or after playing a turn. The last active player wins.</p>
      <ul><li><strong>Single card:</strong> you can always drop any one card, on every table.</li><li><strong>Same number:</strong> drop a group of equal ranks, or one card matching the top discard.</li><li><strong>Rummy:</strong> drop a run of 3–4 cards in sequence from the same suit, such as 5♠ 6♠ 7♠, then draw one card as usual. Aces are low (A-2-3), runs do not wrap from King to Ace. One Joker can stand in for any single missing card, such as Joker 2♠ 3♠ or 5♠ Joker 7♠.</li><li><strong>Continuation:</strong> drop one or more cards matching the top discard’s rank and skip the draw — tap No draw, or draw as usual if you prefer. Jokers cannot be continued. Dropping your last cards this way locks in 0 points for the round; the others play on, and when only one player still holds cards, the round ends and they add their hand value.</li></ul>
      <p>Aces are low. Jokers score 0 and are only wild inside a Rummy run (one per run). The host can toggle rules before creating a table.</p></section>
    <section><h3>03 / Know when to show</h3><p>Everyone must complete one turn in each dealt round before anyone can show. After that, you may show at the start of your turn if your hand is within the table's show limit: 5 points, 10 points, or any value, chosen by the host when creating the table. The Show hand button appears only when your hand qualifies. A unique lowest showing player adds 0; everyone else adds their own hand value. A wrong show adds 50 to the showing player, the lowest hand or tied lowest hands add 0, and every other player adds their own hand value. Points are added to cumulative match scores, not used to reset them.</p></section>
    <section><h3>04 / The long game</h3><p>At the table’s selected points limit (any whole number from 50 to 1,001; default 201), you are eliminated and can watch. The last player standing wins. When the match ends, any player still at the table can choose Play again: everyone returns to the waiting room with the same table and rules, and scores and lives start fresh. After each round, the next round is dealt automatically following a 10-second countdown; only the first round needs the host to start it. Matches cannot be finished early at current scores. The host can still abort without saving scores. Finished or aborted matches do not restart. If all draw and recyclable discard cards run out, lowest hands get 0 and the others get +50.</p></section>
    <div className="value-strip"><span>Joker <b>0</b></span><span>Ace <b>1</b></span><span>2–10 <b>Face value</b></span><span>J / Q / K <b>10 each</b></span></div>
    <p className="fine-print">Anyone can leave at any time. Leaving during a match forfeits your participation and prevents rejoining that match; the others continue with their existing cards and scores. The last active player wins. Host ownership transfers when the host leaves, and the table is removed when its last participant leaves. Disconnecting alone keeps your seat reserved for reconnecting. The host can also abort during or between rounds after confirmation, ending the game for everyone without saving scores or match history. Waiting tables expire 45 minutes after creation if the match has not started, even with players online. Joining and chat do not extend that deadline. Non-waiting tables expire after 30 minutes offline without room activity. Active tables are held in memory and reset if the backend restarts.</p>
  </div>;
}
