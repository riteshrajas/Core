import * as React from 'react';
import { Box, Text } from '../../ink.js';

export type ClawdPose = 'default';

export function Clawd({ pose }: { pose?: ClawdPose }) {
  return (
    <Box flexDirection="column" marginLeft={2}>
      <Text color="cyan">      ░▒▓████████▓▒░      </Text>
      <Text color="magenta">   ░▒▓██████████████▓▒░   </Text>
      <Text color="blue"> ░▒▓██░░        ░░██▓▒░ </Text>
      <Text color="white">▒▓██      APEX      ██▓▒</Text>
      <Text color="blue"> ░▒▓██░░        ░░██▓▒░ </Text>
      <Text color="magenta">   ░▒▓██████████████▓▒░   </Text>
      <Text color="cyan">      ░▒▓████████▓▒░      </Text>
    </Box>
  );
}
