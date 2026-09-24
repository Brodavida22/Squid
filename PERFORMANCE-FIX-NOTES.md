# Queen Vida-MD Large-Group Performance Fix

This version keeps the existing bot structure/features and targets the message hot path.

## Main causes found
1. `activity.json` was read, parsed, modified and synchronously rewritten for EVERY group message.
2. `sock.groupMetadata(from)` was fetched for EVERY non-owner group message, then the entire participant list was scanned.
3. `settings.json` was repeatedly read/parsing on the hot path and synchronously written during security actions.
4. The same group metadata was fetched again by many admin-only commands.
5. `messages.upsert` only processed `messages[0]`, so message bursts could be mishandled/backlogged.
6. The anti-link RegExp was recreated for every message.
7. Spam tracking could grow indefinitely in memory.

## Changes made
- Added `utils/groupCache.js`
  - 60-second group metadata cache.
  - Deduplicates simultaneous metadata requests.
  - Invalidates immediately on participant/group updates.
- Added `utils/settings.js`
  - Loads settings once into memory.
  - Debounced asynchronous atomic writes.
  - Keeps existing settings.json format.
- Added `utils/activity.js`
  - Activity counters stay in memory.
  - Flushes asynchronously every ~5 seconds instead of blocking every message.
  - Keeps the existing `!active` / `!topmembers` data.
- Reworked `index.js` message handling
  - Every message in a Baileys upsert is processed independently.
  - Normal group messages no longer perform synchronous disk I/O.
  - Security checks only fetch group metadata when a relevant security feature is enabled.
  - Cached participant metadata is reused.
- Updated commands that use group metadata to use the cache.
- Updated settings-using commands to use the in-memory settings store.
- Added cleanup for stale spam-tracker entries.
- Preserved the existing bot commands/game/VTA structure.

## Important
No existing `settings.json` or `activity.json` file is required in the ZIP. If those files already exist on your server, the new stores will load them and continue using them.

## Expected result
The biggest per-message blocking operations have been removed. Large-group message bursts should no longer cause the bot to repeatedly block the Node.js event loop with JSON file parsing/writing and repeated full group metadata requests.

The fix does not guarantee zero delay under extreme WhatsApp/network/server overload, but it removes the main bottlenecks visible in this project.
