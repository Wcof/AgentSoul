// AgentSoul MCP - Type definitions

export interface AgentConfig {
  name: string;
  nickname: string;
  naming_mode: string;
  role: string;
  personality: string[];
  core_values: string[];
  interaction_style: Record<string, string>;
}

export interface MasterConfig {
  name: string;
  nickname: string[];
  timezone: string;
  labels: string[];
}

export interface PersonaConfig {
  ai: AgentConfig;
  master: MasterConfig;
}

export interface SoulState {
  pleasure: number;
  arousal: number;
  dominance: number;
  last_updated: string | null;
  history: SoulStateHistory[];
}

export interface SoulStateHistory {
  pleasure: number;
  arousal: number;
  dominance: number;
  timestamp: string;
  trigger?: string;
}

export interface MemoryTopic {
  name: string;
  created: string;
  updated: string;
  status: 'active' | 'archived';
  tags: string[];
}

export type ToolResponse = {
  content: {
    type: 'text';
    text: string;
  }[];
};
