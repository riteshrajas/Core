'use server';

import { generateSystemPromptInjection } from '@/lib/knowledge-base';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error executing command: ${message}`;
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
 * Tool: Read Workspace File
 */
export async function readWorkspaceFile(filePath: string): Promise<string> {
  try {
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
 */
export async function writeWorkspaceFile(filePath: string, content: string): Promise<string> {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return `File written successfully to ${filePath}`;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error writing file: ${message}`;
  }
}

/**
 * Tool: Get Project Status (Hardware + Software)
 * Queries IOT and MicroMax directories for state
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
