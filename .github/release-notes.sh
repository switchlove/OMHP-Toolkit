#!/usr/bin/env bash
# Prints release notes built from the messages of commits that changed the script
# between two refs (repo tooling and Dependabot commits are left out).
# Usage: release-notes.sh <previous tag> <commit> <new tag>
set -euo pipefail
prev=$1 to=$2 tag=$3
repo=${GITHUB_REPOSITORY:-switchlove/OMHP-Toolkit}

for c in $(git rev-list --no-merges --reverse "$prev..$to" -- omhp-toolkit.user.js); do
    echo "- $(git log -1 --format=%s "$c")"
    git log -1 --format=%b "$c" | { grep -vi '^co-authored-by:' || true; } | sed '/^$/d; s/^/  /'
done
echo
echo "**Full Changelog**: https://github.com/$repo/compare/$prev...$tag"
