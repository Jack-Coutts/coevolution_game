#!/bin/bash
# Push every owner branch to origin as claude/wip-<branch> (backup only; force because owners rebase).
cd /home/user/coevolution_game || exit 1
for b in intervention-balance playtest-fixes third-species-design third-species-prototype endless-budget scenario-calibration vole-sim journal-family vole-play body-traits varieties brain-evidence brain-growth brains varieties $(git for-each-ref --format='%(refname:short)' refs/heads/ | grep -E '^(owner|wip)-'); do
  git show-ref --verify -q refs/heads/$b || continue
  git push -q -f origin "refs/heads/$b:refs/heads/claude/wip-$b" 2>&1 | grep -v "^remote:" | head -2
done
# Also back up the decision trail and playtest logs on a notes branch.
tmp=$(mktemp -d); git worktree add -q --detach "$tmp" origin/main 2>/dev/null && (
  cd "$tmp" && mkdir -p notes && cp $0 notes/ 2>/dev/null; cp /tmp/claude-0/-home-user-coevolution-game/de370d50-e627-57ba-b947-1eedd998ffb2/scratchpad/decisions.tsv notes/ &&
  cp -r /tmp/claude-0/-home-user-coevolution-game/de370d50-e627-57ba-b947-1eedd998ffb2/scratchpad/playtest/*.md notes/ 2>/dev/null
  git add notes && git -c user.name=backup -c user.email=backup@local commit -qm "notes: program decision trail and playtest logs (backup)" && git push -q -f origin HEAD:refs/heads/claude/wip-notes 2>&1 | grep -v "^remote:" | head -2
); git worktree remove --force "$tmp" 2>/dev/null
echo "backup $(date -u +%H:%M:%S)"
