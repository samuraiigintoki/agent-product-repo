use aztec::{
    protocol::{address::AztecAddress, traits::ToField},
    test::helpers::test_environment::TestEnvironment,
};
use payment_proof_contract::Main;

unconstrained fn setup() -> (TestEnvironment, AztecAddress, AztecAddress, AztecAddress, AztecAddress) {
    let mut env = TestEnvironment::new();
    let payer = env.create_light_account();
    let worker = env.create_light_account();
    let other = env.create_light_account();
    let contract_address = env.deploy("@payment_proof_contract/Main")
        .with_private_initializer(payer, Main::interface().constructor());
    (env, contract_address, payer, worker, other)
}

#[test]
unconstrained fn test_invoice_made_and_unpaid() {
    let (mut env, contract_address, _, worker, _) = setup();

    env.call_private(worker, Main::at(contract_address).create_invoice(42, 1250, 7));

    let count = env.execute_utility(Main::at(contract_address).invoices_count(worker));
    assert_eq(count, 1);

    let key = env.execute_utility(Main::at(contract_address).bill_key(worker, 42));
    let paid = env.view_public(Main::at(contract_address).invoice_paid(key));
    assert_eq(paid, false);
}

#[test]
unconstrained fn test_pay_exact_gives_worker_receipt() {
    let (mut env, contract_address, payer, worker, _) = setup();

    env.call_private(worker, Main::at(contract_address).create_invoice(42, 1250, 7));
    env.call_private(payer, Main::at(contract_address).pay_invoice(worker, 42, 1250, 99, 9));

    // read_receipts returns [count, bill mark, amount, payer mark, paid block]
    let view = env.execute_utility(Main::at(contract_address).read_receipts(worker));
    assert_eq(view[0], 1);
    assert_eq(view[1], 42);
    assert_eq(view[2], 1250);
    assert_eq(view[3], 99);
    assert_eq(view[4], 9);

    let key = env.execute_utility(Main::at(contract_address).bill_key(worker, 42));
    let paid = env.view_public(Main::at(contract_address).invoice_paid(key));
    assert_eq(paid, true);
}

#[test(should_fail_with = "amount does not match the bill")]
unconstrained fn test_pay_wrong_amount_fails() {
    let (mut env, contract_address, payer, worker, _) = setup();

    env.call_private(worker, Main::at(contract_address).create_invoice(42, 1250, 7));
    env.call_private(payer, Main::at(contract_address).pay_invoice(worker, 42, 1000, 99, 9));
}

#[test(should_fail_with = "bill is already paid")]
unconstrained fn test_second_pay_of_same_bill_fails() {
    let (mut env, contract_address, payer, worker, _) = setup();

    env.call_private(worker, Main::at(contract_address).create_invoice(42, 1250, 7));
    env.call_private(payer, Main::at(contract_address).pay_invoice(worker, 42, 1250, 99, 9));
    env.call_private(payer, Main::at(contract_address).pay_invoice(worker, 42, 1250, 99, 10));
}

#[test]
unconstrained fn test_third_account_reads_no_receipt() {
    let (mut env, contract_address, payer, worker, other) = setup();

    env.call_private(worker, Main::at(contract_address).create_invoice(42, 1250, 7));
    env.call_private(payer, Main::at(contract_address).pay_invoice(worker, 42, 1250, 99, 9));

    let view = env.execute_utility(Main::at(contract_address).read_receipts(other));
    assert_eq(view[0], 0);
}

#[test]
unconstrained fn test_public_record_hides_amount_payer_and_worker() {
    let (mut env, contract_address, payer, worker, _) = setup();

    env.call_private(worker, Main::at(contract_address).create_invoice(42, 1250, 7));
    env.call_private(payer, Main::at(contract_address).pay_invoice(worker, 42, 1250, 99, 9));

    let key = env.execute_utility(Main::at(contract_address).bill_key(worker, 42));
    let amount_hash = env.view_public(Main::at(contract_address).invoice_amount_hash(key));

    // The public record holds only a hash of the amount and a paid flag.
    // The plain amount, the payer mark, and the worker address never appear.
    assert(amount_hash != 1250);
    assert(amount_hash != 99);
    assert(amount_hash != worker.to_field());
    assert(amount_hash != 0);
}
