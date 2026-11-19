import { useEffect, useState } from "react";
import type { Store } from "./domain/store";
import Home from "./pages/Home";
import Invoice from "./pages/Invoice";
import Pay from "./pages/Pay";
import MyPay from "./pages/MyPay";
import MakeProof from "./pages/MakeProof";
import CheckProof from "./pages/CheckProof";
import {
  chainWorkerAddress,
  createInvoiceLive,
  dropChainSession,
  readMyBillPaymentsLive,
  readMyReceiptsLive,
} from "./chain/session";
import { BILLS_STORAGE_KEY } from "./domain/store";
import { WALLET_BOX_KEY } from "./chain/keyVault";
import {
  lockUserWallet,
  WALLET_LOCK_SIGNAL_KEY,
} from "./chain/userWallet";

function currentRoute(): string {
  const hash = window.location.hash.replace(/^#/, "");
  return hash === "" ? "/" : hash;
}

export default function App({ store }: { store: Store }) {
  const [route, setRoute] = useState(currentRoute);
  const [, setSyncTick] = useState(0);

  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === BILLS_STORAGE_KEY) {
        // Another tab saved bills. Merge them in and show
        // the fresh list instead of this tab's stale copy.
        if (store.syncFromStorage()) {
          setSyncTick((tick) => tick + 1);
        }
        return;
      }
      if (
        event.key === WALLET_BOX_KEY ||
        event.key === WALLET_LOCK_SIGNAL_KEY
      ) {
        // The wallet was locked, removed, or replaced in
        // another tab. Plain key material in this tab must
        // not stay open after that.
        lockUserWallet();
        void dropChainSession();
        setSyncTick((tick) => tick + 1);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [store]);

  const payMatch = route.match(/^\/pay\/(.+)$/);
  if (payMatch) {
    return <Pay store={store} id={payMatch[1]} />;
  }
  const checkMatch = route.match(/^\/check\/(.+)$/);
  if (checkMatch) {
    return <CheckProof store={store} id={checkMatch[1]} />;
  }
  if (route === "/invoice") {
    return <Invoice store={store} />;
  }
  if (route === "/mypay") {
    return (
      <MyPay
        store={store}
        readLive={readMyReceiptsLive}
        readPaymentsLive={readMyBillPaymentsLive}
        currentWorkerAddress={chainWorkerAddress()}
        writeLive={async (bill) =>
          createInvoiceLive({
            webInvoiceId: bill.id,
            amount: bill.amount,
            ...(bill.chainAttemptBillId
              ? { billId: bill.chainAttemptBillId }
              : {}),
          })
        }
      />
    );
  }
  if (route === "/proof") {
    return <MakeProof store={store} />;
  }
  return <Home />;
}
