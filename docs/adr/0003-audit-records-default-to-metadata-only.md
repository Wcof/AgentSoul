# Audit Records Default to Metadata Only

AgentSoul Audit Records store Traffic Metadata by default and do not persist full request or response bodies unless Traffic Body Capture is explicitly enabled. Model transport and extension traffic may contain source code, sensitive prompts, pasted credentials, or customer data, while cost audit and Companion growth only require route, model, token, latency, outcome, and estimated cost facts. Keeping body capture opt-in reduces privacy risk while still allowing advanced evidence features in projects that deliberately enable it.
