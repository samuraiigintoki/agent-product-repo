import { useEffect, useState } from "react";
import type { Store } from "./domain/store";
import Home from "./pages/Home";
import Invoice from "./pages/Invoice";
import Pay from "./pages/Pay";
import MyPay from "./pages/MyPay";
import MakeProof from "./pages/MakeProof";
import CheckProof from "./pages/CheckProof";

function currentRoute(): string {
  const hash = window.location.hash.replace(/^#/, "");
  return hash === "" ? "/" : hash;
}

export default function App({ store }: { store: Store }) {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

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
    return <MyPay store={store} />;
  }
  if (route === "/proof") {
    return <MakeProof store={store} />;
  }
  return <Home />;
}
