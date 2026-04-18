import { RootRoute, Route, createRouter } from "@tanstack/react-router";
import { RootLayout } from "./pages/__root";
import { IndexPage } from "./pages/index";
import { AutomationsPage } from "./pages/automations";
import { LightsPage } from "./pages/lights";
import { AuditPage } from "./pages/audit";
import { ScenesPage } from "./pages/scenes";
import { GroupsPage } from "./pages/groups";

// Create the root route
const rootRoute = new RootRoute({
  component: RootLayout,
});

// Create all the routes
const indexRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexPage,
});

const automationsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/automations",
  component: AutomationsPage,
});

const lightsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/lights",
  component: LightsPage,
});

const auditRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/audit",
  component: AuditPage,
});

const scenesRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/scenes",
  component: ScenesPage,
});

const groupsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/groups",
  component: GroupsPage,
});

// Create the route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  automationsRoute,
  lightsRoute,
  auditRoute,
  scenesRoute,
  groupsRoute,
]);

// Create the router instance
export const router = createRouter({ routeTree });

// Register router for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
