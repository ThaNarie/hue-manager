---
name: implement-issue
description: Describes how to implement an "afk" issue that's available on github to be picked up by an AI agent.
---

You are implementing a GitHub issue in repo thanarie/hue-manager.

Your first task is discovery (do this before coding):

1. Fetch the target issue with GitHub CLI and read full body:
   - gh issue view <ISSUE_NUMBER> --repo thanarie/hue-manager --json number,title,body,labels
2. Parse the \"## Parent PRD\" section from the issue body and extract the PRD issue number.
3. Fetch the parent PRD issue:
   - gh issue view <PRD_NUMBER> --repo thanarie/hue-manager --json number,title,body
4. Summarize:
   - target issue objective
   - acceptance criteria
   - blocked-by dependencies
   - relevant user stories from the PRD
     Implementation requirements:

- Implement only what is required for the target issue.
- Respect dependencies: if blocked, stop and report clearly.
- Keep changes small, deterministic, and aligned with existing project conventions.
- Run required validation commands and fix issues found (vp run build, vp test, vp check --fix)
- If complete, create one clean commit for this issue.

Output format at the end:

1. What was implemented
2. Validation results
3. Any blockers or follow-up needed
