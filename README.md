# 5 Cards

A responsive, real-time card game for 3–10 friends. Built with React, Tailwind CSS, Express, Socket.IO, and PostgreSQL. No payments or wagering.

## Run locally

Requires Node.js 22.12+ and npm.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`. Enter a name in **three separate browser tabs** (each tab has its own session), create a table, and join with its six-character code. No email, password, signup, or login is needed. The host can deal once three players have joined. To test more seats, choose up to ten when creating a table.

Without `DATABASE_URL`, the server explicitly runs in **development memory mode**: player sessions and completed history disappear on restart. A banner appears in the UI. No external service is needed to try the game.

## What is included

- Name-only guest entry with revocable, seven-day opaque sessions held in tab-scoped storage. Names are display labels, not unique account identifiers.
- Multiple tables, configurable capacity and house rules, invitation codes, host controls.
- Server-authoritative turns and scoring; clients receive only their own private hand.
- Live presence, reconnecting seats, private table chat, and a 10-second turn timer that automatically advances play.
- Round reveals, cumulative scores, elimination, shared wins, and match completion.
- Host-only **Abort game** with confirmation, during or between rounds. All players see the cancellation and can return to the lobby. Aborted matches do not save scores/history or affect leaderboards.
- Profiles with completed-match history and a leaderboard ordered by wins, then average score.
- Responsive game table, keyboard-accessible controls, reduced-motion support, optional synthesized game sounds.

## Agreed rules

These resolve the original brief's unspecified details. They are also available in the in-app rulebook.

| Rule | Behavior |
| --- | --- |
| Setup | 3 players: 1 deck; 4–5: 2; 6–8: 3; 9–10: 4. Two jokers per deck. Deal five cards each and reveal one starter. Dealer rotates each round; play starts after the dealer. |
| Any card | Drop any single card. |
| Same number | Drop a group of matching ranks (including duplicate suits across decks), or a single card matching the top discard's rank. |
| Rummy | Drop a distinct-suit, same-rank set of 3–4. Mixed-rank runs are not allowed. Jokers are not wildcards. |
| Continuation | Drop a single card one rank above the top discard in the same suit. With Any Card enabled this does not further restrict single-card plays. |
| Turn | Tap the draw-pile card or last-discard card directly on the table to select the source (highlighted), then confirm with Drop & draw. Hands never exceed 5 cards: at 5, drop at least one before taking a card from either pile. Below 5, drawing without dropping is allowed. There is no separate source selector. Taking the discard gives only the previous visible top card, never one just dropped; dropped cards become the new discard. An empty discard pile cannot be selected. At timeout, a full hand skips without drawing or changing cards; a hand below 5 draws one from the draw pile. |
| Show | Unlocked after every active player completes one turn in each dealt round, including timed-out draws or skips. Show at the start of your turn with any hand value. A unique lowest showing player adds 0; others add their own hand values. |
| Clash | If anyone matches the showing hand value, the showing player adds 50, matching players add 0, and others add their own hand values. Applies even when someone else has a lower hand. |
| Beaten show | Without a matching hand, a showing player beaten by a lower hand adds 50; everyone else adds their own hand value. |
| Values | Joker 0, Ace 1, numbers face value, Jack 11, Queen 12, King 13. |
| Exhausted pile | Recycle discards, keeping the top card. If no cards remain available, reveal hands: lowest totals, including ties, score 0; others get +50. |
| Elimination | At the table's selected limit (101, 201, 401, or 1001 points; default 201). Eliminated players can watch and chat, but are not dealt cards or scored again. |
| Winning | Last active player wins. The host may finish between rounds; lowest-score active players share the win. |

Rules and the points-to-elimination limit are configurable when creating a table, not during a match. Turn actions include a revision number to reject stale/double submissions.
Round points are added to cumulative match scores; a round award of 0 does not reset previous points. The opening-turn show lock resets on every deal and excludes eliminated players.

Select one card or multiple cards of the same number/face only (for example, two 7s or two Kings). Tap selected cards to deselect them before choosing a different rank. **Show hand** is on the left; **Drop & draw** always remains on the right and is enabled on your connected, idle turn even without a selection. With 5 cards, tapping it without selecting cards displays a prompt instead of drawing; below 5 cards, it draws without dropping. It is disabled while submitting, disconnected, or on another player's turn. Both controls have at least 44px touch targets on mobile. Server validation also rejects mixed-rank multi-card drops.

## PostgreSQL

Create an empty PostgreSQL database, then set:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/five_cards
DATABASE_SSL=disable
```

For hosted databases requiring verified TLS, use `DATABASE_SSL=verify-full` and the connection configuration supplied by your provider. Do not disable certificate verification. Schema initialization runs on startup using [server/schema.sql](server/schema.sql); the database user needs permission to create tables and indexes. No database credentials are shipped to the browser.

Guest player identities, sessions, final scores, and completed match round histories are persisted. Matches are saved transactionally and idempotently; a persistence failure is shown as an error rather than reporting a successful finish.

**Active tables, in-progress scores, and chat are in process memory.** Run exactly one backend instance. A restart resets active tables, but PostgreSQL retains players and completed matches. Scaling to multiple instances or preserving in-progress matches requires a shared room store and a Socket.IO adapter; those are not implemented.

Seats remain reserved during active matches, even if a player disconnects. Reconnect in the same tab with its existing session to resume. Entering the same name in a new session cannot recover another player's seat or history. Automatic draws continue while anyone at the table is connected and stop while everyone is offline; an overdue turn advances when someone reconnects. A completely offline table is removed after 30 minutes without room activity. Players can leave waiting, completed, or aborted tables. Hosts cannot eject players or inspect their hands.

## Production build

```powershell
npm run build
npm start
```

Express serves the built frontend and API on `PORT` (default `3001`). Set `NODE_ENV=production`, `DATABASE_URL`, and `CLIENT_ORIGIN` to the public HTTPS site origin. Production refuses to start without a database.

### Vercel frontend + Railway backend

1. Deploy the backend on Railway with `npm ci`, `npm start`, PostgreSQL, and the production environment variables above. Keep one replica and enable WebSocket support.
2. Deploy the frontend on Vercel with build command `npm run build` and output directory `dist`.
3. Set **Vercel's build-time** `VITE_SERVER_URL` to the Railway HTTPS URL (no trailing slash), then rebuild.
4. Set Railway's `CLIENT_ORIGIN` to the exact Vercel HTTPS origin. Multiple explicitly trusted origins can be comma-separated. Do not use `*`.
5. If exactly one trusted reverse proxy fronts Express, set `TRUST_PROXY=1` for correct rate-limit IP handling. Do not enable this for an untrusted/direct deployment.
6. Verify `GET /api/health` returns `storage: "postgresql"` and connect three guest players to a test table.

No cloud resources are automatically provisioned or deployed. Hosting credentials and a database must be supplied by the deployer. Sessions are kept in tab-scoped `sessionStorage`; refresh restores the player, seat, and available history. Closing the tab, ending the session, or its expiry requires entering a name for a new player session. Another person typing the same name receives a distinct identity and cannot access previous private history. Ending a session revokes its token and disconnects sockets using it. Names are not verified identities, so avoid using them as proof of who a player is.

Existing databases are upgraded on startup to allow players without email/password fields; previous player IDs and completed histories are preserved. Legacy login/signup endpoints are no longer available. Existing valid session tokens still work, but a lost or expired token cannot be recovered by name.

## Validation

```powershell
npm test
npm run build
# Or both:
npm run check
```

Node's built-in test runner covers deck sizes for all player counts, legal/illegal combinations, private views, turn ownership, recycling/exhaustion, show/clash/beaten-show scoring, elimination, tied wins, and immutable round history. Integration tests start an actual HTTP/Socket.IO server on an ephemeral port and exercise name-only entry, validation, same-name identity/history isolation, room capacity, hidden hands, stale actions, chat isolation, reconnection, final history, leaderboards, and session revocation.

The automated integration suite uses the explicit in-memory store; production PostgreSQL connectivity and cloud configuration must be verified against your own database.
