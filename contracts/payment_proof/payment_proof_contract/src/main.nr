use aztec::macros::aztec;

#[aztec]
pub contract Main {
    use aztec::{
        macros::{
            functions::{external, initializer, view},
            notes::note,
            storage::storage,
        },
        messages::delivery::MessageDelivery,
        note::note_viewer_options::NoteViewerOptions,
        protocol::{address::AztecAddress, hash::poseidon2_hash, traits::{Packable, ToField}},
        state_vars::{Map, Owned, PrivateSet, PublicMutable},
    };

    // A bill the worker made. Only the worker can read this note.
    #[derive(Eq, Packable)]
    #[note]
    pub struct InvoiceNote {
        pub bill_id: Field,
        pub amount: u128,
        pub due_mark: Field,
    }

    // Proof of one paid bill. Only the worker can read this note.
    #[derive(Eq, Packable)]
    #[note]
    pub struct ReceiptNote {
        pub bill_id: Field,
        pub amount: u128,
        pub payer_mark: Field,
        pub paid_block: u32,
    }

    #[storage]
    struct Storage<Context> {
        invoices: Owned<PrivateSet<InvoiceNote, Context>, Context>,
        receipts: Owned<PrivateSet<ReceiptNote, Context>, Context>,
        // Public book, keyed by a hash of worker and bill mark.
        // It holds only a hash of the amount and a paid flag.
        // The amount, the payer mark, and the worker address
        // are never stored here in plain form.
        amount_hashes: Map<Field, PublicMutable<Field, Context>, Context>,
        paid_flags: Map<Field, PublicMutable<bool, Context>, Context>,
        // Public proof marks, keyed by a hash of the claim.
        // Only the claim hash and its expiry number are stored.
        // Claim words and any amount never go in here.
        proof_marks: Map<Field, PublicMutable<Field, Context>, Context>,
    }

    #[initializer]
    #[external("private")]
    fn constructor() {}

    // The worker makes a bill. The bill note stays private with the
    // worker. A hashed record goes to the public book so a later pay
    // can be checked for the exact amount and paid only once.
    #[external("private")]
    fn create_invoice(bill_id: Field, amount: u128, due_mark: Field) {
        let worker = self.msg_sender();
        let note = InvoiceNote { bill_id, amount, due_mark };
        self.storage.invoices.at(worker).insert(note).deliver(MessageDelivery::onchain_constrained());

        let key = poseidon2_hash([worker.to_field(), bill_id]);
        let amount_hash = poseidon2_hash([amount as Field, bill_id]);
        self.enqueue_self._register_invoice(key, amount_hash);
    }

    #[external("public")]
    fn _register_invoice(key: Field, amount_hash: Field) {
        assert(self.storage.amount_hashes.at(key).read() == 0, "bill is already made");
        self.storage.amount_hashes.at(key).write(amount_hash);
        self.storage.paid_flags.at(key).write(false);
    }

    // The payer pays one bill in private. The public book checks the
    // exact amount through its hash and blocks a second pay. The
    // receipt note goes to the worker and only the worker can read it.
    #[external("private")]
    fn pay_invoice(worker: AztecAddress, bill_id: Field, amount: u128, payer_mark: Field, paid_block: u32) {
        let key = poseidon2_hash([worker.to_field(), bill_id]);
        let amount_hash = poseidon2_hash([amount as Field, bill_id]);
        self.enqueue_self._check_and_mark_paid(key, amount_hash);

        let note = ReceiptNote { bill_id, amount, payer_mark, paid_block };
        self.storage.receipts.at(worker).insert(note).deliver(MessageDelivery::onchain_constrained());
    }

    #[external("public")]
    fn _check_and_mark_paid(key: Field, amount_hash: Field) {
        assert(self.storage.amount_hashes.at(key).read() != 0, "bill is not made");
        assert(
            self.storage.amount_hashes.at(key).read() == amount_hash,
            "amount does not match the bill",
        );
        assert(self.storage.paid_flags.at(key).read() == false, "bill is already paid");
        self.storage.paid_flags.at(key).write(true);
    }

    // Writes one proof mark in public: the claim hash and the
    // day the proof runs out, as a YYYYMMDD number. Nothing else.
    #[external("public")]
    fn mark_proof(claim_hash: Field, expires_at: Field) {
        assert(self.storage.proof_marks.at(claim_hash).read() == 0, "proof is already marked");
        self.storage.proof_marks.at(claim_hash).write(expires_at);
    }

    #[external("public")]
    #[view]
    fn proof_expiry(claim_hash: Field) -> Field {
        self.storage.proof_marks.at(claim_hash).read()
    }

    #[external("public")]
    #[view]
    fn invoice_paid(key: Field) -> bool {
        self.storage.paid_flags.at(key).read()
    }

    #[external("public")]
    #[view]
    fn invoice_amount_hash(key: Field) -> Field {
        self.storage.amount_hashes.at(key).read()
    }

    // The key that links a worker and a bill mark in the public book.
    // It is a hash, so the worker address does not appear in public.
    #[external("utility")]
    unconstrained fn bill_key(worker: AztecAddress, bill_id: Field) -> pub Field {
        poseidon2_hash([worker.to_field(), bill_id])
    }

    #[external("utility")]
    unconstrained fn invoices_count(owner: AztecAddress) -> pub u32 {
        let notes = self.storage.invoices.at(owner).view_notes(NoteViewerOptions::new());
        notes.len()
    }

    // Returns [count, bill mark, amount, payer mark, paid block] of
    // the first receipt, or all zeros when there is none. Only the
    // owner of the receipts can get a non-zero read in a real wallet,
    // because the notes are private to the owner.
    #[external("utility")]
    unconstrained fn read_receipts(owner: AztecAddress) -> pub [Field; 5] {
        let notes = self.storage.receipts.at(owner).view_notes(NoteViewerOptions::new());
        if notes.len() == 0 {
            [0, 0, 0, 0, 0]
        } else {
            let note = notes.get_unchecked(0);
            [
                notes.len() as Field,
                note.bill_id,
                note.amount as Field,
                note.payer_mark,
                note.paid_block as Field,
            ]
        }
    }
}
