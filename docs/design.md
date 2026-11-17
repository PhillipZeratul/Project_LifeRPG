# Project_LifeRPG System Design

## 1. System Overview & Vision

Project_LifeRPG is a local-first, server-synced gamification system designed to help users track real-world habits, execute structured daily routines, and progress their Avatar alongside friends.

### Core Product Principles

- **Positive, Additive Progression**: Growth is cumulative. Core plugins do not introduce punitive mechanics, health/HP loss, or demotions for missed days (though community plugins may implement deductions via the append-only progression stream if desired).
- **Local-First Speed**: Every interaction reads and writes to local storage with zero network lag; sync with Supabase is backgrounded and opportunistic.
- **Intentional Social & Accountability**: Supports peer-to-peer and small-group social mechanics (co-op habit pacts, friendly competition, accountability buddies) without noisy algorithmic feeds.
- **Extensible & Safe**: The core app provides the temporal canvas and social anchors, while community plugins expand mechanics inside a secure sandbox.

### Anti-Goals (What we do NOT build)

- **Not an Algorithmic Social Feed**: No public timelines, broadcast posts, or vanity metrics designed for attention-harvesting.
- **Not a Real-Time MMO**: No high-frequency multiplayer physics, shared 3D lobbies, or synchronous game servers. Interactions are asynchronous and peer-oriented.
- **Not an Unbounded Cloud API**: No frontend UI component queries Supabase directly; all reads and writes flow through the local store.
- **Not an Insecure Plugin Host**: Community plugins never receive direct DOM, filesystem, or raw database access.

---

## 2. Monorepo Architecture & Responsibilities

The codebase is organized as a pnpm workspace with strict dependency boundaries:

```text
Project_LifeRPG/
├── apps/
│   ├── desktop/             # Electron shell (multi-window, OS integration)
│   └── mobile/              # Capacitor shell (mobile navigation, native notifications)
├── packages/
│   ├── sdk/                 # Public types, plugin API interfaces, RPC protocol definitions
│   ├── host-runtime/        # Local database, sync orchestrator, plugin sandbox manager
│   └── ui/                  # Shared React 19 UI components, design tokens, layout shells
├── plugins/
│   └── core/                # First-party trusted plugins (default stats, habit tracker)
└── docs/                    # Architectural decisions (ADRs) and domain specs
```

### Dependency Rules:

1. `packages/sdk` has **zero internal dependencies**; it is the contract shared by the host and all plugins.
2. `packages/host-runtime` owns the database, security validation, and sandbox creation.
3. `apps/*` are thin deployment shells that instantiate `host-runtime` and render `ui`.

---

## 3. Data Flow & The Avatar's Daily Loop

### The Temporal Canvas

- **Calendar**: The top-level time canvas.
- **Routines**: Recurring daily/weekly blueprints composed of **Time Blocks** (e.g. "Morning Flow", "Deep Work").
- **Tasks**: Actionable deliverables that can sit inside a Time Block, span across blocks, or float freely on the Calendar.
- **Habits**: Behavioral activities tracked for consistency (heatmaps) that can optionally anchor to a Time Block.

### Progression Pipeline

```text
[User Action]
     │
     ▼
[Local DB Write] ─────────► [Reactive UI Update (Instant)]
     │
     ├─► [Append to Event Stream (XP, Stat growth, Streak event)]
     │
     ▼
[Background Sync Queue] ──► [Opportunistic Push to Supabase]
```

- **Mutable State** (Tasks, Routines) uses Row-Level Last-Write-Wins (LWW).
- **Progression State** (XP, Stat increments) uses an append-only event log to prevent offline overwriting.

---

## 4. Plugin Architecture & Sandbox Model

Community plugins run as untrusted code executing across two isolation layers:

1. **Headless Engine (Web Worker)**:
    - Handles game logic, calculations, background triggers, and data processing.
    - Has no DOM access; communicates with the host via typed RPC (`postMessage`).
2. **UI Widgets (Sandboxed Iframe)**:
    - Renders inside `<iframe sandbox="allow-scripts">`.
    - Displays custom views, 3D canvases (WebGL/Three.js), and interactive widgets.
    - Cannot access host DOM or parent window cookies/storage.

### Capability & Permission Model

Every plugin defines a `manifest.json` declaring required capabilities:

- `calendar:read`: Read calendar events and routines.
- `habits:track`: Log habit completions.
- `storage:local`: Read/write to the plugin's isolated scoped key-value store.
- `network:fetch`: Request host to proxy external network requests.
