# Runtime State Owned by Database

AgentSoul v2.0 separates human-authored configuration from mutable runtime facts. Persona and companion defaults may remain in YAML or Markdown as seed configuration, but Companion Vitals, Mood, Growth Events, Audit Records, Skill Activations, and Work Sessions are owned by the runtime database, while credentials live in a protected Credential Store. This avoids treating editable persona files as the source of truth for high-churn state and keeps audit/growth/session data queryable and consistent.
