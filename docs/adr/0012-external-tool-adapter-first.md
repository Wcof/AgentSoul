# External Tool Adapter First

## Status

Accepted

## Context

AgentSoul needs to work with a growing set of external AI coding tools such as Claude Code, Codex, Gemini CLI, OpenCode, and OpenClaw. Many of these tool ecosystems already have mature projects for provider switching, proxy takeover, MCP synchronization, prompt management, usage views, and session discovery. Reimplementing those capabilities inside AgentSoul increases maintenance cost, duplicates user-facing behavior, and makes it harder to keep up with upstream tool changes.

At the same time, the Desktop Body-first architecture keeps AgentSoul's product path centered on Desktop Body, Agent Mind, Memory, and Extension Runtime. External tools can manage their own client configuration, but they must not replace AgentSoul's Memory-owned long-term state, approval policy, or metadata-only audit path.

## Decision

AgentSoul uses an **External Tool Adapter first** strategy:

- Prefer integrating mature third-party tools as unmodified external executables or packages.
- Do not fork, patch, or vendor third-party tool source code by default.
- Wrap third-party tools behind an AgentSoul Adapter that handles discovery, installation guidance, invocation, status mapping, errors, and version compatibility.
- Keep AgentSoul-owned domain state in Memory and local persistence. External tools may receive derived configuration, but they are not the source of truth for Soul Document, Master Model, credentials, approval policy, extension capability activation, or audit records.
- Mount provider switching, proxy takeover, MCP synchronization, prompt management, usage views, and session discovery through Extension Runtime adapters when those capabilities are needed.
- Keep model transport behind Agent Mind or Extension Runtime capabilities. External tools may configure client-side endpoints when an adapter needs them, but AgentSoul should not expose an embedded Gateway control plane as the default product path.
- Only modify or fork an external tool when a documented constraint requires it: security/privacy boundary, license compatibility, missing stable automation interface, local-first requirement, or critical upstream defect.

## Consequences

- External tool controls should be Extension Runtime capabilities surfaced through Desktop Body panels or extension inspectors, not a Gateway Area.
- CC Switch can be the first Adapter candidate for external AI CLI management, if its installed CLI/API can reliably configure Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw, MCP, prompts, proxy takeover, and usage views without exposing secrets.
- AgentSoul should test Adapter contracts around command discovery, install-required state, invocation arguments, failure mapping, capability activation, runtime events, and any generated endpoint configuration.
- If an Adapter is unavailable, AgentSoul should degrade clearly with installation guidance instead of silently falling back to an incomplete custom implementation.
