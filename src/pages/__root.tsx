import { Outlet } from "@tanstack/react-router";
import { Navigation } from "../components/Navigation/Navigation";

export function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Hue Manager</h1>
          <p className="text-muted-foreground">
            Tracer bullet: React frontend + Hono backend + shared Zod contract validation.
          </p>
        </header>

        <Outlet />
      </main>
    </div>
  );
}
