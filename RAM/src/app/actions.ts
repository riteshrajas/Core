'use server';

import { generateSystemPromptInjection } from '@/lib/knowledge-base';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

/**
 * Fetches the distilled system prompt from the local knowledge base.
 * This runs on the server to allow access to the filesystem (fs).
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
 */
export async function executeCLICommand(command: string): Promise<string> {
  try {
    console.log(`Executing CLI Command: ${command}`);
    const { stdout, stderr } = await execAsync(command, { cwd: process.cwd() });
    return stdout || stderr || 'Command executed successfully with no output.';
  } catch (error: any) {
    return `Error executing command: ${error.message}`;
  }
}

/**
 * Tool: Deploy Sub-Agent (Mock for now, sets up the framework)
 */
export async function deploySubAgent(taskType: string, instructions: string): Promise<string> {
  console.log(`Deploying Sub-Agent [${taskType}] with instructions: ${instructions}`);
  // In a real implementation, this would spin up a separate process or API call.
  // For now, we simulate a successful deployment and immediate response.
  return `Sub-agent for ${taskType} deployed successfully. Task logged.`;
}

/**
 * Tool: Write Workspace File
 */
export async function writeWorkspaceFile(filePath: string, content: string): Promise<string> {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return `File written successfully to \${filePath}`;
  } catch (error: any) {
    return `Error writing file: \${error.message}`;
  }
}

/**
 * Tool: Get Project Status (Hardware + Software)
 * Queries IOT and MicroMax directories for state
 */
export async function getProjectStatus(): Promise<string> {
  try {
    // This would eventually query real database/hardware logs.
    // For now, we check for the existence of specific backup or config files.
    const iotBackups = fs.readdirSync('P:/APEX/IOT/IOT-backups').slice(-3);
    const microMaxSpec = fs.existsSync('P:/APEX/MicroMax/SPEC.md') ? 'SPEC Found' : 'SPEC Missing';
    
    return `
APEX SYSTEM STATUS REPORT:
- IOT BACKUPS: \${iotBackups.join(', ')}
- MICROMAX STATUS: \${microMaxSpec}
- CORE CLI: Operational
- STORAGE: Local File System
`.trim();
  } catch (error: any) {
    return `Error fetching system status: \${error.message}`;
  }
}
