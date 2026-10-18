# contextclue.app

The website for [Context Clue](https://apps.apple.com/app/id6815880837), a Mac app that adds a small card
with your local time, place, weather and more to your video calls.

`site/` is the whole site: plain HTML, CSS and JavaScript, with no build step.

## Working on it

Preview it locally with any static server, for example:

```
python3 -m http.server 8417 --directory site
```

After cloning, switch on the hooks that keep design files, raw footage and anything over 5 MB out of the
history (`scripts/guard-paths.sh` explains why):

```
git config core.hooksPath .githooks
```
