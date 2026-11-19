// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import WalletPanel from "./WalletPanel";
import { lockUserWallet } from "../chain/userWallet";
import { dropChainSession } from "../chain/session";

beforeEach(() => {
  window.localStorage.clear();
  lockUserWallet();
  dropChainSession();
});
afterEach(cleanup);

describe("wallet panel", () => {
  it("warns in plain words before anything is made", () => {
    render(<WalletPanel />);
    expect(screen.getByText(/gone for good/)).toBeTruthy();
    expect(screen.getByText(/never leave this device/)).toBeTruthy();
  });

  it("create shows the backup code once, then lock and unlock work", async () => {
    render(<WalletPanel />);
    fireEvent.change(screen.getByLabelText(/New password/), {
      target: { value: "correct horse battery" },
    });
    fireEvent.change(screen.getByLabelText(/Type the password again/), {
      target: { value: "correct horse battery" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create my wallet" }));

    expect(await screen.findByText(/pp-backup\./)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "I saved my backup code" }),
    );
    expect(screen.queryByText(/pp-backup\./)).toBeNull();
    expect(screen.getByText(/Wallet open\./)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Connect my wallet to the network" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Lock my wallet" }));
    expect(screen.getByText(/Wallet locked/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong password here" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock my wallet" }));
    expect(
      await screen.findByText(/Wrong password or damaged backup/),
    ).toBeTruthy();
  });

  it("mismatched passwords stop creation with a plain note", async () => {
    render(<WalletPanel />);
    fireEvent.change(screen.getByLabelText(/New password/), {
      target: { value: "correct horse battery" },
    });
    fireEvent.change(screen.getByLabelText(/Type the password again/), {
      target: { value: "different password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create my wallet" }));
    expect(
      screen.getByText(/The two passwords do not match/),
    ).toBeTruthy();
    expect(screen.queryByText(/pp-backup\./)).toBeNull();
  });
});
