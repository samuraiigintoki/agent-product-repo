# Break test campaign for the real flow milestone

Date: 2026-11-19
Code under test: branch feat/real-flow-testnet at 2fd253f, plus
fixes already made during the owner browser walk.

## Aim

Try to break the current milestone the way many different
people would. Do not only repeat the path we planned. Look
for false paid states, lost bills, blocked wallet recovery,
wrong role traps, bad links, stale tabs, duplicate clicks,
and words that say more than the code has proved.

## Rule for this campaign

Every claim needs a run that shows it. Code reading can point
at a test, but code reading alone is not proof. A local crowd
run is not chain proof. A chain run with fresh wallets is
chain proof only for the paths it touched.

## Steps, and the new problem each step could create

1. Map both journeys from the code: worker, client, wallet,
   bill, link, pay, receipt, proof, refresh, lock, restore.
   New problem: a map can repeat our own blind spots.
   Guard: each map item must end in a probe, a run, or a
   named gap. Stop if a step has no way to prove it.

2. Build one crowd harness with 240 local users, half worker
   side and half client side, each with separate storage.
   Actions are picked by a fixed seed, so a failure can be
   run again. New problem: fake local users can give false
   comfort. Guard: label every result local only. Keys are
   never made in this harness. No live network is touched.

3. Attack the carry points between people: pay links, proof
   links, copied text, changed amounts, changed wallet
   targets, cut links, old links, reused bill ids, unicode
   titles, and very long text. New problem: a weak test could
   pass a changed link by only checking that it opens.
   Guard: checks compare every field that matters, not just
   that a page renders.

4. Attack the single device points: two stores on one
   storage, damaged storage, full storage, duplicate bill
   ids, 200 bills in one store, refresh in the middle, and
   opening the same link many times. New problem: the harness
   could be slower than the fault it hunts. Guard: time each
   group and stop a group that runs over two minutes.

5. Attack the screens as a person would: open the pay link
   before connecting, connect in the wrong role, double click
   every button, leave a field empty, type amounts with
   commas or dots, paste a damaged backup, forget a password,
   and try to restore while a damaged wallet box is present.
   New problem: screen tests can mock away the real fault.
   Guard: use the real pages and real stores where the fault
   would live. Mock only the network send.

6. Run a small live chain attack set with fresh wallets:
   wrong amount, wrong worker, missing bill, second pay of
   the same bill, and pay before the bill exists. New
   problem: each live send is slow, so this cannot be a crowd.
   Guard: one worker and a few clients only, and say plainly
   that the crowd part stayed local. Stop the live set after
   15 minutes and record what did not run.

7. Rank every fault found: false money truth first, key
   safety second, lost work third, blocked recovery fourth,
   confusion fifth. New problem: fixing everything at once
   can break the flow that just passed. Guard: this campaign
   ends in a ranked list. Fixes come after, one at a time,
   each with its own check, and the owner walk runs again
   after blocker fixes.

## Stop rules

- Stop and report at once if any run shows keys, backup
  codes, or passwords in storage, logs, or links where they
  do not belong.
- Stop and report at once if any screen says paid on the
  network when the network pay did not land.
- Do not merge this branch while a blocker fault is open.
- Do not claim 200 live users. The crowd is local. The live
  chain part is a small fresh wallet set.
