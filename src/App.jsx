import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { request, SERVER_URL } from './api.js';
import { Avatar, Icon, Logo, Modal, RulesContent, ruleLabels } from './components.jsx';
import Lobby, { History, Leaderboard } from './Lobby.jsx';
import Game from './Game.jsx';

function AuthForm({ onAuthenticated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <>
    <form className="form-stack" onSubmit={async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      setBusy(true); setError('');
      try { onAuthenticated(await request('/guest', { method: 'POST', body: JSON.stringify(data) })); }
      catch (failure) { setError(failure.message); }
      finally { setBusy(false); }
    }}>
      <label>Your name<input name="name" placeholder="What should we call you?" minLength={1} maxLength={24} autoComplete="nickname" required autoFocus /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-dark button-full" disabled={busy}>{busy ? 'One moment…' : 'Let’s play'}<Icon name="arrow" size={17} /></button>
      <p className="fine-print">No email or password. Refresh this tab to keep your seat. A new session creates a new player, even with the same name.</p>
    </form>
  </>;
}

function CreateForm({ send, busy, onDone }) {
  const [rules, setRules] = useState({ anyCard: true, sameNumber: true, rummy: true, continuation: true });
  const [capacity, setCapacity] = useState(5);
  const [pointsToEliminate, setPointsToEliminate] = useState(201);
  return <form className="form-stack" onSubmit={async (event) => {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get('name');
    if (await send('room:create', { name, capacity, pointsToEliminate, rules })) onDone();
  }}>
    <label>Table name<input name="name" placeholder="The usual suspects" minLength={2} maxLength={36} required autoFocus /></label>
    <label>Seats at the table<span className="capacity-picker">{Array.from({ length: 8 }, (_, i) => i + 3).map((count) =>
      <button key={count} type="button" aria-pressed={capacity === count} className={capacity === count ? 'active' : ''} onClick={() => setCapacity(count)}>{count}</button>)}</span></label>
    <label>Points to eliminate<span className="points-picker">{[101, 201, 401, 1001].map((points) =>
      <button key={points} type="button" aria-pressed={pointsToEliminate === points}
        className={pointsToEliminate === points ? 'active' : ''} onClick={() => setPointsToEliminate(points)}>{points}</button>)}</span></label>
    <fieldset className="rule-options"><legend>Your house rules</legend>{Object.entries(rules).map(([rule, enabled]) => <label key={rule}>
      <span>{ruleLabels[rule]}</span><input type="checkbox" checked={enabled} onChange={(event) => setRules((previous) => ({ ...previous, [rule]: event.target.checked }))} />
    </label>)}</fieldset>
    <p className="fine-print">At least 3 players to begin. The deck count adjusts automatically. Share the code after creating your table.</p>
    <button className="button button-dark button-full" disabled={busy || !Object.values(rules).some(Boolean)}>{busy ? 'Setting the table…' : 'Create my table'}<Icon name="arrow" size={17} /></button>
  </form>;
}

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('five-cards-token') || '');
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(Boolean(token));
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [room, setRoom] = useState(null);
  const [modal, setModal] = useState(null);
  const [page, setPage] = useState('play');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [health, setHealth] = useState(null);
  const [backendError, setBackendError] = useState('');
  const [data, setData] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [sound, setSound] = useState(false);
  const audioContext = useRef(null);
  const notify = useCallback((message, type = 'error') => setToast({ message, type, id: Date.now() }), []);
  const clearSession = useCallback(() => {
    sessionStorage.removeItem('five-cards-token');
    setToken(''); setUser(null); setRoom(null); setRooms([]); setPage('play'); setSocket(null);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    let active = true;
    request('/health').then((value) => {
      if (active) { setHealth(value); setBackendError(''); }
    }).catch((error) => { if (active) setBackendError(`Backend unavailable: ${error.message}`); });
    return () => { active = false; };
  }, [refresh]);
  useEffect(() => {
    if (!token) { setRestoring(false); return; }
    let active = true;
    request('/me', { token }).then(({ user: currentUser }) => {
      if (active) setUser(currentUser);
    }).catch((error) => {
      if (!active) return;
      if (error.status === 401) clearSession();
      notify(error.message);
    }).finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, [token, refresh, notify, clearSession]);
  useEffect(() => {
    if (!token || !user) return;
    const connection = io(SERVER_URL || undefined, { auth: { token }, autoConnect: false });
    connection.on('connect', () => { setConnected(true); setBackendError(''); });
    connection.on('disconnect', (reason) => {
      setConnected(false);
      if (reason === 'io server disconnect') {
        clearSession(); notify('Your session ended. Enter your name to play again.');
      }
    });
    connection.on('connect_error', (error) => {
      setConnected(false);
      if (error.data?.code === 'AUTH_REQUIRED') {
        clearSession(); setModal('auth'); notify(error.message);
      } else setBackendError(error.message);
    });
    connection.on('lobby', setRooms);
    connection.on('room', setRoom);
    connection.on('server:error', ({ error }) => notify(error));
    setSocket(connection);
    connection.connect();
    return () => { connection.removeAllListeners(); connection.disconnect(); setConnected(false); };
  }, [token, user?.id, notify, clearSession]);
  useEffect(() => {
    if (!user || !token || page === 'play') return;
    let active = true;
    setDataLoading(true); setDataError(''); setData([]);
    request(page === 'leaderboard' ? '/leaderboard' : '/history', { token }).then((value) => { if (active) setData(value); })
      .catch((error) => { if (active) setDataError(error.message); })
      .finally(() => { if (active) setDataLoading(false); });
    return () => { active = false; };
  }, [page, user?.id, token, refresh]);
  async function send(event, payload) {
    if (!socket?.connected) { notify('You are not connected yet. Please wait or reconnect.'); return false; }
    if (busy) return false;
    setBusy(true);
    try {
      const response = await socket.timeout(10_000).emitWithAck(event, payload);
      if (response.code === 'AUTH_REQUIRED') { clearSession(); setModal('auth'); }
      if (!response.ok) throw new Error(response.error);
      if (sound && event.startsWith('game:') && audioContext.current) {
        try {
          const context = audioContext.current;
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.connect(gain); gain.connect(context.destination);
          oscillator.frequency.setValueAtTime(520, context.currentTime);
          gain.gain.setValueAtTime(0.045, context.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.14);
          oscillator.start(); oscillator.stop(context.currentTime + 0.15);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        } catch (error) {
          setSound(false); notify(`Move completed, but game sound failed: ${error.message}`);
        }
      }
      return true;
    } catch (error) {
      notify(error.message === 'operation has timed out' ? 'No confirmation received. Check the latest table state before retrying.' : error.message);
      return false;
    } finally { setBusy(false); }
  }
  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await request('/logout', { token, method: 'POST' });
      socket?.disconnect();
      clearSession();
    } catch (error) {
      if (error.status === 401) clearSession();
      notify(error.message);
    }
    finally { setBusy(false); }
  }
  const signIn = () => setModal('auth');
  function navigate(next) {
    if (!user && next !== 'play') { signIn(); return; }
    setPage(next);
    if (next !== 'play') setRefresh((value) => value + 1);
  }
  async function toggleSound() {
    if (sound) { setSound(false); return; }
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('This browser does not support game sounds.');
      audioContext.current ||= new Audio();
      await audioContext.current.resume();
      setSound(true);
    } catch (error) { notify(error.message); }
  }
  return <div className={`app-shell ${page === 'play' && room && user ? 'app-in-game' : ''}`}>
    <header className="site-header"><div className="header-inner">
      <button className="logo-button" aria-label="5 Cards home" onClick={() => navigate('play')}><Logo /></button>
      <nav className="main-nav" aria-label="Main navigation">
        <button className={page === 'play' ? 'nav-active' : ''} onClick={() => navigate('play')}>Play<span className="nav-dot" /></button>
        <button className={page === 'leaderboard' ? 'nav-active' : ''} onClick={() => navigate('leaderboard')}>Leaderboard</button>
        <button onClick={() => setModal('rules')}>How to play <span className="nav-arrow">↗</span></button>
      </nav>
      <div className="header-account">
        <button className="icon-button sound-toggle" aria-label={sound ? 'Mute game sounds' : 'Enable game sounds'} aria-pressed={sound} onClick={toggleSound}><Icon name={sound ? 'sound' : 'mute'} size={18} /></button>
        {restoring ? <span className="fine-print">Reconnecting…</span> : user ? <>
          <button className={`profile-button ${page === 'profile' ? 'profile-active' : ''}`} onClick={() => navigate('profile')}><Avatar name={user.name} small /><span>{user.name}</span></button>
          <button className="icon-button logout-button" aria-label="End player session" onClick={logout} disabled={busy}><Icon name="exit" size={17} /></button>
        </> : <button className="button button-outline button-small" onClick={signIn}>Come on in <Icon name="arrow" size={15} /></button>}
      </div>
    </div></header>
    <main className="main-container">
      {backendError && <div className="inline-warning" role="alert"><span>{backendError}</span><button onClick={() => { socket?.connect(); setRefresh((value) => value + 1); }}>Retry connection</button></div>}
      {health?.storage === 'memory' && <div className="dev-banner"><span className="status-dot" />Local play mode<span className="dev-detail"> · Player sessions & history reset when the server restarts. Connect PostgreSQL for persistence.</span></div>}
      {page === 'play' ? room && user ? <Game room={room} user={user} send={send} busy={busy} connected={connected} onRules={() => setModal('rules')} notify={notify} notification={toast} />
        : <Lobby user={user} rooms={rooms} connected={connected} onCreate={() => setModal('create')} onJoin={(code) => send('room:join', { code })} onRules={() => setModal('rules')} onSignIn={signIn} />
        : dataError ? <section className="data-page"><h2>Couldn’t load this page.</h2><p role="alert" className="form-error">{dataError}</p><button className="button button-dark" onClick={() => setRefresh((value) => value + 1)}>Try again</button></section>
          : page === 'leaderboard' ? <Leaderboard entries={data} loading={dataLoading} /> : user && <History entries={data} user={user} loading={dataLoading} />}
    </main>
    <footer className="site-footer"><div><Logo /><span>A little less. A lot more fun.</span></div><p>Made for the love of the game. <span>♠ ♥ ♣ ♦</span></p><button onClick={() => setModal('rules')}>House rules <Icon name="arrow" size={14} /></button></footer>
    {modal === 'auth' && <Modal title="There’s a seat for you." subtitle="Just enter your name. No signup needed." notification={toast} onClose={() => setModal(null)}>
      <AuthForm onAuthenticated={({ user: currentUser, token: newToken }) => {
        sessionStorage.setItem('five-cards-token', newToken); setToken(newToken); setUser(currentUser);
        setModal(null); setPage('play'); notify(`Welcome to the table, ${currentUser.name}.`, 'success');
      }} />
    </Modal>}
    {modal === 'create' && <Modal title="Make it your table." subtitle="A name, a few rules, and your favorite people." notification={toast} onClose={() => setModal(null)}><CreateForm send={send} busy={busy} onDone={() => { setModal(null); setPage('play'); }} /></Modal>}
    {modal === 'rules' && <Modal title="The art of keeping it low." subtitle="Your pocket guide to a very good card night." notification={toast} onClose={() => setModal(null)}><RulesContent /></Modal>}
    {toast && !modal && <div className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}><Icon name={toast.type === 'error' ? 'chat' : 'check'} size={19} /><span>{toast.message}</span><button className="icon-button" onClick={() => setToast(null)} aria-label="Dismiss notification"><Icon name="close" size={16} /></button></div>}
  </div>;
}
