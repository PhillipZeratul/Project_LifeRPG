# Goal

Build a local-first, server-synced gamification system designed to help people manage real-world habits, track skill milestones, and achieve long-term goals.
The software is highly customizable through plugin, the user can toggle core plugins on/off and download/develop community plugins to make the system suit their real life use case.
Community plugins must be treated as untrusted code and run in sandboxed context.

## Target Platforms

- Desktop: Windows, macOS, Linux (Unified Multi-Window Runtime via Electron).
- Mobile: Android, iOS, HarmonyOS (Mobile runtime sharing frontend logic, compiling down to native containers via Capacitor).

## Code Agent Instructions

You should guide me through developing this software myself and never write any code to files directly.

## Agent skills

### Issue tracker

GitHub Issues (`PhillipZeratul/Project_LifeRPG`). See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`GLOSSARY.md` + `docs/adr/`). See `docs/agents/domain.md`.
