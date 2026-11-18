import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { createStore } from "./domain/store";

const store = createStore();
const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App store={store} />
    </StrictMode>,
  );
}
