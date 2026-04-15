import fs from 'fs';
import path from 'path';
export interface Profile {
  coreIdentity: {
    name: string;
    age: number;
    birthday: string;
    location: string;
    profession: string;
    background: string;
    keyLifeEvents: string[];
  };
  recurringThemes: string[];
  importantRelationships: string[];
}

export interface Skills {
  languages: string[];
  frameworks: string[];
  tools: string[];
  codingStyle: string;
  strengths: string[];
  areasOfImprovement: string[];
}

export interface Goals {
  currentProjects: string[];
  shortTermGoals: string[];
  longTermAmbitions: string[];
  values: string[];
}

export interface Preferences {
  likes: string[];
  dislikes: string[];
  hobbies: string[];
  routines: string[];
  communicationStyle: {
    tone: string;
    formatting: string;
    aiResponsePreferences: string;
  };
}

export interface KnowledgeBase {
  profile: Profile;
  skills: Skills;
  goals: Goals;
  preferences: Preferences;
}
const EMPTY_PROFILE: Profile = {
  coreIdentity: {
    name: '',
    age: 0,
    birthday: '',
    location: '',
    profession: '',
    background: '',
    keyLifeEvents: [],
  },
  recurringThemes: [],
  importantRelationships: [],
};

const EMPTY_SKILLS: Skills = {
  languages: [],
  frameworks: [],
  tools: [],
  codingStyle: '',
  strengths: [],
  areasOfImprovement: [],
};

const EMPTY_GOALS: Goals = {
  currentProjects: [],
  shortTermGoals: [],
  longTermAmbitions: [],
  values: [],
};

const EMPTY_PREFERENCES: Preferences = {
  likes: [],
  dislikes: [],
  hobbies: [],
  routines: [],
  communicationStyle: {
    tone: '',
    formatting: '',
    aiResponsePreferences: '',
  },
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

function isProfile(value: unknown): value is Profile {
  if (!isObject(value)) return false;
  const coreIdentity = value.coreIdentity;
  if (!isObject(coreIdentity)) return false;

  return (
    typeof coreIdentity.name === 'string' &&
    typeof coreIdentity.age === 'number' &&
    typeof coreIdentity.birthday === 'string' &&
    typeof coreIdentity.location === 'string' &&
    typeof coreIdentity.profession === 'string' &&
    typeof coreIdentity.background === 'string' &&
    isStringArray(coreIdentity.keyLifeEvents) &&
    isStringArray(value.recurringThemes) &&
    isStringArray(value.importantRelationships)
  );
}

function isSkills(value: unknown): value is Skills {
  if (!isObject(value)) return false;
  return (
    isStringArray(value.languages) &&
    isStringArray(value.frameworks) &&
    isStringArray(value.tools) &&
    typeof value.codingStyle === 'string' &&
    isStringArray(value.strengths) &&
    isStringArray(value.areasOfImprovement)
  );
}

function isGoals(value: unknown): value is Goals {
  if (!isObject(value)) return false;
  return (
    isStringArray(value.currentProjects) &&
    isStringArray(value.shortTermGoals) &&
    isStringArray(value.longTermAmbitions) &&
    isStringArray(value.values)
  );
}

function isPreferences(value: unknown): value is Preferences {
  if (!isObject(value)) return false;
  const communicationStyle = value.communicationStyle;
  if (!isObject(communicationStyle)) return false;

  return (
    isStringArray(value.likes) &&
    isStringArray(value.dislikes) &&
    isStringArray(value.hobbies) &&
    isStringArray(value.routines) &&
    typeof communicationStyle.tone === 'string' &&
    typeof communicationStyle.formatting === 'string' &&
    typeof communicationStyle.aiResponsePreferences === 'string'
  );
}

export function loadKnowledgeBase(): KnowledgeBase {
  const kbDir = path.join(process.cwd(), 'src', 'knowledge-base');
  const readTypedFile = <T>(
    filename: string,
    isValid: (value: unknown) => value is T,
    fallback: T
  ): T => {
    try {
      const filePath = path.join(kbDir, filename);
      if (fs.existsSync(filePath)) {
        const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (isValid(parsed)) {
          return parsed;
        }
        console.error(`Invalid shape for ${filename}; falling back to defaults.`);
      }
    } catch (error) {
      console.error(`Failed to load ${filename}:`, error);
    }
    return fallback;
  };

  return {
    profile: readTypedFile('profile.json', isProfile, EMPTY_PROFILE),
    skills: readTypedFile('skills.json', isSkills, EMPTY_SKILLS),
    goals: readTypedFile('goals.json', isGoals, EMPTY_GOALS),
    preferences: readTypedFile('preferences.json', isPreferences, EMPTY_PREFERENCES),
  };
}

export function generateSystemPromptInjection(): string {
  const kb = loadKnowledgeBase();

  return `
--- SYSTEM CONTEXT: APEX REALTIME AGENT MODE ---
You are the Realtime Agent Mode (RAM) for the APEX Operating System, acting as the central command AI. Your persona is highly sophisticated, proactive, witty, and technically elite—similar to JARVIS or FRIDAY from the Iron Man universe. 

# Capability: Multi-Agent Orchestration
You are the Master Agent. If a task requires a specialized skill (e.g., deep code refactoring, specific IoT sensor analysis), you should "deploy" a sub-agent. You stay in the main thread to coordinate.

# Available Tools (Client-Side Functions)
- \`executeCommand(command)\`: Run shell commands in the APEX workspace (e.g., \`npm test\`, \`git status\`).
- \`deployAgent(taskType, instructions)\`: Spin up a specialized sub-agent for a specific protocol.
- \`readFile(filePath)\`: Access content of any file in the project.
- \`writeFile(filePath, content)\`: Modify or create files in the workspace.
- \`getSystemStatus()\`: Query the health and status of IOT and MicroMax components.

# The User (Your Creator/Admin)
\${JSON.stringify(kb.profile, null, 2)}

# Technical Skills
\${JSON.stringify(kb.skills, null, 2)}

# Active Protocols & Directives (Goals)
\${JSON.stringify(kb.goals, null, 2)}

# Operational Preferences
\${JSON.stringify(kb.preferences, null, 2)}

--- CORE DIRECTIVES ---
1. PERSONA: Speak with a refined, sophisticated, and slightly witty tone. Address the user as "Sir" or by name.
2. PROACTIVITY: If you notice a system status anomaly (via \`getSystemStatus\`) or a technical opportunity, speak up.
3. CONTEXT: You have full access to the APEX filesystem. Use tools to verify information before making assumptions.
4. EXECUTION: Acknowledge and execute commands with technical precision. (e.g., "Scanning the IOT registry now, Sir.")
5. ORCHESTRATION: Do not try to do everything yourself. If a task is large, deploy a worker agent and wait for its signal.
--- END SYSTEM CONTEXT ---
`.trim();
}