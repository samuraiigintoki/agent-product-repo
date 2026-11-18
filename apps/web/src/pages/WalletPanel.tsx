import { useState } from "react";
import {
  createUserWallet,
  hasUserWallet,
  isWalletOpen,
  lockUserWallet,
  openWalletAddress,
  removeUserWallet,
  restoreUserWallet,
  unlockUserWallet,
  shortAddress,
  type WalletStorage,
} from "../chain/userWallet";

// The wallet area on the home page. Plain screens only: the
// design pass comes with the dashboard slice. Words are kept
// short and honest. The backup code is shown once, at create
// time, and never again.
export default function WalletPanel({
  storage,
}: {
  storage?: WalletStorage;
}) {
  const [tick, setTick] = useState(0);
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [backupInput, setBackupInput] = useState("");
  const [restorePassword, setRestorePassword] = useState("");
  const [backupShown, setBackupShown] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const refresh = () => setTick((value) => value + 1);
  void tick;

  const hasWallet = hasUserWallet(storage);
  const walletOpen = isWalletOpen();
  const address = openWalletAddress();

  const fail = (error: unknown) => {
    setNote(error instanceof Error ? error.message : "Something went wrong.");
  };

  const create = async () => {
    if (password !== passwordAgain) {
      setNote("The two passwords do not match.");
      return;
    }
    try {
      const created = await createUserWallet(password, storage);
      setBackupShown(created.backupCode);
      setPassword("");
      setPasswordAgain("");
      setNote("Your wallet is made and open. Save the backup code now.");
      refresh();
    } catch (error) {
      fail(error);
    }
  };

  const unlock = async () => {
    try {
      await unlockUserWallet(password, storage);
      setPassword("");
      setNote("Wallet open.");
      refresh();
    } catch (error) {
      fail(error);
    }
  };

  const restore = async () => {
    try {
      await restoreUserWallet(backupInput, restorePassword, storage);
      setBackupInput("");
      setRestorePassword("");
      setNote("Wallet restored and open.");
      refresh();
    } catch (error) {
      fail(error);
    }
  };

  const inputStyle = { fontSize: 18, padding: 10, width: "100%" } as const;
  const buttonStyle = { fontSize: 18, padding: 12 } as const;

  return (
    <div style={{ marginTop: 32, border: "1px solid #999", padding: 16 }}>
      <p style={{ fontSize: 20, margin: "4px 0" }}>My wallet</p>
      <p>
        Your keys are made on this device and locked with your
        password. They never leave this device. If you lose your
        password and your backup code, this wallet is gone for
        good. No one can bring it back.
      </p>

      {!hasWallet && backupShown === null && (
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ display: "grid", gap: 4, fontSize: 18 }}>
            New password (at least 8 characters)
            <input
              type="password"
              style={inputStyle}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 18 }}>
            Type the password again
            <input
              type="password"
              style={inputStyle}
              value={passwordAgain}
              onChange={(event) => setPasswordAgain(event.target.value)}
            />
          </label>
          <button style={buttonStyle} onClick={create}>
            Create my wallet
          </button>
          <label style={{ display: "grid", gap: 4, fontSize: 18 }}>
            Backup code (only to restore a wallet)
            <textarea
              style={{ ...inputStyle, minHeight: 60 }}
              value={backupInput}
              onChange={(event) => setBackupInput(event.target.value)}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 18 }}>
            Password for that backup
            <input
              type="password"
              style={inputStyle}
              value={restorePassword}
              onChange={(event) => setRestorePassword(event.target.value)}
            />
          </label>
          <button style={buttonStyle} onClick={restore}>
            Restore my wallet
          </button>
        </div>
      )}

      {backupShown !== null && (
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ fontSize: 18 }}>
            This is your backup code. Save it somewhere safe, like
            a password manager or on paper. It is shown only this
            once. Anyone with this code and your password can open
            your wallet.
          </p>
          <p style={{ fontSize: 16, wordBreak: "break-all" }}>{backupShown}</p>
          <button
            style={buttonStyle}
            onClick={() => {
              setBackupShown(null);
              refresh();
            }}
          >
            I saved my backup code
          </button>
        </div>
      )}

      {hasWallet && !walletOpen && backupShown === null && (
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ display: "grid", gap: 4, fontSize: 18 }}>
            Password
            <input
              type="password"
              style={inputStyle}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button style={buttonStyle} onClick={unlock}>
            Unlock my wallet
          </button>
        </div>
      )}

      {hasWallet && walletOpen && backupShown === null && (
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ fontSize: 18 }}>
            Wallet open.
            {address ? ` Address: ${shortAddress(address)}` : ""}
          </p>
          <button
            style={buttonStyle}
            onClick={() => {
              lockUserWallet();
              setNote("Wallet locked.");
              refresh();
            }}
          >
            Lock my wallet
          </button>
          {!confirmRemove ? (
            <button style={buttonStyle} onClick={() => setConfirmRemove(true)}>
              Remove wallet from this device
            </button>
          ) : (
            <button
              style={buttonStyle}
              onClick={() => {
                removeUserWallet(storage);
                setConfirmRemove(false);
                setNote(
                  "Wallet removed from this device. Your backup code can bring it back.",
                );
                refresh();
              }}
            >
              Yes, remove it
            </button>
          )}
        </div>
      )}

      {note !== null && (
        <p role="alert" style={{ fontSize: 18 }}>
          {note}
        </p>
      )}
    </div>
  );
}
