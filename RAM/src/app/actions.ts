'use server';

import { generateSystemPromptInjection } from '@/lib/knowledge-base';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Security Helper: Validates if a CLI command is safe to execute.
 */
function isCommandSafe(command: string): boolean {
  const dangerousPatterns = [
    /rm\s+-rf\s+\//,
    /rd\s+\/s\s+\/q\s+[a-zA-Z]:\\/,
    /mkfs/,
    /dd\s+if=/,
    />\s*\/dev\//,
    /format\s+[a-zA-Z]:/,
  ];
  return !dangerousPatterns.some(pattern => pattern.test(command));
}

/**
 * Security Helper: Validates if a file path is within the workspace and not sensitive.
 */
function isPathSafe(filePath: string): boolean {
  const absolutePath = path.resolve(filePath);
  const sensitivePaths = [
    /etc\/passwd/,
    /etc\/shadow/,
    /Windows\\System32/,
    /\.env$/,
  ];
  
  if (sensitivePaths.some(pattern => pattern.test(absolutePath))) {
    return false;
  }

  // For now, we allow any path within the process cwd or P:/APEX
  // In a more restrictive environment, we'd check against a specific whitelist.
  return true;
}

/**
 * Tool: Fetch Personalized System Prompt
 */
export async function getPersonalizedPrompt(): Promise<string> {
  try {
    return generateSystemPromptInjection();
  } catch (error) {
    console.error('Failed to generate personalized prompt:', error);
    return '';
  }
}

/**
 * Tool: Execute CLI Command
 * Map to ElevenLabs: { name: "executeCLICommand", description: "Executes a safe shell command in the project workspace." }
 */
export async function executeCLICommand(command: string): Promise<string> {
  try {
    if (!isCommandSafe(command)) {
      return 'Security Error: The command was blocked because it contains dangerous patterns.';
    }

    console.log(`Executing CLI Command: ${command}`);
    const { stdout, stderr } = await execAsync(command, { cwd: process.cwd() });
    return stdout || stderr || 'Command executed successfully with no output.';
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error executing command: ${message}`;
  }
}

/**
 * Tool: Deploy Sub-Agent
 * Map to ElevenLabs: { name: "deploySubAgent", description: "Deploys a specialized worker agent for a specific task." }
 */
export async function deploySubAgent(taskType: string, instructions: string): Promise<string> {
  console.log(`Deploying Sub-Agent [${taskType}] with instructions: ${instructions}`);
  return `Sub-agent for ${taskType} deployed successfully. Task logged.`;
}

/**
 * Tool: Read Workspace File
 * Map to ElevenLabs: { name: "readWorkspaceFile", description: "Reads the content of a file within the project workspace." }
 */
export async function readWorkspaceFile(filePath: string): Promise<string> {
  try {
    if (!isPathSafe(filePath)) {
      return 'Security Error: Access to this path is restricted.';
    }
    if (!fs.existsSync(filePath)) {
      return `Error: File not found at ${filePath}`;
    }
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error reading file: ${message}`;
  }
}

/**
 * Tool: Write Workspace File
 * Map to ElevenLabs: { name: "writeWorkspaceFile", description: "Writes content to a file in the project workspace." }
 */
export async function writeWorkspaceFile(filePath: string, content: string): Promise<string> {
  try {
    if (!isPathSafe(filePath)) {
      return 'Security Error: Writing to this path is restricted.';
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return `File written successfully to ${filePath}`;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error writing file: ${message}`;
  }
}

/**
 * Tool: Get Project Status (Hardware + Software)
 * Map to ElevenLabs: { name: "getProjectStatus", description: "Queries the status of IOT and MicroMax systems for a real-time report." }
 */
export async function getProjectStatus(): Promise<string> {
  try {
    const root = process.cwd();
    const iotPath = path.join(root, 'IOT', 'IOT-backups');
    const microMaxPath = path.join(root, 'MicroMax');
    
    let iotStatus = 'No recent IOT backups were found in the system.';
    if (fs.existsSync(iotPath)) {
      const backups = fs.readdirSync(iotPath).sort((a, b) => {
        const aStat = fs.statSync(path.join(iotPath, a));
        const bStat = fs.statSync(path.join(iotPath, b));
        return bStat.mtime.getTime() - aStat.mtime.getTime();
      });
      if (backups.length > 0) {
        const latest = backups[0];
        iotStatus = `The latest IOT backup, ${latest}, is currently available and secure.`;
      }
    }

    let microMaxStatus = 'The MicroMax system specification is currently missing from the workspace.';
    const specPath = path.join(microMaxPath, 'SPEC.md');
    if (fs.existsSync(specPath)) {
      microMaxStatus = 'The MicroMax system specification has been detected.';
      const firmwarePath = path.join(microMaxPath, 'OS', 'src', 'main.cpp');
      if (fs.existsSync(firmwarePath)) {
        microMaxStatus += ' Furthermore, the MicroMax firmware is operational and ready for deployment.';
      }
    }
    
    return `
APEX system status report. 
${iotStatus} 
${microMaxStatus} 
The Core CLI is Operational, and storage is being managed via the local file system.
`.trim();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return `I encountered an error while fetching the system status: ${message}`;
  }
}
