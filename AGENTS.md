# Agents guide

## Check your work

```bash
node scripts/control.mjs doctor    # environment, git hooks, work branch
node scripts/control.mjs verify    # typecheck, lint and tests (node --test)
node scripts/control.mjs --help    # screenshot and get
```

The feature map in `.claude/verification/features/README.md` lists every page and API route with a command to exercise it. Update it when you add or change a feature.

## Branch policy

Work on a `feat/`, `fix/` or `hotfix/` branch. Commits on `main` are blocked by the git hooks in `.githooks/`. Use conventional commits.

## Careful

`npm run sync:onpe`, `/api/cron` and `/api/scrape` write to the database. `scripts/control.mjs get` refuses the last two.
