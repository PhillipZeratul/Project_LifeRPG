# 0001. Local-First Data Layer with Background Sync

The UI reads from and writes to the local database as the primary source of truth, ensuring zero-latency offline performance across desktop and mobile.
Remote synchronization with Supabase occurs asynchronously in the background; when incoming changes are reconciled, the local database updates and triggers reactive UI re-renders.

Mutable entities (Tasks, Routines, Calendar items) synchronize using standard Row-Level Last-Write-Wins (LWW) based on `updated_at` timestamps.
To prevent multi-device offline overwrite conflicts, progression mechanics (Experience, Stat increases, Habit completion logs) are recorded as append-only event streams rather than in-place counter mutations.
