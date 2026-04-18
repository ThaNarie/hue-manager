import { Link } from "@tanstack/react-router";

export function Navigation() {
  const links = [
    { path: "/", label: "Overview" },
    { path: "/automations", label: "Automations" },
    { path: "/lights", label: "Lights" },
    { path: "/audit", label: "Audit" },
    { path: "/scenes", label: "Scenes" },
    { path: "/groups", label: "Groups" },
  ];

  return (
    <nav className="border-b border-border">
      <div className="mx-auto flex max-w-5xl gap-6 px-4">
        {links.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className="border-b-2 border-transparent px-1 py-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:border-foreground data-[status=active]:text-foreground"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
