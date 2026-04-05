#!/bin/bash

npm run build



SRC=~/obsidian-plugins/obsidian-plotting/my-plugin
DEST=/mnt/c/Users/Jomar/Documents/test-vault/.obsidian/plugins/obsidian-plotting

mkdir -p "$DEST"

rsync -av --delete \
  --include="main.js" \
  --include="manifest.json" \
  --include="graphs.js" \
  --include="parser.js" \
  --include="styles.css" \
  --exclude="*" \
  "$SRC/" "$DEST/"