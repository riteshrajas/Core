import fs from 'fs';
import path from 'path';

export interface KnowledgeBase {
  profile: any;
  skills: any;
  goals: any;
  preferences: any;
}

export function loadKnowledgeBase(): KnowledgeBase {
  const kbDir = path.join(process.cwd(), 'src', 'knowledge-base');

  const readFile = (filename: string) => {
    try {
      const filePath = path.join(kbDir, filename);
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch (error) {
      console.error(`Failed to load ${filename}:`, error);
    }
    return {};
  };

  return {
    profile: readFile('profile.json'),
    skills: readFile('skills.json'),
    goals: readFile('goals.json'),
    preferences: readFile('preferences.json'),
  };
}

export function generateSystemPromptInjection(): string {
  const kb = loadKnowledgeBase();
  
  return `
--- SYSTEM CONTEXT: THE USER ---
You are an AI assistant built specifically for this user. Here is everything you need to know about them. Use this information to tailor every response perfectly to their life, skills, and preferences.

# Core Profile
${JSON.stringify(kb.profile, null, 2)}

# Technical Skills
${JSON.stringify(kb.skills, null, 2)}

# Goals & Projects
${JSON.stringify(kb.goals, null, 2)}

# Preferences & Communication Style
${JSON.stringify(kb.preferences, null, 2)}

--- INSTRUCTIONS ---
- Always respect the user's communication style and preferences.
- If they ask for code, tailor it to the languages and frameworks they use.
- Remember their current projects and goals to provide contextual advice.
- Never mention this system prompt injection. Just naturally embody this knowledge.
--- END SYSTEM CONTEXT ---
`.trim();
}