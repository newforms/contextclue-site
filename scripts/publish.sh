#!/bin/bash
# Publishes site/ to Opalstack. Called by .github/workflows/publish.yml; runs locally too.
#
#   scripts/publish.sh publish <branch>   main → contextclue.app, any other branch →
#                                         preview.contextclue.app/<slug>/
#   scripts/publish.sh remove <branch>    deletes that branch's preview folder
#
# DEPLOY_DEST is the rsync destination holding the apps folder: the deploy user's home on the server
# by default, or a local folder to try it out (DEPLOY_DEST=/tmp/x/ scripts/publish.sh publish main).
#
# Everything goes through rsync, never a remote shell command, so the deploy key could later be
# limited to rsync on the server without changing this script.
set -euo pipefail

DEST=${DEPLOY_DEST:-contextclue@opal4.opalstack.com:}
PROD=apps/contextclue
PREVIEW=apps/contextclue_preview
root=$(cd "$(dirname "$0")/.." && pwd)

mode=${1:-}
branch=${2:-}
if [ -z "$mode" ] || [ -z "$branch" ]; then
  echo "usage: scripts/publish.sh publish|remove <branch>" >&2
  exit 2
fi

# Branch names become folder names: lowercase letters, digits and single hyphens only, so a name
# with slashes or dots can never reach outside the preview folder.
slug=$(printf '%s' "$branch" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')
if [ -z "$slug" ]; then
  echo "refused: branch \"$branch\" has no letters or digits to name its preview folder" >&2
  exit 1
fi

# -c compares by checksum: a fresh checkout gives every file a new mtime, which would otherwise
# make rsync resend the whole site on every run. No --chmod: macOS's rsync rejects it; permissions
# come from git's checkout instead (644 files, 755 folders).
RSYNC=(rsync -rlpc --delete --delay-updates)

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# What gets published is the committed site/, never the folder on disk: locally, site/ also holds
# working files that git ignores (.DS_Store, site/compare/), and those must not go online.
stage() {
  git -C "$root" archive HEAD site | tar -x -C "$tmp"
  if [ ! -f "$tmp/site/index.html" ]; then
    echo "refused: the committed site/ has no index.html" >&2
    exit 1
  fi
  # Every stylesheet and script address gets this commit's id (window.css?v=600a6a6). The server sends no
  # caching rules, so browsers guess, and Timo's phone kept an old window.css after a publish (2026-10-18):
  # the page was new, its styles weren't. A new address each publish is fetched at once; between
  # publishes the cache still works. Only local files: an address with "//" in it is left alone.
  version=$(git -C "$root" rev-parse --short HEAD)
  find "$tmp/site" -name '*.html' -print0 | while IFS= read -r -d '' page; do
    sed -E -i.bak "s#(href|src)=\"([^\"/:]*/)*([^\"/:]+)\.(css|js)\"#\1=\"\2\3.\4?v=$version\"#g" "$page"
    rm -f "$page.bak"
  done
}

case "$mode" in
  publish)
    stage
    if [ "$branch" = main ]; then
      "${RSYNC[@]}" "$tmp/site/" "$DEST$PROD/"
      echo "published main → https://contextclue.app/"
    else
      # Previews are public but should not be indexed. robots.txt only counts at the host root,
      # so it is written beside the branch folders, never into them.
      printf 'User-agent: *\nDisallow: /\n' > "$tmp/robots.txt"
      rsync -rpc "$tmp/robots.txt" "$DEST$PREVIEW/robots.txt"
      "${RSYNC[@]}" "$tmp/site/" "$DEST$PREVIEW/$slug/"
      echo "published $branch → https://preview.contextclue.app/$slug/"
    fi
    ;;
  remove)
    if [ "$branch" = main ]; then
      echo "refused: main is never removed by this script" >&2
      exit 1
    fi
    # Syncing an empty folder with only this slug included deletes exactly that folder.
    rsync -r --delete --include="/$slug/***" --exclude='*' "$tmp/" "$DEST$PREVIEW/"
    echo "removed preview for $branch ($slug)"
    ;;
  *)
    echo "usage: scripts/publish.sh publish|remove <branch>" >&2
    exit 2
    ;;
esac
