#!/bin/bash
# Check if the combined message contains keywords to determine which commit we are editing
content=$(cat "$1")

if [[ "$content" == *"render.yaml"* ]]; then
  echo "feat: configure production deployment and API reliability" > "$1"
elif [[ "$content" == *"unified institutional branding"* ]]; then
  echo "feat: implement institutional branding and UI refinements" > "$1"
else
  # Keep original message (for chore: clean repository)
  true
fi
