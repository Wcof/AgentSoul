# Gateway Route as Default Provider Activation

## Status

Superseded by Desktop Body-first architecture. Historical background only.

AgentSoul v2.0 originally used Gateway Route as the default Provider Activation Mode for supported AI coding clients, with Direct Client Config kept as a fallback. Gateway Route was preferred because it gave AgentSoul a controlled place to route and translate provider traffic, produce Gateway Events for audit and growth, estimate cost and latency, and support approval-related flows.

Current architecture no longer treats an embedded Gateway as the product path. Model transport belongs to Agent Mind, long-term audit/growth facts belong to Memory, and external client integration should be mounted through Extension Runtime adapters when needed.
