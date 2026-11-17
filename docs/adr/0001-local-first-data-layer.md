# 0001. Local-First Data Layer with Background Sync

The UI reads from and writes to the local database as the primary source of truth, ensuring zero-latency offline performance across desktop and mobile.
Remote synchronization with Supabase occurs asynchronously in the background; when incoming changes are reconciled, the local database updates and triggers reactive UI re-renders.

Mutable entities (Tasks, Routines, Calendar items) synchronize using standard Row-Level Last-Write-Wins (LWW) based on `updated_at` timestamps.
To prevent multi-device offline overwrite conflicts, progression mechanics (Experience, Stat changes, Habit completion logs) are recorded as append-only event streams rather than in-place counter mutations.

First-party Core Plugins adhere to positive, non-punitive progression by default. However, the Host Runtime progression engine does not forbid negative values in the append-only stream; community plugins may record deductions (e.g., penalty mechanics or point spenders) if desired. Total XP and stat totals are safely clamped at zero so that cumulative progression remains non-negative.
