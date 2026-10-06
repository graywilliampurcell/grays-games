---
name: build-loop
description: Quiet build-agent loop for Gray's games. Polls the Mazle and Rolly Bally Notion plans, builds only work JP or Gray has approved (with a timestamped Build status line it keeps up to date), commits and pushes it to master and waits for the deploy, logs to Notion, and keeps STATE.md current so any new session can pick up where the last builder left off. Each tick runs in a subagent so the main session's context stays small. Use when the user types /build-loop or /loop /build-loop, or asks to resume the builder.
---

# /build-loop: dispatcher

Each tick's real work happens in a subagent, so this session only holds a one-line result per tick. Don't do the tick's work here, and don't read TICK.md or the Notion plans in this session.

## Every tick
There is no local dev server. Builds are checked by committing, pushing to master and waiting for the deploy pipeline (TICK.md, **Shipping**), and JP tests on the live site.

1. **Run the tick in a subagent.** Use the Agent tool with `subagent_type: "general-purpose"` and description "build-loop tick", with this prompt:

   > You are the build agent for one tick of /build-loop in this repo. Read `.claude/skills/build-loop/TICK.md` and follow it exactly. Your final message must start with `NO_CHANGE`, `CHANGED:` or `QUESTION:` and stay short.

   Then end the turn and wait for the subagent's notification. Don't start a second tick while one is still running.
2. **When the subagent finishes,** relay its result:
   - `NO_CHANGE`: reply only "No change." and ScheduleWakeup about 60s with `noop: true` and prompt `/build-loop`.
   - `CHANGED: …`: pass its report on to JP in a few plain lines, then ScheduleWakeup about 60s with `noop: false`.
   - `QUESTION: …`: ask JP the question and don't schedule another tick until JP answers.
   - Anything else, or the subagent failed: say so in one line, then ScheduleWakeup about 60s with `noop: false`.

## Stopping
When JP asks to stop the loop, call ScheduleWakeup with `stop: true`. If a tick subagent is still running, let it finish (or stop it with TaskStop if JP wants it stopped right away) and say which.
