# Design: Get Paid in Private, Prove It When It Counts

Date: 2026-11-18
State: Draft for owner approval. No product code written yet.
Place after approval: docs folder of the GitHub repo, on a branch.

## 1. What we are making and why

People who earn in crypto have two linked pains.

First, pay on public chains is open for anyone to see. Clients,
rivals, and strangers can see who paid them and how much.

Second, private pay alone is not enough for real life. A landlord,
a bank, or a visa office still asks for proof of income. A worker
who hides everything has nothing they can show.

Our product joins both halves. A worker gets paid in private on
Aztec. The pay record stays with the worker. When life asks for
proof, the worker makes a proof pack that shows only the few facts
needed, such as earning above a set amount in the last six months.
The checker sees that the proof is valid and sees nothing else,
unless the worker chooses to show more.

## 2. Who it is for first

First user: a freelancer or remote worker who is paid in crypto
and has felt the pain of proving income to a landlord or a bank.

Second user: the client who pays the invoice. The client must be
able to pay with as little new learning as possible.

Third user: the checker. A landlord, bank worker, or other person
who opens a proof link. The checker needs no wallet and no crypto
knowledge. The page must read like a normal document check.

Later users: small web3 teams who pay many workers and want to
give proof of income as a perk of working with them.

## 3. The three ways we could have built it

Way A, our pick. Build an app on top of Aztec. Aztec already does
the hard private maths. We build the invoice, the pay record, and
the proof. Fast to test, safe to learn on, and a real shot at the
Aztec apps list because the app only makes sense with privacy.

Way B. Build our own chain. Rejected. The maths is too deep for a
solo builder, one safety bug can lose people money, and we would
spend years before the first user.

Way C. Build on a normal public chain and hide amounts with extra
tools bolted on. Rejected. Pay would still leak who paid whom and
when, and the tool would be weaker than Aztec at its core job.

## 4. What version one does

Fake money only. Test network only. No real funds at any point.

1. A worker signs in with a test Aztec wallet and makes an invoice.
   The invoice has a title for the work, an amount, and the name or
   mark of the client.
2. The app makes a link. The worker sends the link to the client.
3. The client opens the link, checks the bill, and pays with test
   money. The payment moves in private.
4. The worker's app keeps a private pay record: amount, date,
   invoice mark, and a private note that only the worker can read.
5. The worker asks for a proof. Version one proves one single
   payment, done well. The claim reads in plain words: this bill
   was paid in full, on this date. The worker chooses if the exact
   amount is shown or stays hidden. Hidden is the starting choice.
   The six month income proof comes after this first milestone.
6. The app checks the worker's private record on the worker's own
   device and makes a proof. It writes a short public mark of that
   proof, with an expiry date, so the proof cannot be quietly
   edited later and cannot be reused forever.
7. The worker sends the checker a link. The checker opens a plain
   page that shows the claim, the word valid in clear view, the
   date, and when the proof runs out. No wallet needed.

What stays private: who paid, exact amounts of each payment, the
full pay history, and the worker's wallet address.
What is public: that a proof was made, the one claim in the proof,
its date, and its expiry. Nothing more.

## 5. What version one does not do

No real money. No loans, no rent decisions, and no tax or legal
advice. No name or passport checks in version one. No team payroll.
No bridge to Ethereum. No mobile app. No token of our own.

## 6. How people will see it (text sketch)

Worker home shows three big buttons: New invoice, My pay, Make proof.
An invoice page shows the work title, the amount, and a Pay button.
A proof page for the checker shows one claim in big plain words,
a green valid mark, the date, and the expiry date. It should look
like a document check, not a crypto page.

## 7. How it would be built (my calls, owner may overrule)

A web app in TypeScript, the common language for web pages.
Aztec contracts in Noir with the Aztec.nr tools, following the
Aztec docs and their private token guide.
Local Aztec network first, then the public test network.
The app never holds user money and never sees private keys.
Records live as private notes owned by the worker, read through
the worker's own wallet permission.

## 8. Money (later, not version one)

Workers pay a small fee for a proof pack, or a low monthly plan.
Teams pay monthly to pay workers in private and give them proof
of income as a perk. Later, checkers such as banks may pay to
check proofs at scale. Version one only tests if people want it.

## 9. How we know version one worked

Five test workers finish the full path with fake money: invoice,
private pay, proof, and a checker opening the link.
Each step is timed. We note where people get stuck.
We ask each worker one thing: would you pay for this proof when
it works with real money, and why.
If most say no, we stop and rethink before building more.

## 10. Risks and hard truths

The Aztec network is still early stage software. Aztec itself tells
people to check network state before moving anything of value.
So real money stays out until the network is proven and a lawyer
has checked our path.

Wallet learning is the biggest user risk. If a normal client cannot
pay in a few minutes, the product dies, no matter how good the
maths is. Version one must time this with real people.

Proof of pay inside our app is not proof of honest income. A person
could pay themselves or ask a friend to send money in circles.
Version one is honest about this limit. Later versions need payer
marks, signed invoices, and checks on where money came from.

If a worker loses their wallet access, private records may be hard
to get back. Backup and recovery must be designed before real use.

## 11. Builder check (done by reading this as a fresh builder)

Answered from the Aztec docs: private contracts, private records
as notes, proof made on the user device, and a local test network
all exist today. So the shape of version one is buildable.

Settled by me as minor calls: one claim only in version one, fake
money only, web only, no name checks yet.

Owner answers, given on 2026-11-18:
Name: waits until the first working version is done. A working
name is used until then.
First proof: one single payment, done well. The six month income
proof comes after that milestone.
First test users: strangers, found through the public journey
in section 12. The owner does not have testers ready.

## 12. Building in public (brand journey and test user hunt)

The build will be shared in public, step by step, while it happens.
A second chat will own that work: posts, pictures, short videos,
and the story of the journey. This chat stays the build chat.

The second chat does not guess. For each milestone, this chat
hands it a packet with: what changed, why it matters, proof it
works (test result or screen picture), one honest hard moment,
and what comes next. The second chat turns that packet into
posts and video scripts in the same plain voice used here.

Rules for the public journey:
Real progress only. No vague hype, no price talk, no promise of
making money, no token talk, no fake user counts.
Show the work: screens, timed tests, things that broke, fixes.
Never show keys, wallet secrets, or real user details. Fake money
and test names only, until real users give clear permission.
Test users are invited in public at set points: five workers for
the first milestone test, with a small clear task and thanks.
Every post ends with one honest next step and, at test points,
one clear ask for testers.
The owner approves every post before it goes out. Nothing is
posted by a chat on its own.
The full hand over plan for the second chat lives in the file
notes/build-in-public-plan.md.
