import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { z } from 'zod';
import { execFileSync } from 'child_process';
import { PROJECT_ROOT } from '../lib/paths.js';
import { ToolResponse } from '../types.js';
import { notifyState, requestPermission } from '../lib/ipc.js';

// --- Configuration Helper ---
const configPath = path.join(PROJECT_ROOT, 'config', 'persona.yaml');

function readRawConfig(): any {
  if (!fs.existsSync(configPath)) return {};
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    return yaml.load(content) || {};
  } catch (e) {
    return {};
  }
}

function writeRawConfig(config: any): void {
  try {
    const content = yaml.dump(config, { noRefs: true });
    fs.writeFileSync(configPath, content, 'utf8');
  } catch (e) {
    console.error(`Failed to save persona config: ${e}`);
  }
}

// --- Python DB CLI Runner ---
function runPythonDb(args: string[]): any {
  const pythonBinary = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = path.join(PROJECT_ROOT, 'src', 'storage', 'db.py');
  try {
    const stdout = execFileSync(pythonBinary, [scriptPath, ...args], { encoding: 'utf8' });
    return JSON.parse(stdout.trim());
  } catch (e: any) {
    console.error(`Error running Python DB script: ${e.message}`);
    return null;
  }
}

// ==========================================
// 1. pet_get_status
// ==========================================
export const PetGetStatusSchema = z.object({});

export async function handlePetGetStatus(): Promise<ToolResponse> {
  const raw = readRawConfig();
  const activeChar = raw.active_character || 'slime';
  const characters = raw.characters || {};
  const char = characters[activeChar] || {
    name: 'Slimey',
    species: 'slime',
    stage: 'baby',
    level: 1,
    xp: 0,
    hunger: 100,
    energy: 100,
    intimacy: 0,
    active_skin: 'default',
    unlocked_skins: ['default'],
    unlocked_skills: ['chat'],
  };

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        active_character: activeChar,
        character: char,
        all_characters: Object.keys(characters),
      }, null, 2),
    }],
  };
}

// ==========================================
// 2. pet_switch_companion (ccswitch)
// ==========================================
export const PetSwitchCompanionSchema = z.object({
  character_id: z.string(),
});

export async function handlePetSwitchCompanion(
  params: z.infer<typeof PetSwitchCompanionSchema>
): Promise<ToolResponse> {
  const raw = readRawConfig();
  const characters = raw.characters || {};
  
  if (!characters[params.character_id]) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: `Character '${params.character_id}' not found in configuration.`,
        }, null, 2),
      }],
    };
  }

  raw.active_character = params.character_id;
  writeRawConfig(raw);
  
  // Notify pet window to reload
  notifyState('idle');

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        active_character: params.character_id,
        name: characters[params.character_id].name,
      }, null, 2),
    }],
  };
}

// ==========================================
// 3. pet_interact
// ==========================================
export const PetInteractSchema = z.object({
  action: z.enum(['feed', 'play', 'pet', 'sleep']),
});

export async function handlePetInteract(
  params: z.infer<typeof PetInteractSchema>
): Promise<ToolResponse> {
  const raw = readRawConfig();
  const activeChar = raw.active_character || 'slime';
  if (!raw.characters) raw.characters = {};
  if (!raw.characters[activeChar]) {
    raw.characters[activeChar] = {
      name: 'Slimey', species: 'slime', stage: 'baby', level: 1, xp: 0, hunger: 100, energy: 100, intimacy: 0
    };
  }

  const char = raw.characters[activeChar];
  let msg = '';
  
  // Set pet visual state during interaction
  notifyState(params.action === 'feed' ? 'eating' : params.action === 'sleep' ? 'sleeping' : 'success');
  setTimeout(() => notifyState('idle'), 3000);

  switch (params.action) {
    case 'feed':
      char.hunger = Math.min(100, (char.hunger || 0) + 30);
      char.intimacy = Math.min(100, (char.intimacy || 0) + 5);
      msg = `你喂了 ${char.name} 🍖，饱食度上升！`;
      break;
    case 'play':
      if ((char.energy || 0) < 20) {
        msg = `${char.name} 太累了，玩不动了，需要休息 💤`;
        break;
      }
      char.energy = Math.max(0, (char.energy || 0) - 20);
      char.intimacy = Math.min(100, (char.intimacy || 0) + 15);
      char.xp = (char.xp || 0) + 15;
      msg = `你和 ${char.name} 玩了会球 🎾，它很开心！`;
      break;
    case 'pet':
      char.intimacy = Math.min(100, (char.intimacy || 0) + 10);
      char.xp = (char.xp || 0) + 5;
      msg = `你摸了摸 ${char.name} ❤️，亲密度上升！`;
      break;
    case 'sleep':
      char.energy = Math.min(100, (char.energy || 0) + 40);
      msg = `${char.name} 去睡觉了 💤，精力值恢复！`;
      break;
  }

  // Level up calculation
  const xpNeeded = (char.level || 1) * 100;
  if ((char.xp || 0) >= xpNeeded) {
    char.xp -= xpNeeded;
    char.level = (char.level || 1) + 1;
    msg += ` 🎉 升级啦！当前等级: ${char.level}`;
  }

  writeRawConfig(raw);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        message: msg,
        character: char,
      }, null, 2),
    }],
  };
}

// ==========================================
// 4. pet_list_skills & pet_toggle_skill
// ==========================================
export const PetListSkillsSchema = z.object({});
export async function handlePetListSkills(): Promise<ToolResponse> {
  const result = runPythonDb(['list-skills']) || [];
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2),
    }],
  };
}

export const PetToggleSkillSchema = z.object({
  name: z.string(),
  enabled: z.boolean(),
});
export async function handlePetToggleSkill(
  params: z.infer<typeof PetToggleSkillSchema>
): Promise<ToolResponse> {
  const code = params.enabled ? '1' : '0';
  const result = runPythonDb(['toggle-skill', params.name, code]);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2),
    }],
  };
}

// ==========================================
// 5. pet_list_sessions & pet_create_session / pet_delete_session
// ==========================================
export const PetListSessionsSchema = z.object({
  provider: z.string().optional(),
});
export async function handlePetListSessions(
  params: z.infer<typeof PetListSessionsSchema>
): Promise<ToolResponse> {
  const args = ['list-sessions'];
  if (params.provider) {
    args.push(params.provider);
  }
  const result = runPythonDb(args) || [];
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2),
    }],
  };
}

// ==========================================
// 6. pet_get_token_stats
// ==========================================
export const PetGetTokenStatsSchema = z.object({
  days: z.number().int().min(1).max(30).optional(),
});
export async function handlePetGetTokenStats(
  params: z.infer<typeof PetGetTokenStatsSchema>
): Promise<ToolResponse> {
  const days = params.days || 7;
  const result = runPythonDb(['stats', days.toString()]) || [];
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2),
    }],
  };
}

// ==========================================
// 7. pet_request_permission (CodeIsland)
// ==========================================
export const PetRequestPermissionSchema = z.object({
  title: z.string(),
  message: z.string(),
});
export async function handlePetRequestPermission(
  params: z.infer<typeof PetRequestPermissionSchema>
): Promise<ToolResponse> {
  const approved = await requestPermission(params.title, params.message);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ approved }),
    }],
  };
}
