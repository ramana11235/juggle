# Issue tracker: GitHub

Issues for this repo live as GitHub issues on this repo. Use the `gh` CLI for all operations. `gh` finds the repo from `git remote -v` when run inside a clone.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..." --label needs-triage`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`. Add `--json labels,body,comments` to get the fields as JSON.
- **List issues**: `gh issue list --state open --json number,title,labels` with `--label` and `--state` filters as needed.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Close**: `gh issue close <number> --comment "..."`
- **Status**: an issue's Status is one of the triage labels in `triage-labels.md`, and it has exactly one. Change it with `gh issue edit <number> --add-label "..." --remove-label "..."`.
- **Blocking**: use GitHub's own blocking between issues ("blocked by" in the issue's Relationships), set with `gh api -X POST repos/<owner>/<repo>/issues/<number>/dependencies/blocked_by -F issue_id=<id of the blocker>`. The blocker's id is the `id` from `gh api repos/<owner>/<repo>/issues/<number>`, not its number.

## The queue

The queue is the repo's GitHub Projects board, project 2 of the repo's owner. Its columns are Needs triage, Ready, In progress, Waiting on me and Done. The order within a column is the order of work, so the top of Ready goes next. The board's README holds the queue's rules. Work it with `gh project item-list 2 --owner @me`, `gh project item-add 2 --owner @me --url <issue url>` and `gh project item-edit`, which takes the ids that `gh project item-list 2 --owner @me --format json` and `gh project field-list 2 --owner @me --format json` give. Moving a card within its column needs `gh api graphql` with the `updateProjectV2ItemPosition` mutation. `gh` needs the `project` scope for this, added with `gh auth refresh -s project`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.
