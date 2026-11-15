# LifeRPG Domain

A local-first, server-synced gamification system designed to help users track habits, build skills, and achieve goals through an extensible plugin ecosystem.

## Gamification & Progression

**Avatar**: The digital embodiment and reflection of the user within the system, accumulating Stats, Skills, and Experience.
_Avoid_: Player, Character, Hero, Profile

**Calendar**:
The temporal canvas where daily Routines, Time Blocks, and scheduled Tasks are planned, visualized, and executed.
_Avoid_: Agenda, Diary, Planner

**Routine**:
A recurring temporal blueprint for a day, composed of Time Blocks that define everyday rhythm (e.g., daily or weekly schedules).
_Avoid_: Daily Schedule, Timetable

**Time Block**:
A scheduled duration on the Calendar designating a thematic period of activity (e.g., "Deep Work", "Morning Flow").
_Avoid_: Slot, Window, Session

**Task**:
A specific, actionable commitment or deliverable with concrete completion criteria that can be scheduled inside a Time Block, span across blocks, or exist as an independent calendar event.
_Avoid_: Quest, Todo, Chore, Routine Item

**Habit**:
A recurring behavioral activity tracked for long-term consistency (e.g., via heatmaps), which can anchor to a Time Block or exist independently outside the Calendar.
_Avoid_: Daily, Routine Activity, Task

**Goal**:
A high-level, long-term ambition realized through completing Milestones and Tasks.
_Avoid_: Target, Objective, Vision

**Milestone**:
A significant, checkable checkpoint marking measurable progress toward a Goal.
_Avoid_: Subtask, Stage, Step

**Stat**:
A foundational, slowly-progressing core trait of the Avatar (such as Focus, Vitality, or Intellect).
_Avoid_: Attribute, Ability Score, Property

**Skill**:
A specialized area of competence that advances through associated Habits and Tasks, contributing to related Stats.
_Avoid_: Talent, Proficiency, Capability

**Experience (XP)**:
A strictly additive quantitative measure of effort that levels up Stats, Skills, or the Avatar without punitive deductions.
_Avoid_: Exp, Points, Score

**Streak**:
A metric tracking the consecutive cadence of fulfilling a Habit, designed strictly for positive reinforcement.
_Avoid_: Chain, Combo

---

## Platform & Extensibility

**Host Runtime**:
The trusted application foundation managing local storage, sync, and security enforcement.
_Avoid_: Core App, Shell, Base System

**Plugin**:
A self-contained package that extends the system with custom mechanics, views, or integrations.
_Avoid_: Extension, Addon, Mod

**Core Plugin**:
A first-party plugin running with trusted privileges to supply baseline functionality.
_Avoid_: Builtin, Native Module

**Community Plugin**:
An untrusted, user- or third-party-authored plugin subjected to strict runtime isolation.
_Avoid_: Third-Party Plugin, External Mod

**Sandbox**:
The isolated execution environment that confines Community Plugins and mediates all interaction via typed messages.
_Avoid_: Container, Jail, Isolated Worker
