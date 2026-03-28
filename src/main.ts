import "./style.css";
import {
  type OverviewHealthResponse,
  parseOverviewHealthResponse,
} from "../shared/contracts/health";

type UiState =
  | { status: "loading" }
  | { status: "ready"; data: OverviewHealthResponse }
  | { status: "error"; message: string };

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Failed to locate #app root element");
}

app.innerHTML = `
  <main class="overview-page">
    <header class="overview-header">
      <h1>Hue Manager Overview</h1>
      <p>Tracer bullet: frontend + backend + shared contract validation.</p>
    </header>
    <section class="health-card" aria-live="polite">
      <h2>Bridge & Sync Health</h2>
      <dl class="health-grid">
        <div>
          <dt>Bridge</dt>
          <dd id="bridge-health">Loading...</dd>
        </div>
        <div>
          <dt>Sync</dt>
          <dd id="sync-health">Loading...</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd id="updated-at">Loading...</dd>
        </div>
      </dl>
      <p id="status-message" class="status-message">Requesting /api/health…</p>
    </section>
  </main>
`;

function requireElement<TElement extends HTMLElement>(selector: string): TElement {
  const element = document.querySelector<TElement>(selector);
  if (!element) {
    throw new Error(`Failed to locate required element: ${selector}`);
  }
  return element;
}

const bridgeHealthElement = requireElement<HTMLElement>("#bridge-health");
const syncHealthElement = requireElement<HTMLElement>("#sync-health");
const updatedAtElement = requireElement<HTMLElement>("#updated-at");
const statusMessageElement = requireElement<HTMLElement>("#status-message");

function renderState(state: UiState): void {
  if (state.status === "loading") {
    bridgeHealthElement.textContent = "Loading...";
    syncHealthElement.textContent = "Loading...";
    updatedAtElement.textContent = "Loading...";
    statusMessageElement.textContent = "Requesting /api/health…";
    statusMessageElement.dataset.state = "loading";
    return;
  }

  if (state.status === "error") {
    bridgeHealthElement.textContent = "Unknown";
    syncHealthElement.textContent = "Unknown";
    updatedAtElement.textContent = "Unknown";
    statusMessageElement.textContent = state.message;
    statusMessageElement.dataset.state = "error";
    return;
  }

  bridgeHealthElement.textContent = `${state.data.bridge.status} (${state.data.bridge.connected ? "connected" : "disconnected"})`;
  syncHealthElement.textContent = `${state.data.sync.status} (${state.data.sync.pendingJobs} pending)`;
  updatedAtElement.textContent = new Date(state.data.generatedAt).toLocaleString();
  statusMessageElement.textContent = "Health contract validated with shared Zod schema.";
  statusMessageElement.dataset.state = "ready";
}

async function loadHealth(): Promise<void> {
  renderState({ status: "loading" });

  try {
    const response = await fetch("/api/health");

    if (!response.ok) {
      throw new Error(`Health endpoint failed: ${response.status}`);
    }

    const payload = await response.json();
    const parsed = parseOverviewHealthResponse(payload);
    renderState({ status: "ready", data: parsed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown health check error";
    renderState({ status: "error", message: `Unable to load health: ${message}` });
  }
}

void loadHealth();
