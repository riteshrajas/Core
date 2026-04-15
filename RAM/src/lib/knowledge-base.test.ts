import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadKnowledgeBase } from './knowledge-base';

function withTempCwd(run: (tmpDir: string) => void) {
  const previousCwd = process.cwd();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ram-kb-'));
  try {
    run(tmpDir);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function writeKbFile(tmpDir: string, filename: string, data: unknown) {
  const kbDir = path.join(tmpDir, 'src', 'knowledge-base');
  fs.mkdirSync(kbDir, { recursive: true });
  fs.writeFileSync(path.join(kbDir, filename), JSON.stringify(data, null, 2), 'utf-8');
}

test('loadKnowledgeBase returns strongly-typed values for valid JSON', () => {
  withTempCwd((tmpDir) => {
    process.chdir(tmpDir);

    writeKbFile(tmpDir, 'profile.json', {
      coreIdentity: {
        name: 'Ritesh',
        age: 18,
        birthday: 'March 24',
        location: 'Rochester Hills',
        profession: 'Student',
        background: 'Builder',
        keyLifeEvents: ['FRC Lead'],
      },
      recurringThemes: ['Robotics'],
      importantRelationships: ['Mentor'],
    });

    writeKbFile(tmpDir, 'skills.json', {
      languages: ['TypeScript'],
      frameworks: ['Next.js'],
      tools: ['Warp'],
      codingStyle: 'Architecture-first',
      strengths: ['System design'],
      areasOfImprovement: ['Math'],
    });

    writeKbFile(tmpDir, 'goals.json', {
      currentProjects: ['Apex'],
      shortTermGoals: ['Ship RAM'],
      longTermAmbitions: ['Aerospace Engineering'],
      values: ['Integrity'],
    });

    writeKbFile(tmpDir, 'preferences.json', {
      likes: ['Technical precision'],
      dislikes: ['Vague summaries'],
      hobbies: ['Robotics'],
      routines: ['Daily planning'],
      communicationStyle: {
        tone: 'Technical',
        formatting: 'Structured',
        aiResponsePreferences: 'Precise and actionable',
      },
    });

    const kb = loadKnowledgeBase();
    assert.equal(kb.profile.coreIdentity.name, 'Ritesh');
    assert.deepEqual(kb.skills.languages, ['TypeScript']);
    assert.deepEqual(kb.goals.currentProjects, ['Apex']);
    assert.equal(kb.preferences.communicationStyle.tone, 'Technical');
  });
});

test('loadKnowledgeBase falls back to typed defaults when files are missing', () => {
  withTempCwd((tmpDir) => {
    process.chdir(tmpDir);
    const kb = loadKnowledgeBase();

    assert.equal(kb.profile.coreIdentity.name, '');
    assert.equal(kb.profile.coreIdentity.age, 0);
    assert.deepEqual(kb.skills.languages, []);
    assert.deepEqual(kb.goals.values, []);
    assert.equal(kb.preferences.communicationStyle.formatting, '');
  });
});

test('loadKnowledgeBase falls back only for invalid files', () => {
  withTempCwd((tmpDir) => {
    process.chdir(tmpDir);
    const kbDir = path.join(tmpDir, 'src', 'knowledge-base');
    fs.mkdirSync(kbDir, { recursive: true });

    fs.writeFileSync(path.join(kbDir, 'profile.json'), '{ invalid json', 'utf-8');
    writeKbFile(tmpDir, 'skills.json', {
      languages: ['Go'],
      frameworks: ['React'],
      tools: ['Docker'],
      codingStyle: 'Pragmatic',
      strengths: ['Execution'],
      areasOfImprovement: ['Depth'],
    });
    writeKbFile(tmpDir, 'goals.json', {
      currentProjects: ['Ghost'],
      shortTermGoals: ['Stabilize'],
      longTermAmbitions: ['Scale'],
      values: ['Honesty'],
    });
    writeKbFile(tmpDir, 'preferences.json', {
      likes: ['Automation'],
      dislikes: ['Latency'],
      hobbies: ['Mentoring'],
      routines: ['Review'],
      communicationStyle: {
        tone: 'Professional',
        formatting: 'Bulleted',
        aiResponsePreferences: 'Concrete',
      },
    });

    const kb = loadKnowledgeBase();
    assert.equal(kb.profile.coreIdentity.name, '');
    assert.deepEqual(kb.skills.languages, ['Go']);
    assert.deepEqual(kb.goals.currentProjects, ['Ghost']);
    assert.equal(kb.preferences.communicationStyle.tone, 'Professional');
  });
});
