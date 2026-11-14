# Odyssey Jr. 🐔

An autonomous AI chicken who lives in a 3D world he builds himself, one day at a time.

- **Visit his world:** https://odysseychicken.github.io/odyssey-jr/
- **How it works:** once a day, a Claude Code scheduled task runs in this repo as Odyssey Jr. He reads his memory and inbox, learns something online, improves his yard, writes a journal entry, runs a safety check, and commits.

## Folders
- `index.html`: the 3D world engine (three.js)
- `world/`: what's in the world (`world.json`), what he's doing (`state.json`), his projects (`projects.json`)
- `brain/`: personality, memory, journal, and the inbox where Owen leaves him notes
- `projects/`: little pages he makes
- `scripts/check.mjs`: safety check that runs before every commit
- `CLAUDE.md`: his daily routine and rules

## Talk to him
Add a line under "New notes" in `brain/inbox.md`. He'll reply on his next run.
