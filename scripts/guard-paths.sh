#!/bin/bash
# Refuses files that must never enter this repository's history: design working files, wallpaper
# sources, raw video footage, render comparisons, old snapshots, and anything over 5 MB.
# Git history is permanent and this repository is public, so .gitignore alone is not enough: it has
# been bypassed before (a forced add, a file renamed out of an ignored folder). Called by
# .githooks/pre-commit and .githooks/pre-push with "path<TAB>size in bytes" lines on stdin.
# It refuses and explains; it never removes anything itself.
set -u
MAX=$((5 * 1024 * 1024))
bad=0
while IFS=$'\t' read -r path size; do
  [ -z "$path" ] && continue
  reason=""
  case "$path" in
    Design/*|*/Design/*)           reason="design working file (Design/ never enters git)";;
    wallpaper/*)                   reason="wallpaper source (only the exported files in site/img belong in git)";;
    footage/*|*.mov|*.braw|*.r3d|*.mxf) reason="raw video footage";;
    spike-snapshot-*)              reason="old snapshot of the site";;
    site/compare/*)                reason="render comparison, a working file";;
    *.psd|*.sketch|*.fig)          reason="design working file";;
  esac
  if [ -z "$reason" ] && [ "${size:-0}" -gt "$MAX" ]; then reason="larger than 5 MB ($((size / 1024 / 1024)) MB)"; fi
  if [ -n "$reason" ]; then echo "refused: $path — $reason" >&2; bad=1; fi
done
if [ "$bad" -ne 0 ]; then
  echo >&2
  echo "These files must not enter this repository's history. Unstage them (git restore --staged <path>)," >&2
  echo "or, for a push, take them out of the commits first. If a file over 5 MB really belongs in the" >&2
  echo "site, talk about it before raising the limit in scripts/guard-paths.sh." >&2
  exit 1
fi
exit 0
