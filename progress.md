Original prompt: I want to create a plan for 'mars minitaxi', which is a space taxi clone, except the taxi is tiny and we're on the surface of Mars! We need to generate Art for Passengers, the taxi, the setting, which is a mars colony with small medium and large buildings and some tall residential buildings. passengers might like in highrise requiring dropoff on roofs or on the ground. The idea is to create an interesting futuristic Mars landscape where passengers spawn. Create a minimap to show available fares and layout similar to the Defender minimap! the Mars landscape should have intermittent weather events with nofitications or scanner readouts whereby the wind gets much stronger causing issues. Player gets 3 lives and its game over. Use a simple palette and keep it Mars with human tech and spacepeople thrown in there. The ideaa is to create "smallish" assets so they look small and low in detail so we can have a large aerial space with hazards, and perhaps vertical movement. Create a clear and detailed control scheme with challenges. Can we force the player to need to land to avoid sand storms , and stuff like that? ofcourse we also losely follow space taxi as far as game loop. I want to establish a top ten and allow players to enter their initials and save it online. I have a supabase account already. I also have a render account. Come up with game elements to add it make it awesome! We'll go over the ideas.

Notes:
- Initialized monorepo with client (Vite TS) and server (Express TS).
- Implemented server scaffold with Supabase-backed leaderboard endpoints and local fallback.

TODO:
- Balance flight tuning, payouts, and storm cadence after more playtesting.
- Exercise the browser initials form manually once a longer local session is convenient; API submit/fetch smoke test passed.
- Consider adding audio, score persistence polish, and richer hazards/passenger portrait art next.

Update 2026-03-05:
- Replaced the empty Vite client with a playable single-canvas Mars Minitaxi vertical slice in `client/src/main.ts`.
- Added a large side-scrolling Mars colony with mixed roof/ground landing pads, Defender-style minimap, dust-devil hazards, weather scanner messaging, forced-land storm shelter loop, 3 lives, gameover, and fullscreen toggle on `f`.
- Added client leaderboard panel, initials submission form, API fetch/submit wiring, `window.render_game_to_text`, and deterministic `window.advanceTime(ms)` hook for Playwright.
- Added `client/.env.example` and `server/.env.example`.

Validation 2026-03-05:
- `npm run build --workspace client` OK
- `npm run build --workspace server` OK
- Playwright smoke run: launch + pickup + flight (`output/web-game-flight/shot-0.png`, `state-0.json`) OK
- Playwright long wait: sheltered through a storm cycle while docked (`output/web-game-storm/shot-0.png`, `state-0.json`) OK
- API smoke test: POST `/submit-score` then GET `/leaderboard` against local server OK

Update 2026-03-06:
- Continued the redesign into a denser command-deck shell with stronger scanner, fare, and uplink panels plus a new game-over modal illustration.
- Added Phobos and Deimos to the sky, visible fuel stations on selected pads, a live fuel gauge, thrust fuel burn, paid refueling, teal fuel markers on the minimap, and fuel status in `render_game_to_text`.
- Strengthened storm visuals so warning and active states are visibly distinct on the playfield.
- Reworked mid-deck pad placement to sit outside building faces and added a collision grace lane while approaching mid decks.
- Added landing grades (`F` through `S`) with HUD feedback and reward tones, clearer taxi/lives readout in the in-canvas HUD, and heavier crash/game-over audio.
- Added overall run grading to the game-over flow plus a retry action inside the modal.
- Clarified fuel onboarding with explicit attract/HUD copy that teal-lit pads auto-refuel while docked and spend score credits.
- Added a throttled low-fuel alarm plus a distinct out-of-fuel warning tone using the existing Web Audio path.

Validation 2026-03-06:
- `npm run build --workspace client` OK
- Desktop redesign capture (`output/full-ui-after-desktop-wait.png`) OK
- Mobile layout capture (`output/full-ui-after-mobile.png`) OK
- Storm, fuel, moons capture (`output/web-game-final-pass/shot-0.png`, `state-0.json`) OK
- Forced game-over modal capture (`output/gameover-modal-after.png`) OK
- Fuel instructions attract capture (`output/web-game-fuel-instructions/shot-0.png`, `state-0.json`) OK
- Long-thrust low-fuel pass (`output/web-game-low-fuel/shot-0.png`, `state-0.json`) OK

TODO:
- Manually flight-test at least one mid-deck landing from a natural approach; the geometry and collision path are fixed in code, but I did not complete a clean live landing during this handoff.
- Balance fuel burn and refuel pricing against fare payouts after a few longer runs.
