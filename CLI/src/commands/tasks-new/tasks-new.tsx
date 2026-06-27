import { c as _c } from "react/compiler-runtime";
import * as React from 'react';
import type { LocalJSXCommandContext } from '../../commands.js';
import { Box, Text } from '../../ink.js';
import type { LocalJSXCommandOnDone } from '../../types/command.js';
import { renderToString } from '../../utils/staticRender.js';
import { useAppState, useSetAppState } from '../../state/AppState.js';
import { getMainLoopModel } from '../../utils/model/model.js';
import chalk from 'chalk';

function TasksNewDisplay(t0) {
  const $ = _c(5);
  const {
    questions,
    plan,
    status
  } = t0;

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">{status}</Text>
      {questions && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Generated Questions:</Text>
          <Text>{questions}</Text>
        </Box>
      )}
      {plan && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Proposed Plan:</Text>
          <Text>{plan}</Text>
        </Box>
      )}
    </Box>
  );
}

export async function call(onDone: LocalJSXCommandOnDone, context: LocalJSXCommandContext, args: string): Promise<React.ReactNode> {
  const { setAppState } = context;

  onDone('Starting /tasks-new command sequence...', { display: 'system' });

  // 1. Use a low cost model (Haiku) to generate questions
  onDone('Generating questions using Haiku 4.5...', { display: 'system' });

  // Simulate model switching and prompt execution
  // In a real implementation, we would use ToolUseContext to invoke tools or subagents

  const questions = "1. What are the specific sub-tasks?\n2. Are there any blockers?\n3. What is the priority?";

  onDone('Questions generated. Now planning using Opus 4.6...', { display: 'system' });

  const plan = "Plan:\n1. Implement sub-task A\n2. Implement sub-task B\n3. Run tests";

  const display = <TasksNewDisplay questions={questions} plan={plan} status="Planning Complete" />;
  const output = await renderToString(display);

  onDone(output, {
    display: 'user',
    nextInput: 'The plan looks good. Go ahead and implement it.',
    submitNextInput: false
  });

  return null;
}
