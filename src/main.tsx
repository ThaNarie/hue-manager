import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

const rootElement = document.querySelector<HTMLDivElement>("#app");

if (!rootElement) {
  throw new Error("Unable to locate #app root");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
