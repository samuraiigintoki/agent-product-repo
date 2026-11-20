# QA note: role boundary, storage fallback, bill speed

Date: 2026-11-20
Branch: `fix/role-boundary-storage-speed`
Last code commit: `90a058d`

## What changed

- A wallet cannot pay its own bill. The pay page blocks it on screen. The session layer refuses it again before any network call.
- The pay page never draws a pay form for a worker session. A worker who opens their own bill link sees the link, a Copy link button, and a button to My pay. A worker who opens another worker's link sees a boundary screen with a switch button.
- Worker pages (New invoice, My pay, Make proof) draw only a boundary screen for a client session. No form, no bill list, no proof controls.
- "Open pay page" is gone from the invoice result and My pay. Both show the link and a Copy link button. If the copy fails, the words say to copy the link by hand.
- A network pay link with no wallet connected shows a button to the home page, not a pay button. The bill stays unpaid.
- Browser storage: before the wallet engine opens, the app probes the normal storage. If the browser refuses it, the engine gets a fallback store that needs no such access. If storage is fully blocked, the person sees plain words about what to change. Raw browser storage errors never reach a screen. Node test runs never take the fallback.
- Bill speed: a first send no longer pays for an already-written network check. A retry still checks. The bill count read stays once per send.
- Long network steps now show a seconds counter and name the private proof step as the slow part. The proof itself is not faster. No promise says it is.

## Checks run

- Fast tests, run in small batches: 136 tests passed, 0 failed.
  - Chain storage and session: 37 passed.
  - Domain: 48 passed.
  - Pages, first batch: 26 passed.
  - Pages, second batch: 15 passed.
  - Brutal page campaign: 10 passed.
- Type check: clean.
- Live test on the public test network: `testnetAcceptance.test.ts` passed in 60 seconds. Fake test money only.
- Trial copy on Vercel: deployment `dpl_59e1bnYz8s1t2zyJCkyCvDWdDvim` for `90a058d` is READY. This also proves the production build passes, because the local build in the sandbox did not finish in four minutes.
- Two self review passes over the full branch diff. No "Open pay page" left in product code. No raw storage error words on any page. No local network address in the changed chain files.

## Not covered

- The four local plumbing tests (`freshAccount`, `userFlow`, `localFlow`, `proof`) need a local Aztec network on this machine. They were not run.
- The storage fallback is unit tested with a refused storage probe. It has not yet run in a real browser that blocks the normal storage. The owner walk should include a Firefox private window or a browser set to never remember history.
- Bill writing still takes real proof time on the device. The counter makes the wait honest. It does not cut it.
- No contract change. No new deploy. Claim seal limits and amount-hash limits from earlier notes still stand.

## Owner walk needed

1. Open the trial copy. Make a wallet, connect as worker, make a bill. The wait now shows seconds.
2. Open the bill link in the same browser. You should see your own link screen, not a pay form.
3. Open New invoice, My pay, and Make proof while connected as client. Each should show the boundary screen.
4. Open the bill link in a second browser. Make a client wallet and pay.
5. If you can, repeat step 4 in a Firefox private window. That is the browser case that used to crash.
