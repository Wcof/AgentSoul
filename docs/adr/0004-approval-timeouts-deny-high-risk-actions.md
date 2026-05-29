# Approval Timeouts Deny High-risk Actions

AgentSoul denies high-risk Approval Requests when the user does not respond before the approval window expires or when no controlled approval surface is available. The Desktop Companion is a safety decision point, and silence or UI unavailability must not become implicit permission for writes, dangerous commands, skill deployments, or session-launch actions. Users may later configure explicit fallback policies, but the default is timeout-denied or unavailable-denied.
