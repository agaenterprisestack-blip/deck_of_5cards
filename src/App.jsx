import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { request, SERVER_URL } from './api.js';
import { Avatar, FullscreenButton, Icon, Logo, Modal, ProfileEditor, RulesContent, TableForm } from './components.jsx';
import Lobby, { History, Leaderboard, heroHeadlines } from './Lobby.jsx';
import Game from './Game.jsx';

function AuthForm({ signup, onSwitch, onAuthenticated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  return <>
    <form className="form-stack" onSubmit={async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      setBusy(true); setError('');
      try { onAuthenticated(await request(signup ? '/signup' : '/login', { method: 'POST',
        body: JSON.stringify({ name: data.name, password: data.password }) })); }
      catch (failure) { setError(failure.message); }
      finally { setBusy(false); }
    }}>
      <label>Username<input name="name" placeholder="Your unique player name" minLength={1} maxLength={24} autoComplete="username" required autoFocus disabled={busy} /></label>
      <label>Password<span className="password-field">
        <input name="password" type={showPassword ? 'text' : 'password'} minLength={signup ? 4 : 1} maxLength={128}
          autoComplete={signup ? 'new-password' : 'current-password'} autoCapitalize="off" autoCorrect="off" spellCheck={false} required disabled={busy} />
        <button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'}
          title={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} disabled={busy}
          onClick={(event) => { event.preventDefault(); setShowPassword((shown) => !shown); }}>
          <Icon name={showPassword ? 'eyeOff' : 'eye'} size={19} /></button>
      </span></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-dark button-full" disabled={busy}>{busy ? 'One moment…' : signup ? 'Create account' : 'Log in'}<Icon name="arrow" size={17} /></button>
      <p className="fine-print">{signup ? 'Usernames are unique regardless of capitalization. Use a password of 4–128 characters. Keep it safe: password recovery is not available yet.' : 'Log in to recover your player profile, scores, and reserved seat.'}</p>
      <button type="button" className="text-button" disabled={busy} onClick={onSwitch}>{signup ? 'Already have an account? Log in' : 'New to the table? Sign up'}</button>
      <button type="button" className="button button-outline button-full" disabled={busy} onClick={async () => {
        setBusy(true); setError('');
        try { onAuthenticated(await request('/guest', { method: 'POST' })); }
        catch (failure) { setError(failure.message); }
        finally { setBusy(false); }
      }}>Continue as guest</button>
      <p className="fine-print">No account needed. You get an automatic guest name and can play normally, but guests do not appear on the leaderboard. After signing out, your guest identity cannot be recovered.</p>
    </form>
  </>;
}


export default function App() {
  const [headlineIndex, setHeadlineIndex] = useState(() => {
    const saved = Number(sessionStorage.getItem('five-cards-headline'));
    return Number.isInteger(saved) && saved >= 0 && saved < heroHeadlines.length ? saved : 0;
  });
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
        clearSession(); notify('Your session ended. Log in to play again.');
      }
    });
    connection.on('connect_error', (error) => {
      setConnected(false);
      if (error.data?.code === 'AUTH_REQUIRED') {
        clearSession(); setPage('login'); notify(error.message);
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
    if (!user || !token || !['leaderboard', 'profile'].includes(page)) return;
    let active = true;
    setDataLoading(true); setDataError(''); setData([]);
    request(page === 'leaderboard' ? '/leaderboard' : '/history', { token }).then((value) => { if (active) setData(value); })
      .catch((error) => { if (active) setDataError(error.message); })
      .finally(() => { if (active) setDataLoading(false); });
    return () => { active = false; };
  }, [page, user?.id, token, refresh]);
  async function send(event, payload, onInvalidAction) {
    if (!socket?.connected) { notify('You are not connected yet. Please wait or reconnect.'); return false; }
    if (busy) return false;
    setBusy(true);
    try {
      const response = await socket.timeout(10_000).emitWithAck(event, payload);
      if (response.code === 'AUTH_REQUIRED') { clearSession(); setPage('login'); }
      if (!response.ok && response.code === 'INVALID_ACTION' && onInvalidAction) {
        onInvalidAction(response.error);
        return false;
      }
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
  const signIn = () => setPage('login');
  const [savingProfile, setSavingProfile] = useState(false);
  async function saveProfile(avatar) {
    setSavingProfile(true);
    try {
      const { user: updated } = await request('/profile', { token, method: 'PUT', body: JSON.stringify({ avatar }) });
      setUser(updated);
      notify('Your table picture is saved.', 'success');
    } catch (error) { notify(error.message); }
    finally { setSavingProfile(false); }
  }
  function navigate(next) {
    if (!user && next !== 'play') { signIn(); return; }
    setPage(next);
    if (next !== 'play') setRefresh((value) => value + 1);
  }
  // Two rising notes when the player's turn begins (only with game sound on).
  function turnChime() {
    const context = audioContext.current;
    if (!sound || !context) return;
    try {
      [660, 880].forEach((frequency, index) => {
        const start = context.currentTime + index * 0.13;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.06, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
        oscillator.start(start); oscillator.stop(start + 0.23);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    } catch { /* A missed chime should never interrupt play. */ }
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
    <div className="neon-backdrop" aria-hidden="true"><span className="neon-orb orb-a" /><span className="neon-orb orb-b" /><span className="neon-floor" /></div>
    <header className="site-header"><div className="header-inner">
      <button className="logo-button" aria-label="5 Cards home" onClick={() => navigate('play')}><Logo /></button>
      <nav className="main-nav" aria-label="Main navigation">
        <button className={page === 'play' ? 'nav-active' : ''} onClick={() => navigate('play')}>Play<span className="nav-dot" /></button>
        <button className={page === 'leaderboard' ? 'nav-active' : ''} onClick={() => navigate('leaderboard')}>Leaderboard</button>
        <button onClick={() => setModal('rules')}>How to play <span className="nav-arrow">↗</span></button>
      </nav>
      <div className="header-account">
        <FullscreenButton notify={notify} />
        <button className="icon-button sound-toggle" aria-label={sound ? 'Mute game sounds' : 'Enable game sounds'} aria-pressed={sound} onClick={toggleSound}><Icon name={sound ? 'sound' : 'mute'} size={18} /></button>
        {restoring ? <span className="fine-print">Reconnecting…</span> : user ? <>
          <button className={`profile-button ${page === 'profile' ? 'profile-active' : ''}`} onClick={() => navigate('profile')}><Avatar name={user.name} avatar={user.avatar} small /><span>{user.name}</span></button>
          <button className="icon-button logout-button" aria-label="End player session" onClick={logout} disabled={busy}><Icon name="exit" size={17} /></button>
        </> : <button className="button button-outline button-small" onClick={signIn}>Log in <Icon name="arrow" size={15} /></button>}
      </div>
    </div></header>
    <main className="main-container">
      {backendError && <div className="inline-warning" role="alert"><span>{backendError}</span><button onClick={() => { socket?.connect(); setRefresh((value) => value + 1); }}>Retry connection</button></div>}
      {health?.storage === 'memory' && <div className="dev-banner"><span className="status-dot" />Local play mode<span className="dev-detail"> · Player sessions & history reset when the server restarts. Connect PostgreSQL for persistence.</span></div>}
      {(page === 'login' || page === 'signup') && !user ? <section className="auth-page">
        <span className="eyebrow">YOUR SEAT AT THE TABLE</span>
        <h1>{page === 'signup' ? 'Create your account.' : 'Welcome back.'}</h1>
        <p>{page === 'signup' ? 'One unique name. Your own cards and scores.' : 'Log in or continue as a guest to join your friends.'}</p>
        <AuthForm key={page} signup={page === 'signup'} onSwitch={() => setPage(page === 'signup' ? 'login' : 'signup')}
          onAuthenticated={({ user: currentUser, token: newToken }) => {
            sessionStorage.setItem('five-cards-token', newToken); setToken(newToken); setUser(currentUser);
            const nextHeadline = (headlineIndex + 1) % heroHeadlines.length;
            sessionStorage.setItem('five-cards-headline', String(nextHeadline));
            setHeadlineIndex(nextHeadline);
            setPage('play'); notify(`Welcome to the table, ${currentUser.name}.`, 'success');
          }} />
      </section> : page === 'play' ? room && user ? <Game room={room} user={user} send={send} busy={busy} connected={connected} onRules={() => setModal('rules')} notify={notify} notification={toast} onMyTurn={turnChime} />
        : <Lobby user={user} rooms={rooms} connected={connected} onCreate={() => setModal('create')} onJoin={(code) => send('room:join', { code })} onRules={() => setModal('rules')} onSignIn={signIn} headlineIndex={headlineIndex} />
        : dataError ? <section className="data-page"><h2>Couldn’t load this page.</h2><p role="alert" className="form-error">{dataError}</p><button className="button button-dark" onClick={() => setRefresh((value) => value + 1)}>Try again</button></section>
          : page === 'leaderboard' ? <Leaderboard entries={data} loading={dataLoading} /> : user && <>
            <ProfileEditor user={user} busy={savingProfile} onSave={saveProfile} />
            <History entries={data} user={user} loading={dataLoading} />
          </>}
    </main>
    <footer className="site-footer"><div><Logo /><span>designed by GpTechstack...</span></div><p>Made for the love of the game. <span>♠ ♥ ♣ ♦</span></p><button onClick={() => setModal('rules')}>House rules <Icon name="arrow" size={14} /></button></footer>
    {modal === 'create' && <Modal title="Make it your table." subtitle="A name, a few rules, and your favorite people." notification={toast} onClose={() => setModal(null)}><TableForm busy={busy}
      onSubmit={async (settings) => { if (await send('room:create', settings)) { setModal(null); setPage('play'); } }} /></Modal>}
    {modal === 'rules' && <Modal title="The art of keeping it low." subtitle="Your pocket guide to a very good card night." notification={toast} onClose={() => setModal(null)}><RulesContent /></Modal>}
    {toast && !modal && <div className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}><Icon name={toast.type === 'error' ? 'chat' : 'check'} size={19} /><span>{toast.message}</span><button className="icon-button" onClick={() => setToast(null)} aria-label="Dismiss notification"><Icon name="close" size={16} /></button></div>}
  </div>;
}
