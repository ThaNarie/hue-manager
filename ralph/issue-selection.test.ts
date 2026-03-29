import { describe, expect, test } from "vite-plus/test";

import { parseBlockedByDependencies } from "./issue-selection.js";

describe("parseBlockedByDependencies", () => {
  test("returns none when blocked-by heading is missing", () => {
    const parsed = parseBlockedByDependencies(`
## What to build

Do the work.
`);

    expect(parsed).toEqual({ status: "none", dependencies: [] });
  });

  test("parses strict blocked-by lines", () => {
    const parsed = parseBlockedByDependencies(`
## Blocked by

- Blocked by #21
- Blocked by #3
`);

    expect(parsed).toEqual({ status: "valid", dependencies: [3, 21] });
  });

  test("returns valid empty dependencies for an empty blocked-by section", () => {
    const parsed = parseBlockedByDependencies(`
## Blocked by

## User stories addressed
- User story 1
`);

    expect(parsed).toEqual({ status: "valid", dependencies: [] });
  });

  test("treats malformed blocked-by lines as invalid", () => {
    const parsed = parseBlockedByDependencies(`
## Blocked by

- blocked by #21
`);

    expect(parsed).toEqual({
      status: "invalid",
      dependencies: [],
      reason: "malformed blocked-by section",
    });
  });

  test("deduplicates dependency numbers and keeps deterministic order", () => {
    const parsed = parseBlockedByDependencies(`
## Blocked by

- Blocked by #9
- Blocked by #2
- Blocked by #9
`);

    expect(parsed).toEqual({ status: "valid", dependencies: [2, 9] });
  });
});
