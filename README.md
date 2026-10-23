# 5 Cards

A responsive, real-time card game for 2–10 friends. Built with React, Tailwind CSS, Express, Socket.IO, and PostgreSQL. No payments or wagering.

 Run locally

Requires Node.js 22.12+ and npm.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`. Choose **Log in**, then **Sign up** to create a username and password. Register two different players in **two separate browser tabs** (each tab has its own session), create a table, and join with its six-character code. Any seated player can press **Deal the cards** once every seat at the table is filled; there is no need to wait for the host. Choose a capacity from two to ten when creating a table; two or three players use one deck.

Without `DATABASE_URL`, the server explicitly runs in **development memory mode**: player sessions and completed history disappear on restart. A banner appears in the UI. No external service is needed to try the game.

## What is included

- Username/password sign-up and login with case-insensitive unique usernames and revocable, seven-day opaque sessions held in tab-scoped storage. Passwords are salted and hashed with Node's asynchronous scrypt; plaintext passwords are never stored.
- Multiple tables, configurable capacity and house rules, invitation codes, host controls. Any card and Same number are checked by default; Rummy and Continuation are unchecked and can be enabled by the table creator.
- Server-authoritative turns and scoring; clients receive only their own private hand.
- The lobby headline cycles through three messages after each successful login, sign-up, or guest entry. The selected message stays the same during navigation and reloads in that browser tab.
- Live presence, reconnecting seats, private table chat, and a 15-second turn timer that automatically advances play.
- Each player starts with 5 lives for the whole match. Every missed turn costs one life; the fifth timeout eliminates the player into spectator mode without removing their seat or chat access. Lives do not reset after a successful turn, reconnect, or new round. The last active player wins. Remaining lives appear by each player, above your cards, and in the scoreboard.
- Round reveals, per-player points for every completed round in the scoreboard, cumulative scores, elimination, shared wins, and match completion.
- Host-only **Abort game** with confirmation, during or between rounds. All players see the cancellation and can return to the lobby. Aborted matches do not save scores/history or affect leaderboards.
- Profiles with completed-match history and a leaderboard ordered by wins, then average score.
- Responsive game table, keyboard-accessible controls, reduced-motion support, optional synthesized game sounds.
- Invalid gameplay actions shake the tapped button or card instead of showing an alert. Screen readers still receive the rejection reason; reduced-motion users see a brief red outline instead. Connection, authentication, and server failures still show error messages. A wrong show that completes a round still displays its shared round result.

## Agreed rules

These resolve the original brief's unspecified details. They are also available in the in-app rulebook.

| Rule | Behavior |
| --- | --- |
| Setup | 2–3 players: 1 deck; 4–5: 2; 6–8: 3; 9–10: 4. Two jokers per deck. Deal five cards each and reveal one starter. Seats follow join order clockwise. Each player sees their own seat at the bottom while the same relative clockwise order is preserved. The dealer moves to the next active clockwise player each round, and play starts with the active player after the dealer. |
| Any card | Drop any single card. |
| Same number | Drop a group of matching ranks (including duplicate suits across decks), or a single card matching the top discard's rank. |
| Rummy | Drop a distinct-suit, same-rank set of 3–4. Mixed-rank runs are not allowed. Jokers are not wildcards. |
| Continuation | Drop one or more cards all matching the top discard's rank and optionally skip the draw entirely (choose "No draw"). Jokers cannot be continued. Drawing normally with the same drop is still allowed. Emptying your hand this way locks in 0 points for the round and your seat is skipped; shows then compare only players still holding cards, and when just one player holds cards, the round ends and they add their hand value. |
| Turn | Tap the draw pile or any one card in the latest face-up dropped group, then confirm with Drop & draw. All cards in a multi-card drop are visible and individually selectable; take exactly one, never a card you are dropping this turn. A new drop covers the previous group. Without a new drop, unclaimed cards in the latest group remain available; taking its final card does not uncover older cards. Hands never exceed 5 cards: at 5, drop at least one before taking a card from either pile. Below 5, drawing without dropping is allowed. At timeout, the hand is skipped unchanged (no drop, no draw). |
| Show | Unlocked after every active player completes one turn in each dealt round, including timed-out draws or skips. Show at the start of your turn with any hand value. A unique lowest showing player adds 0; others add their own hand values. |
| Clash | If anyone matches the showing hand value, the showing player adds 50, the lowest hand or tied lowest hands add 0, and all other players add their own hand values. |
| Beaten show | A showing player beaten by a lower hand adds 50; the lowest hand or tied lowest hands add 0, and all other players add their own hand values. |
| Values | Joker 0, Ace 1, numbers face value, and Jack, Queen, and King 10 each. |
| Exhausted pile | Recycle only covered discards, keeping the entire latest face-up group available. If a draw-pile turn has no draw or recyclable cards, reveal hands: lowest totals, including ties, score 0; others get +50. Visible cards may still be taken by choosing the discard source. |
| Elimination | The table creator enters any whole-number limit from 50 to 1,001 points (default 201) before creating the table. Players are eliminated at or above that limit and can watch and chat, but are not dealt cards or scored again. |
| Winning | Last active player wins. There is no option to finish early at current scores. |

Rules and the points-to-elimination limit are configurable when creating a table, not during a match. Turn actions include a revision number to reject stale/double submissions.
Round points are added to cumulative match scores; a round award of 0 does not reset previous points. The opening-turn show lock resets on every deal and excludes eliminated players. After each completed round, a server-controlled 15-second countdown automatically deals the next round, without host approval. The host starts only the first round and can still abort during the break, without saving scores. Chat and reconnects do not reset the countdown; if everyone is offline, an overdue deal resumes when someone reconnects. Finished or aborted matches never restart.

Everyone sees a centered winner celebration after each round and at match completion, with a trophy badge, winner names, green-highlighted cards, and a paper-confetti blast. Sixty red, cream, gold, and green paper pieces launch inward from both sides in three short bursts, then tumble and flutter down before fading. The effect ends after a few seconds and never blocks table controls. All players earning 0 round points share the round celebration, including matching players in a clash. A failed Show hand also displays a friendly "Wrong show" notice with a smiling sweat emoji, the showing player's name, the +50 penalty, and whether it was a clash or a lower opposing hand. Everyone sees this notice alongside the winners and countdown, including when the show ends the match; it is also included in Results. It clears from the table on the next deal. Final celebrations use the overall match winners, not the last round's winners. Round celebrations use already-revealed result cards; current match-winning hands are shared only when the match finishes, including timeout victories. Active hands otherwise remain private. Reduced-motion preferences disable the animation. Full round details remain available in Results.

Select one card or multiple cards of the same number/face only (for example, two 7s or two Kings). Tap selected cards to deselect them before choosing a different rank. **Show hand** is on the left; **Drop & draw** always remains on the right and is enabled on your connected, idle turn even without a selection. With 5 cards, tapping it without selecting cards displays a prompt instead of drawing; below 5 cards, it draws without dropping. It is disabled while submitting, disconnected, or on another player's turn. Both controls have at least 44px touch targets on mobile. Server validation also rejects mixed-rank multi-card drops.

Gameplay uses an original green-felt, wood-edged table with player seats around the perimeter, compact draw/discard piles in a non-scrolling center, and your hand along the bottom. On phones and tablets up to 1100px wide, play in landscape: a fixed right-hand icon rail opens Chat, Scores, Rules, and (after a round) Results without page scrolling. The top heading, table code, Leave, and host Abort controls are hidden by default so the table uses the available height. Swipe down on a non-interactive part of the table, or tap the small top pull handle, to reveal them. Swipe up or use Hide table controls to reclaim the space. Swiping on buttons, cards, or dialogs does not toggle the header. Desktop keeps its normal visible heading. Portrait screens display a rotation prompt. Panels have their own scroll area and a close button; chat drafts survive closing and reopening. Tap a selected card again to return it to its resting position. Player portraits use initials rather than external photos; remaining lives and the 15-second timer remain visible. On mobile, a compact card-icon/count badge beside each active opponent's avatar shows their current hand size without moving seats or revealing card faces. Badges are hidden before dealing and for eliminated players.

Table Talk includes eight quick emoji reactions, including a red heart and a red angry face. A reaction is sent as a normal table chat message and floats from the sender's seat, sways toward the table, and fades away over four seconds on every participant's table, even when chat is closed. Your own reactions originate beside your hand; opponents' reactions start at their avatar positions in your seating layout. Top-row reactions drift down into the table instead of disappearing beyond its edge. Multiple reactions can fly at once without blocking table controls; sender names remain in chat and accessible reaction labels rather than visual banners. Expired reactions are not replayed after refreshing. Reduced-motion preferences show a stationary emoji at its sender's seat until it disappears. Reactions preserve your text draft, use the existing chat rate limit, and never appear in other tables. Any emoji can also be typed into a normal message.

Mobile Table Talk opens as a compact bottom-right popup with history hidden initially. Use Show history / Hide history to expand or collapse messages while keeping reactions and the message input available. Tap outside the popup, press Escape, or use its close button to dismiss it; unfinished text stays saved. Desktop chat also offers the history toggle and starts expanded.

## PostgreSQL

Create an empty PostgreSQL database, then set:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/five_cards
DATABASE_SSL=disable
```

For hosted databases requiring verified TLS, use `DATABASE_SSL=verify-full` and the connection configuration supplied by your provider. Do not disable certificate verification. Schema initialization runs on startup using [server/schema.sql](server/schema.sql); the database user needs permission to create tables and indexes. No database credentials are shipped to the browser.

Registered accounts, sessions, final scores, and completed match round histories are persisted. Matches are saved transactionally and idempotently; a persistence failure is shown as an error rather than reporting a successful finish.

**Active tables, in-progress scores, and chat are in process memory.** Run exactly one backend instance. A restart resets active tables, but PostgreSQL retains players and completed matches. Scaling to multiple instances or preserving in-progress matches requires a shared room store and a Socket.IO adapter; those are not implemented.

Disconnecting does not leave a table: seats remain reserved for reconnecting. Reconnect with an existing session or log in with the account's password to resume the same player profile and reserved seat. A username alone cannot recover a seat or history. Players can explicitly **Leave** at any time, including during a match (with confirmation). Leaving an ongoing match forfeits participation: the departed player cannot rejoin that match, but can immediately create or join another table. Their existing scores and participation remain in completed-match history; they cannot win after forfeiting. Other players keep their hands, scores, and lives. If the current player leaves, play advances with a fresh turn timer; otherwise the timer stays unchanged. Host ownership transfers to a remaining participant. One active survivor wins automatically, and the match is saved before confirming the departure. The table is deleted immediately when its last participant leaves, including after a finished match.

Automatic draws continue while anyone at the table is connected and stop while everyone is offline; an overdue turn advances when someone reconnects. Waiting tables are deleted 45 minutes after creation if the match has not started, regardless of seat count or online players. Joining and chat do not reset this deadline. Connected participants return to the lobby with an expiration notice and can immediately create or join another table. Cleanup runs once per second. Non-waiting tables are removed after 30 minutes without room activity when everyone is offline. Hosts cannot eject players or inspect their hands.

## Production build

Use the fullscreen icon in the site header, or **Full screen** in the mobile table toolbar, to hide browser controls on supported browsers. Tap again to exit; the browser's Back/Escape controls also work. Fullscreen requires a user tap and is not available in every mobile browser; unsupported requests show a message.

```powershell
npm run build
npm start
```

Express serves the built frontend and API on `PORT` (default `3001`). Set `NODE_ENV=production`, `DATABASE_URL`, and `CLIENT_ORIGIN` to the public HTTPS site origin. Production refuses to start without a database.

### Vercel frontend + Railway backend

Both platforms are preconfigured in the repository, so each one only needs environment variables set in its dashboard:

| File | Platform | Effect |
| --- | --- | --- |
| [`railway.json`](railway.json) | Railway | Builds the frontend, prunes development dependencies, starts `npm start`, health-checks `/api/health`, keeps one replica, and restarts up to 10 times on failure. Railway therefore serves as both the API and a standalone fallback site. |
| [`vercel.json`](vercel.json) | Vercel | Builds with `npm run build`, publishes `dist`, and rewrites unmatched paths to `index.html`. |
| [`.vercelignore`](.vercelignore) | Vercel | Keeps backend and test sources out of the frontend deployment. |
| [`.nvmrc`](.nvmrc) | Both | Pins Node 22 to match `engines.node`. |

1. Create the Railway service from this repository and add its PostgreSQL plugin. Railway injects `DATABASE_URL`; also set `NODE_ENV=production` and `DATABASE_SSL` to match your provider. WebSockets need no extra configuration.
2. Create the Vercel project from the same repository. The framework, build command, and output directory are detected from `vercel.json`.
3. Set **Vercel's build-time** `VITE_SERVER_URL` to the Railway HTTPS URL (no trailing slash), then redeploy. This value is baked into the bundle at build time, so changing it always requires a rebuild.
4. Set Railway's `CLIENT_ORIGIN` to the exact Vercel HTTPS origin. Multiple explicitly trusted origins can be comma-separated. Do not use `*`.
5. Railway terminates TLS through one reverse proxy, so set `TRUST_PROXY=1` there for correct rate-limit IP handling. Do not enable this for an untrusted/direct deployment.
6. Verify `GET /api/health` returns `storage: "postgresql"` and connect three registered players to a test table.

Deploy order matters: the backend must exist before step 3, and step 4 cannot be completed until the Vercel domain is known. Expect to redeploy the frontend once after setting `VITE_SERVER_URL`.

No cloud resources are automatically provisioned or deployed. Hosting credentials and a database must be supplied by the deployer. Sessions are kept in tab-scoped `sessionStorage`; refresh restores the player, seat, and available history. Closing the tab, logging out, or session expiry requires logging in again with the username and password. Logging out revokes that session's token and disconnects sockets using it.

Authentication uses `POST /api/signup` and `POST /api/login` with `{ name, password }`. Usernames are trimmed, Unicode compatibility-normalized, and compared case-insensitively; use 1–24 letters, numbers, spaces, hyphens, or underscores. Passwords must contain 4–128 characters and are not trimmed. A database primary key prevents duplicate usernames even during concurrent registration. Both endpoints share an IP-based authentication rate limit and never return password hashes. Password recovery is not available yet; keep your password safe.

On startup, existing databases gain a separate `accounts` table. Old guest player IDs and completed histories remain unchanged. A newly registered account always gets a new player ID and cannot claim a guest's profile, history, or seat. Existing accounts and valid sessions survive restarts when using PostgreSQL.

Players may choose **Continue as guest** on either authentication page without entering credentials. `/api/guest` assigns an automatic `Guest-…` name and a normal tab-scoped session; refresh and reconnect preserve that identity while the session is valid. Signing out ends access to the guest identity, which has no password recovery or account conversion. Guests can create/join tables, play, chat, and view their session's history. Completed match records retain all participants, but the leaderboard includes only players linked to registered accounts (including for historical matches). Games against guests still count for registered opponents. Guest status and leaderboard eligibility are determined by the server, never by a submitted name or client flag.

## Validation

```powershell
npm test
npm run build
# Or both:
npm run check
```

Node's built-in test runner covers deck sizes for all player counts, legal/illegal combinations, private views, turn ownership, recycling/exhaustion, show/clash/beaten-show scoring, elimination, tied wins, and immutable round history. Integration tests start an actual HTTP/Socket.IO server on an ephemeral port and exercise sign-up/login, validation, duplicate and concurrent username rejection, password verification, guest/account isolation, room capacity, hidden hands, stale actions, chat isolation, reconnection, final history, leaderboards, and session revocation.

The automated integration suite uses the explicit in-memory store; production PostgreSQL connectivity and cloud configuration must be verified against your own database.

## Credits

Card faces are rendered with [`@letele/playing-cards`](https://www.npmjs.com/package/@letele/playing-cards), a React SVG deck released under **CC0-1.0** (public domain), derived from Adrian Kennard's classic print-ready card designs. The card back is this project's own artwork.
