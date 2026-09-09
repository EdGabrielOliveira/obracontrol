#!/usr/bin/env bash
set -Eeuo pipefail

repo_dir="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
remote="${GIT_REMOTE:-origin}"
branch="${GIT_BRANCH:-main}"

cd "$repo_dir"

current_branch="$(git branch --show-current)"
if [ "$current_branch" != "$branch" ]; then
	echo "A VPS deve estar na branch '$branch'; branch atual: '$current_branch'" >&2
	exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
	echo "Working tree não está limpo; atualização interrompida." >&2
	echo "Revise com: git status --short" >&2
	exit 1
fi

git pull --ff-only "$remote" "$branch"
bash "$repo_dir/ops/deploy.sh"
