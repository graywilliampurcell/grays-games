# Kid-game patterns

Curated list the Claude judge uses for comparisons, together with its own knowledge of popular kids' games. Each pattern says what good looks like and how the bot can see it. The always-true rules in `rules.yaml` override anything here.

## Proven mechanics

- **Clear goal.** The child can tell what to do and where to go within a few seconds, without reading (e.g. a glowing door, a star to reach).
  *Bot:* time from "playing" to first purposeful move; Claude on the first playing screenshot: "what is the goal?"
- **Instant retry.** Failing puts the child back in play within 1–3 s, with no menu in the way.
  *Bot:* time from fail event to input accepted again; taps needed to retry.
- **Collectibles and stars.** Small, frequent things to pick up, plus a 1–3 star rating that rewards finishing, not perfection.
  *Bot:* collectible events per minute; whether finishing always gives at least 1 star.
- **Celebration on every success.** Confetti, a jingle, a character cheering: short, and never skippable only by waiting.
  *Bot:* on escape/finish, a visual change and a sound within ~0.5 s; celebration length.
- **Sound on every tap.** Every button and every successful input makes a small sound (and a visual press state).
  *Bot:* audio activity within ~150 ms of each UI tap.
- **Gentle difficulty ramp.** Early levels are nearly impossible to fail; new ideas arrive one at a time, then combine.
  *Bot:* solver path length, dead-end depth and persona fail rate rising slowly level to level (no spikes).
- **Natural stopping points.** A clear end to each level with "Play again / Next / Home", never an endless chain.
  *Bot:* a level-end screen exists and waits for input; no autoplay into the next level.
- **Guide character.** A friendly character who shows, speaks or points: especially for pre-readers.
  *Bot:* Claude on screenshots; audio present during onboarding.
- **Show, don't tell (onboarding by doing).** The first level teaches controls through play, with an animated hand or arrow instead of text.
  *Bot:* words on screen before first input; whether first input works without reading.
- **Hints when stuck.** Idle or looping triggers a gentle nudge (arrow, glow, voice line), sooner for younger kids.
  *Bot:* idle persona; time until a hint appears (rubric `hint-when-stuck`).
- **Forgiving input.** Generous hitboxes, snap-to-path, coyote time, auto-steer or aim assist for small hands.
  *Bot:* persona success rate vs. solver success rate on the same route.
- **Checkpoints.** Longer levels save progress so failing costs only a little.
  *Bot:* distance lost per fail event.
- **Visible progress.** A map, path of dots or level list that fills in; the child sees how far they've come.
  *Bot:* Claude on menu/level-select screenshots.
- **Customisation earned by play.** Skins, colours or stickers unlocked by playing, never bought.
  *Bot:* unlock events; no price text (rule R13).
- **Juice / game feel.** Squash and stretch, particles, screen-shake that is small, responsive controls with little input lag.
  *Bot:* input-to-motion latency; Claude on short clips.
- **Replay variety.** Seeded or shuffled layouts, optional secrets, so the same level is fun twice.
  *Bot:* number of distinct layouts seen across runs.
- **Grown-up gate for settings.** Parents' options behind a simple hold or sum, so kids don't stumble into them.
  *Bot:* settings reachable in 1 tap = flag for young brackets.

## Patterns to avoid

Most of these also break always-true rules R12–R14; the report names the rule.

- **Energy / lives timers** that refill over real time ("wait 20 min or pay").
- **Fake "x2" / "claim" buttons** that actually open an ad or store.
- **Forced or rewarded ads**, including "watch an ad to continue".
- **Loot boxes, spin-the-wheel, mystery eggs, gacha.**
- **Streaks and daily login rewards** ("come back tomorrow", "don't lose your streak").
- **Countdown pressure** on offers or rewards; limited-time deals.
- **Guilt-trip buttons** ("No thanks, I don't like prizes"), sad mascots when quitting.
- **Autoplay** into the next level/episode with no stopping point.
- **Premium currency** (gems, coins) with hidden real-money prices.
- **Pay-to-skip** hard levels, or difficulty spikes that push purchases.
- **Dark-pattern layout**: close buttons that are tiny, delayed or placed where a tap hits the ad.
- **Nag prompts**: rate us, share, notifications, sign in.
- **Punishing failure**: losing collected items or many levels after one mistake.
- **Tiny targets and text walls** for young brackets.

## Game profile template

Every game (ours and comparables) is described in this shape so they can be compared field by field. For our games the numbers come from bot runs; for comparables from a short human-speed session or Claude's knowledge (say which).

```yaml
game: <name>
source: bot-run | human-session | general-knowledge-not-played
brackets: [<bracket>, ...]
genre: <genre>
web_playable: yes | no | partly
onboarding: <how the child learns the goal and controls; taps/words before play>
controls: <inputs used; held keys, combos, touch>
core_loop: <what the child does over and over, in one line>
goals_and_rewards: <goal per level; stars, collectibles, unlocks, celebration>
difficulty_curve: <how it ramps; where it spikes; fail cost>
game_feel: <responsiveness, juice, sound on input>
art_and_audio: <style, readability, voice-over, music>
session_length: <typical level and session length>
usability: <clarity, hints, stuck spots, menus>
accessibility: <contrast, color-alone cues, text size, mute, one-hand play>
ads_and_purchases: <flagged only: none | what was seen>
notes: <anything else worth comparing>
```
