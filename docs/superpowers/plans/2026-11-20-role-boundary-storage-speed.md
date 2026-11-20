# Role Boundary, Storage Fallback, Bill Speed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate the worker and client flows on every screen, let payers connect in browsers that refuse OPFS storage, and cut wasted network reads from bill creation while showing honest progress.

**Architecture:** The session layer stays the second lock (role refusals plus a new self-pay refusal and a retry-only already-written check). Pages become the first lock: the pay page renders one of five named states for a network link, and worker pages render a boundary screen for a client session. Browser storage is chosen in one new small module: OPFS when a probe passes, the pinned Aztec IndexedDB store when it does not, and plain words when neither opens.

**Tech Stack:** React + TypeScript, Vitest, Aztec 6.0.0 pinned packages (`@aztec-labs/wallets`, `@aztec-labs/kv-store`).

**Spec:** `docs/superpowers/specs/2026-11-20-role-boundary-storage-speed-design.md`

## Global Constraints

- Plain, simple English in every user-facing line. No em dashes or en dashes anywhere, code comments included.
- No contract change, no new contract deploy, no network settings change. Settings stay in `apps/web/src/chain/settings.ts` only.
- Keys, backup codes, and passwords never enter logs, messages, or new stores.
- TDD for every behavior change: failing test first, watch it fail, minimal code, watch it pass.
- Work only on branch `fix/role-boundary-storage-speed`. No merge and no production change without owner approval.
- Every task ends green on its own tests before commit.

## Review Focus

- A payer in Firefox private mode (OPFS refused, IndexedDB open) is the person this plan exists for. The decision logic is unit tested here; the real browser run is the owner walk on the trial copy, stated plainly at handoff.
- Two tabs connecting at once in a fallback browser: the old OPFS path said the store was in use. The fallback store's behavior there is not unit testable here; it goes on the owner walk checklist.
- A role switch pressed while a connect is still running must stay serialized by the existing session change queue. Boundary switch buttons use the same session calls as the wallet panel.
- Copy buttons where clipboard permission is missing: the link stays visible as text and the note tells the person to copy it by hand. No dead button.
- A first send retried after the tab closed mid-prove: the bill holds a reserved number by then, so the retry path runs the already-written check. The first-send skip must never apply there.

---

### Task 1: Session layer, self-pay refusal and retry-only check

**Files:**
- Modify: `apps/web/src/chain/session.ts`
- Modify: `apps/web/src/pages/Invoice.tsx` (caller passes retry truth)
- Modify: `apps/web/src/App.tsx` (My pay caller passes retry truth)
- Test: `apps/web/src/chain/sessionBoundary.test.ts` (create)

**Interfaces:**
- Produces: `connectedAccountAddress(): string | null` from `session.ts`. `chainWorkerAddress()` stays and returns the same value.
- Produces: `createInvoiceLive(input: { webInvoiceId: string; amount: number; billId?: number; checkExisting?: boolean })`. The already-written check runs only when `checkExisting` is true, or when a `billId` is passed without `checkExisting` (safe default for unknown callers). A fresh reserve inside the call never checks.
- Produces: `payInvoiceLive` throws `This is your own bill. You cannot pay your own bill.` when the session account text equals `input.workerAddress`, before any chain call.

- [ ] **Step 1: Write the failing test** in `sessionBoundary.test.ts`. Mock `./wallet` (record mode fake sessions, pattern from `sessionRace.test.ts`), `./invoiceChain` (call counters, configurable made flag, count 0), and `./payChain` (call counter). Sign in through the real `createUserWallet` plus `signInWithUserWallet`. Tests: self pay refuses and `payInvoiceOnChain` is never called; first send (billId passed, `checkExisting: false`) never calls `readInvoiceMadeOnChain` and does call `createInvoiceOnChain`; retry (`checkExisting: true`, made true) calls the check and never sends; `connectedAccountAddress()` returns the fake account text.
- [ ] **Step 2: Run it.** `npx vitest run src/chain/sessionBoundary.test.ts` Expected: FAIL (self pay reaches the pay call; the made check runs on a first send).
- [ ] **Step 3: Implement.** In `session.ts`: add `connectedAccountAddress`, make `chainWorkerAddress` delegate to it, add the self-pay refusal in `payInvoiceLive` after the locked-wallet check, and gate the `readInvoiceMadeOnChain` call on the rule above. In `Invoice.tsx`, `writeOnNetwork` captures whether the bill already held `chainAttemptBillId` before saving the attempt, and passes `checkExisting` with that value. In `App.tsx`, the My pay `writeLive` passes `checkExisting: bill.chainAttemptBillId !== undefined`.
- [ ] **Step 4: Run the test, then the neighbors.** `npx vitest run src/chain/sessionBoundary.test.ts src/chain/sessionRace.test.ts src/chain/sessionWallet.test.ts` Expected: PASS.
- [ ] **Step 5: Commit.** `git add apps/web/src/chain/session.ts apps/web/src/chain/sessionBoundary.test.ts apps/web/src/pages/Invoice.tsx apps/web/src/App.tsx` with message `fix: session refuses self pay, retry-only written check`.

### Task 2: Browser storage choice with OPFS fallback

**Files:**
- Create: `apps/web/src/chain/browserStore.ts`
- Modify: `apps/web/src/chain/wallet.ts`
- Test: `apps/web/src/chain/browserStore.test.ts` (create)

**Interfaces:**
- Produces from `browserStore.ts`: `BROWSER_STORAGE_MESSAGE: string`; `isBrowserStorageError(error: unknown): boolean` (true for names or messages carrying GetDirectory, SecurityError, Security error, or OPFS); `plainChainError(error: unknown): Error` (storage errors become `BROWSER_STORAGE_MESSAGE`, anything else passes through as an Error); `detectOpfs(probe?: () => Promise<unknown>): Promise<boolean>` (default probe is `navigator.storage.getDirectory`, false when missing or refusing); `chainStoreOverrides(): Promise<{ pxeStore: AztecAsyncKVStore; walletStore: AztecAsyncKVStore } | null>`.
- `chainStoreOverrides` returns null when there is no browser document or the OPFS probe passes. In a browser with a failed probe it dynamically imports `AztecIndexedDBStore` from `@aztec-labs/kv-store/deprecated/indexeddb` and opens `pxe_data` (persistent) and a temporary wallet store (ephemeral, matching today's wallet DB lifetime). Any failure opening them throws `new Error(BROWSER_STORAGE_MESSAGE)`.

- [ ] **Step 1: Write the failing test** in `browserStore.test.ts`. Cases: `isBrowserStorageError` true for `new DOMException("Security error when calling GetDirectory", "SecurityError")`-shaped errors and false for a plain network error; `plainChainError` maps the first and passes the second through; `detectOpfs` true on resolve, false on reject, false when the probe is missing; `chainStoreOverrides()` resolves null in the Node test environment (no document). One jsdom case at the top of a second describe with `// @vitest-environment jsdom` is not possible in one file, so the both-stores-fail case lives in `browserStoreJsdom.test.ts`: stub `navigator.storage.getDirectory` to reject, expect `chainStoreOverrides()` to reject with `BROWSER_STORAGE_MESSAGE` and the message to not contain `GetDirectory`.
- [ ] **Step 2: Run them.** `npx vitest run src/chain/browserStore.test.ts src/chain/browserStoreJsdom.test.ts` Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `browserStore.ts` as specced, then wire `wallet.ts`: in `createUserChainSession`, `const overrides = await chainStoreOverrides();` before `EmbeddedWallet.create`, pass `pxe: { proverEnabled: !isLocalNodeUrl(nodeUrl), ...(overrides ? { store: overrides.pxeStore } : {}) }` and `...(overrides ? { walletDb: { store: overrides.walletStore } } : {})`. Wrap the `EmbeddedWallet.create` call so a thrown error goes out as `plainChainError(error)`. The account and contract section already stops the wallet and rethrows; make sure the rethrow also passes through `plainChainError` only for the create step, without masking the plain messages already thrown below it (contract address, contract cannot be seen).
- [ ] **Step 4: Run the tests, then the chain neighbors.** `npx vitest run src/chain/browserStore.test.ts src/chain/browserStoreJsdom.test.ts src/chain/userWallet.test.ts src/chain/keyVault.test.ts src/chain/sessionRace.test.ts` Expected: PASS.
- [ ] **Step 5: Commit.** `git add apps/web/src/chain/browserStore.ts apps/web/src/chain/browserStore.test.ts apps/web/src/chain/browserStoreJsdom.test.ts apps/web/src/chain/wallet.ts` with message `fix: indexeddb fallback when browser refuses opfs storage`.

### Task 3: Pay page role boundary

**Files:**
- Modify: `apps/web/src/pages/Pay.tsx`
- Modify: `apps/web/src/pages/payTruth.test.tsx` (no-session expectation changes to the new state)
- Modify: `apps/web/src/pages/paySessionTruth.test.tsx` and `apps/web/src/pages/brutalCampaign.test.tsx` (session mocks gain the new exports)
- Test: `apps/web/src/pages/payBoundary.test.tsx` (create)

**Interfaces:**
- Consumes from `session.ts`: `connectedUserRole()`, `connectedAccountAddress()`, `dropChainSession()`, `signInWithUserWallet(role)` (all exist or come from Task 1).
- Produces from `pages/copyText.ts` (create): `copyText(text: string): Promise<boolean>`, true only when the clipboard write ran. Used here and in Task 4.

- [ ] **Step 1: Write the failing test** in `payBoundary.test.tsx`. Mock `../chain/session` with a hoisted role and account. A worker wallet is `0xaaa...`, the link worker is configurable. Tests: worker plus own link shows `This is your bill link`, a Copy link button, and no `Pay this bill` button; worker plus another worker's link shows the boundary words and no pay button, and pressing Switch to paying bills calls the mocked switch and reveals the pay form; client plus own link shows `You cannot pay your own bill` and no pay button. Reuse the store and link helpers from `payTruth.test.tsx`.
- [ ] **Step 2: Run it.** `npx vitest run src/pages/payBoundary.test.tsx` Expected: FAIL (pay form renders for a worker today).
- [ ] **Step 3: Implement.** Create `copyText.ts`. In `Pay.tsx`, after the broken, clash, and missing bill returns, add the three early screens for network links (worker own bill, worker other bill, client self pay) exactly as the spec words them. The own-bill screen shows title, amount, the full `#/pay/...` link text, Copy link (note `Link copied.` on success, `Copy the link above by hand.` on failure), and an Open My pay button (`#/mypay`). The boundary screen carries local note state for a failed switch. Change the no-session network state: guidance words plus a Go to the home page button, and no pay button while unpaid (the paid words still show when the bill is already network paid). Update `payTruth.test.tsx` to expect no pay button and the unpaid state kept, and add the new exports to the two existing session mocks.
- [ ] **Step 4: Run the pay tests.** `npx vitest run src/pages/payBoundary.test.tsx src/pages/payTruth.test.tsx src/pages/paySessionTruth.test.tsx src/pages/payLinkFlow.test.tsx src/pages/brutalCampaign.test.tsx` Expected: PASS.
- [ ] **Step 5: Commit.** `git add apps/web/src/pages/Pay.tsx apps/web/src/pages/copyText.ts apps/web/src/pages/payBoundary.test.tsx apps/web/src/pages/payTruth.test.tsx apps/web/src/pages/paySessionTruth.test.tsx apps/web/src/pages/brutalCampaign.test.tsx` with message `fix: pay page keeps worker and client apart`.

### Task 4: Worker page guards and copy link instead of open pay page

**Files:**
- Create: `apps/web/src/pages/RoleBoundary.tsx`
- Modify: `apps/web/src/pages/Invoice.tsx`, `apps/web/src/pages/MyPay.tsx`, `apps/web/src/pages/MakeProof.tsx`
- Modify: `apps/web/src/pages/invoiceLinkFlow.test.tsx` (expects Copy link, no Open pay page)
- Test: `apps/web/src/pages/workerBoundary.test.tsx` (create)

**Interfaces:**
- Produces `RoleBoundary({ needed }: { needed: "worker" | "client" })`: a screen naming the current wrong role in plain words, a Switch button (`dropChainSession` then `signInWithUserWallet(needed)`, plain error note on failure), and a Go home button (`#/`). Pages render it instead of their body when `connectedUserRole()` is the opposite role.

- [ ] **Step 1: Write the failing test** in `workerBoundary.test.tsx`. Mock `../chain/session` (hoisted role; `hasChainSession`, `connectedUserRole`, `reserveInvoiceBillIdLive`, `createInvoiceLive`, `billIdFor`, `dropChainSession`, `signInWithUserWallet`). With role `client`: Invoice shows the boundary and no `Make invoice` button; MyPay shows the boundary and no bill list heading content; MakeProof shows the boundary and no `Make proof` button. With role `worker`: Invoice shows its form.
- [ ] **Step 2: Run it.** `npx vitest run src/pages/workerBoundary.test.tsx` Expected: FAIL (forms render for a client today).
- [ ] **Step 3: Implement.** Create `RoleBoundary.tsx`. Guard the three pages at the top of their render. In `Invoice.tsx`, replace the `Open pay page` button in the link block with a Copy link button using `copyText` plus the send-to-client line from the spec, keeping the link text visible. In `MyPay.tsx`, replace the `Open pay page` button in the network link block with Copy link the same way. Update `invoiceLinkFlow.test.tsx` to assert the final link, a Copy link button, and no `Open pay page`.
- [ ] **Step 4: Run the worker page tests.** `npx vitest run src/pages/workerBoundary.test.tsx src/pages/invoiceLinkFlow.test.tsx src/pages/invoiceForm.test.tsx src/pages/invoiceRetry.test.tsx src/pages/myPayFixes.test.tsx src/pages/proofWords.test.tsx src/pages/flow.test.tsx` Expected: PASS.
- [ ] **Step 5: Commit.** `git add apps/web/src/pages/RoleBoundary.tsx apps/web/src/pages/Invoice.tsx apps/web/src/pages/MyPay.tsx apps/web/src/pages/MakeProof.tsx apps/web/src/pages/workerBoundary.test.tsx apps/web/src/pages/invoiceLinkFlow.test.tsx` with message `fix: worker pages guard client sessions, copy link replaces open pay page`.

### Task 5: Elapsed seconds on long network steps

**Files:**
- Create: `apps/web/src/pages/useElapsedSeconds.ts`
- Modify: `apps/web/src/pages/Invoice.tsx`, `apps/web/src/pages/Pay.tsx`, `apps/web/src/pages/WalletPanel.tsx`
- Test: `apps/web/src/pages/elapsed.test.tsx` (create)

**Interfaces:**
- Produces `useElapsedSeconds(active: boolean): number`: 0 while inactive; counts whole seconds while active; resets when active goes false. One interval, cleaned up.

- [ ] **Step 1: Write the failing test** in `elapsed.test.tsx`: a small probe component using the hook, fake timers, active true shows 0 then 3 after advancing 3 seconds; turning inactive resets to 0.
- [ ] **Step 2: Run it.** `npx vitest run src/pages/elapsed.test.tsx` Expected: FAIL (hook missing).
- [ ] **Step 3: Implement** the hook. Use it where work already has a busy flag: Invoice `writing` (the writing note gains `Working for N seconds.`), Pay `paying` (the paying note gains the same), WalletPanel connect (add a `connecting` flag around the connect call; the connecting note gains the same). Wording also names the slow part on Invoice and Pay: the device is building the private proof and that is the slow step.
- [ ] **Step 4: Run the touched page tests.** `npx vitest run src/pages/elapsed.test.tsx src/pages/invoiceLinkFlow.test.tsx src/pages/walletPanel.test.tsx src/pages/paySessionTruth.test.tsx` Expected: PASS.
- [ ] **Step 5: Commit.** `git add apps/web/src/pages/useElapsedSeconds.ts apps/web/src/pages/elapsed.test.tsx apps/web/src/pages/Invoice.tsx apps/web/src/pages/Pay.tsx apps/web/src/pages/WalletPanel.tsx` with message `feat: elapsed seconds on long network steps`.

### Task 6: Full verification and trial copy

**Files:**
- Modify: `docs/qa/2026-11-20-role-boundary-walk.md` (create: walk findings, fixes, evidence, owner checklist)

- [ ] **Step 1: Fast suite and type check.** `npx tsc --noEmit -p .` clean; the full fast suite (the exclude list used for the fix campaign) all passing.
- [ ] **Step 2: Build.** `npx vite build` passes.
- [ ] **Step 3: Live sanity.** Rerun `src/chain/testnetAcceptance.test.ts` with the testnet env vars set. Expected: PASS, and note the bill write seconds against the 18 to 27 second baseline.
- [ ] **Step 4: Two review passes.** Spec pass: every spec line has code and a test. Quality pass: read the full diff, check error words, check no secrets, check the fallback only runs in a browser.
- [ ] **Step 5: Push and check the trial copy.** Push the branch, wait for the Vercel preview deployment for the head commit to be READY, curl the preview bundle for the new words (boundary, storage message) and confirm the build carries the testnet settings. Write the QA note with the owner walk checklist: payer browser that failed before (Firefox private or the same browser), two tabs connecting at once in that browser, worker makes a bill and copies the link (no pay page offered), client pays, worker reads My pay.
- [ ] **Step 6: Commit the QA note and report.** No merge. The owner walks the trial copy and decides.
