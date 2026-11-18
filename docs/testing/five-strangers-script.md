# Five strangers test script

Goal: five people who have never seen this app try the full path
with fake money. We watch where they get stuck. We do not help
unless they are fully stuck, and we write down when that happens.

The app proves one single payment: a worker makes a bill, a client
pays in private, and the worker can prove that one bill was paid
in full without showing their other pay.

## Before the test

- Fake test money only. Say this out loud at the start.
- Use the trial site link from the owner. No sign up with real
  details. Test accounts only.
- One tester plays the worker. If a second person is there, they
  play the client. If not, the tester plays both with the test
  sign in buttons.

## The task (read this to the tester)

1. Make an invoice for a made up job. Any title, amount 1250,
   client mark Client A.
2. Open the pay link and pay the bill.
3. Go to My pay and find the paid bill.
4. Make a proof. Keep the amount hidden.
5. Open the check link and read what it says.

## Time each step (from our own runs, local network)

- Sign in with a test account: about 20 seconds the first time.
- Make an invoice on chain: a few seconds.
- Pay in private: a few seconds. The whole live path test
  (invoice, pay, read back) took about 16 seconds.
- Make a proof mark: under a minute.
- On the public test network each step took under about two
  minutes, most under one minute. First account there took
  about 20 seconds to make.

Write the real times next to these and note every slow step.

## What to note

- Where did the tester pause or look confused?
- Did they trust the check page? Why or why not?
- Did they understand that the amount was hidden on purpose?
- Any words they did not understand. Write the exact words.
- Did anything look broken or too slow?

## The one pay question

At the end ask exactly this:

"If this worked with real money, would you pay for the proof
part? What would make you say yes or no?"

Write the answer word for word. If most testers say no, we stop
and rethink before building more.

## Privacy scan result (done 2026-11-18)

- Searched the built site and source for keys, passwords, and
  seed words: none found.
- Searched the built site for the test worker address and the
  test job text: none found.
- Public chain state in tests held only hashes and flags: the
  amount, payer mark, and worker address never appeared plain.
- The test amount string appears only inside the Aztec library
  code that ships with any Aztec app, not in our app data.

## Thanks

Thank the tester, tell them their notes shape what gets built
next, and give them the public journey link if the owner has
shared one. No tester names or details go in public posts.
