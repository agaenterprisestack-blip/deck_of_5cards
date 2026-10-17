# 5 Cards

A responsive, real-time card game for 3–10 friends. Built with React, Tailwind CSS, Express, Socket.IO, and PostgreSQL. No payments or wagering.

 Run locally

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
- Live presence, reconnecting seats, private table chat, and a 30-second turn timer that automatically advances play.
- Each player starts with 5 lives for the whole match. Every missed turn costs one life; the fifth timeout eliminates the player into spectator mode without removing their seat or chat access. Lives do not reset after a successful turn, reconnect, or new round. The last active player wins. Remaining lives appear by each player, above your cards, and in the scoreboard.
- Round reveals, cumulative scores, elimination, shared wins, and match completion.
- Host-only **Abort game** with confirmation, during or between rounds. All players see the cancellation and can return to the lobby. Aborted matches do not save scores/history or affect leaderboards.
- Profiles with completed-match history and a leaderboard ordered by wins, then average score.
- Responsive game table, keyboard-accessible controls, reduced-motion support, optional synthesized game sounds.
- Invalid gameplay actions shake the tapped button or card instead of showing an alert. Screen readers still receive the rejection reason; reduced-motion users see a brief red outline instead. Connection, authentication, and server failures still show error messages. A wrong show that completes a round still displays its shared round result.

## Agreed rules

These resolve the original brief's unspecified details. They are also available in the in-app rulebook.

| Rule | Behavior |
| --- | --- |
| Setup | 3 players: 1 deck; 4–5: 2; 6–8: 3; 9–10: 4. Two jokers per deck. Deal five cards each and reveal one starter. Dealer rotates each round; play starts after the dealer. |
| Any card | Drop any single card. |
| Same number | Drop a group of matching ranks (including duplicate suits across decks), or a single card matching the top discard's rank. |
| Rummy | Drop a distinct-suit, same-rank set of 3–4. Mixed-rank runs are not allowed. Jokers are not wildcards. |
| Continuation | Drop a single card one rank above the top discard in the same suit. With Any Card enabled this does not further restrict single-card plays. |
| Turn | Tap the draw pile or any one card in the latest face-up dropped group, then confirm with Drop & draw. All cards in a multi-card drop are visible and individually selectable; take exactly one, never a card you are dropping this turn. A new drop covers the previous group. Without a new drop, unclaimed cards in the latest group remain available; taking its final card does not uncover older cards. Hands never exceed 5 cards: at 5, drop at least one before taking a card from either pile. Below 5, drawing without dropping is allowed. At timeout, a full hand skips unchanged; a smaller hand draws one from the draw pile. |
| Show | Unlocked after every active player completes one turn in each dealt round, including timed-out draws or skips. Show at the start of your turn with any hand value. A unique lowest showing player adds 0; others add their own hand values. |
| Clash | If anyone matches the showing hand value, the showing player adds 50, matching players add 0, and others add their own hand values. Applies even when someone else has a lower hand. |
| Beaten show | Without a matching hand, a showing player beaten by a lower hand adds 50; everyone else adds their own hand value. |
| Values | Joker 0, Ace 1, numbers face value, Jack 11, Queen 12, King 13. |
| Exhausted pile | Recycle only covered discards, keeping the entire latest face-up group available. If a draw-pile turn has no draw or recyclable cards, reveal hands: lowest totals, including ties, score 0; others get +50. Visible cards may still be taken by choosing the discard source. |
| Elimination | At the table's selected limit (101, 201, 401, or 1001 points; default 201). Eliminated players can watch and chat, but are not dealt cards or scored again. |
| Winning | Last active player wins. There is no option to finish early at current scores. |

Rules and the points-to-elimination limit are configurable when creating a table, not during a match. Turn actions include a revision number to reject stale/double submissions.
Round points are added to cumulative match scores; a round award of 0 does not reset previous points. The opening-turn show lock resets on every deal and excludes eliminated players. After each completed round, a server-controlled 15-second countdown automatically deals the next round, without host approval. The host starts only the first round and can still abort during the break, without saving scores. Chat and reconnects do not reset the countdown; if everyone is offline, an overdue deal resumes when someone reconnects. Finished or aborted matches never restart.

Everyone sees a centered winner celebration after each round and at match completion, with a trophy badge, winner names, green-highlighted cards, and a brief confetti animation. All players earning 0 round points share the round celebration, including matching players in a clash. A failed Show hand also displays a friendly "Wrong show" notice with a smiling sweat emoji, the showing player's name, the +50 penalty, and whether it was a clash or a lower opposing hand. Everyone sees this notice alongside the winners and countdown, including when the show ends the match; it is also included in Results. It clears from the table on the next deal. Final celebrations use the overall match winners, not the last round's winners. Round celebrations use already-revealed result cards; current match-winning hands are shared only when the match finishes, including timeout victories. Active hands otherwise remain private. Reduced-motion preferences disable the animation. Full round details remain available in Results.

Select one card or multiple cards of the same number/face only (for example, two 7s or two Kings). Tap selected cards to deselect them before choosing a different rank. **Show hand** is on the left; **Drop & draw** always remains on the right and is enabled on your connected, idle turn even without a selection. With 5 cards, tapping it without selecting cards displays a prompt instead of drawing; below 5 cards, it draws without dropping. It is disabled while submitting, disconnected, or on another player's turn. Both controls have at least 44px touch targets on mobile. Server validation also rejects mixed-rank multi-card drops.

Gameplay uses an original green-felt, wood-edged table with player seats around the perimeter, compact draw/discard piles in a non-scrolling center, and your hand along the bottom. On phones and tablets up to 1100px wide, play in landscape: a fixed right-hand icon rail opens Chat, Scores, Rules, and (after a round) Results without page scrolling. Portrait screens display a rotation prompt. Panels have their own scroll area and a close button; chat drafts survive closing and reopening. Tap a selected card again to return it to its resting position. Player portraits use initials rather than external photos; remaining lives and the 30-second timer remain visible.

Table Talk includes eight quick emoji reactions, including a red heart and a red angry face. A reaction is sent as a normal table chat message and floats from the sender's seat, sways toward the table, and fades away over four seconds on every participant's table, even when chat is closed. Your own reactions originate beside your hand; opponents' reactions start at their avatar positions in your seating layout. Top-row reactions drift down into the table instead of disappearing beyond its edge. Multiple reactions can fly at once without blocking table controls; sender names remain in chat and accessible reaction labels rather than visual banners. Expired reactions are not replayed after refreshing. Reduced-motion preferences show a stationary emoji at its sender's seat until it disappears. Reactions preserve your text draft, use the existing chat rate limit, and never appear in other tables. Any emoji can also be typed into a normal message.

Mobile Table Talk opens as a compact bottom-right popup with history hidden initially. Use Show history / Hide history to expand or collapse messages while keeping reactions and the message input available. Tap outside the popup, press Escape, or use its close button to dismiss it; unfinished text stays saved. Desktop chat also offers the history toggle and starts expanded.

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
