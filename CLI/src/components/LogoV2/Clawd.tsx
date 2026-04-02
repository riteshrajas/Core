import * as React from 'react';
import { Box, Text } from '../../ink.js';

export type ClawdPose = 'default' | 'arms-up' | 'look-left' | 'look-right';

export function Clawd({ pose }: { pose?: ClawdPose }) {
  return (
    <Box flexDirection="column">
      <Text color="clawd_body">    ◢◣    </Text>
      <Text color="clawd_body">   ◢██◣   </Text>
      <Text color="clawd_body">  ◥◤  ◥◤  </Text>
    </Box>
  );
}
