import { GroupsDashboard } from "./components/GroupsDashboard/GroupsDashboard";
import { OverviewHealthCard } from "./components/OverviewHealthCard/OverviewHealthCard";
import { LightsDashboard } from "./components/LightsDashboard/LightsDashboard";
import { ScenesDashboard } from "./components/ScenesDashboard/ScenesDashboard";

export function App() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Hue Manager Overview
        </h1>
        <p className="text-muted-foreground">
          Tracer bullet: React frontend + Hono backend + shared Zod contract validation.
        </p>
      </header>

      <OverviewHealthCard />
      <LightsDashboard />
      <ScenesDashboard />
      <GroupsDashboard />
    </main>
  );
}
