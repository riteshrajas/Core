import * as React from 'react';
import { join } from 'path';
import { Box, Text } from '../../ink.js';
import { getCwd } from '../../utils/cwd.js';
import { getFsImplementation } from '../../utils/fsOperations.js';

type RGB = {
  r: number;
  g: number;
  b: number;
};

function interpolateColor(start: RGB, end: RGB, t: number): RGB {
  return {
    r: Math.round(start.r + (end.r - start.r) * t),
    g: Math.round(start.g + (end.g - start.g) * t),
    b: Math.round(start.b + (end.b - start.b) * t),
  };
}

function toRgbColor(color: RGB): string {
  return `rgb(${color.r},${color.g},${color.b})`;
}

function GradientText({ text, from, to }: { text: string; from: RGB; to: RGB }): React.ReactNode {
  const glyphs = [...text];
  const denominator = Math.max(glyphs.length - 1, 1);

  return (
    <Text>
      {glyphs.map((ch, idx) => {
        const t = idx / denominator;
        const color = toRgbColor(interpolateColor(from, to, t));
        return (
          <Text key={`${idx}-${ch}`} color={color}>
            {ch}
          </Text>
        );
      })}
    </Text>
  );
}

const APEX_LOGO_LINES = [
  '   █████╗ ██████╗ ███████╗██╗  ██╗',
  '  ██╔══██╗██╔══██╗██╔════╝╚██╗██╔╝',
  '  ███████║██████╔╝█████╗   ╚███╔╝ ',
  '  ██╔══██║██╔═══╝ ██╔══╝   ██╔██╗ ',
  '  ██║  ██║██║     ███████╗██╔╝ ██╗',
  '  ╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝',
];

const LINE_GRADIENTS: Array<{ from: RGB; to: RGB }> = [
  { from: { r: 136, g: 232, b: 255 }, to: { r: 142, g: 163, b: 255 } },
  { from: { r: 124, g: 219, b: 255 }, to: { r: 133, g: 134, b: 255 } },
  { from: { r: 113, g: 206, b: 255 }, to: { r: 124, g: 109, b: 247 } },
  { from: { r: 104, g: 188, b: 255 }, to: { r: 135, g: 104, b: 238 } },
  { from: { r: 130, g: 214, b: 255 }, to: { r: 170, g: 107, b: 255 } },
  { from: { r: 145, g: 226, b: 255 }, to: { r: 190, g: 119, b: 255 } },
];

export function LogoV2() {
  const cwd = getCwd();
  const hasAPEXMd = getFsImplementation().existsSync(join(cwd, 'APEX.md'));
  const apexMdStatus = hasAPEXMd ? '[APEX.md Found]' : '[APEX.md Missing]';

  return (
    <Box
      flexDirection="column"
      paddingX={2}
      paddingY={1}
      width={100}
      borderStyle="round"
      borderColor="rgb(95,120,255)"
    >
      <Box flexDirection="row" justifyContent="space-between">
        <Box flexDirection="column" marginX={2}>
          <GradientText
            text="   Welcome back to APEX"
            from={{ r: 178, g: 211, b: 255 }}
            to={{ r: 152, g: 166, b: 238 }}
          />
          {APEX_LOGO_LINES.map((line, idx) => (
            <Box key={line}>
              <GradientText
                text={line}
                from={LINE_GRADIENTS[idx]!.from}
                to={LINE_GRADIENTS[idx]!.to}
              />
            </Box>
          ))}
        </Box>

        <Box flexDirection="column" marginTop={4} marginRight={4} alignItems="flex-end">
          <Text color="rgb(170,185,255)">v2.1.87-dev</Text>
          <GradientText
            text="AI-POWERED CORE CLI"
            from={{ r: 179, g: 233, b: 255 }}
            to={{ r: 187, g: 154, b: 255 }}
          />
        </Box>
      </Box>

      <Box marginTop={2} paddingX={2}>
        <Text color="rgb(200,212,242)">
          APEX is a comprehensive AI platform that connects to advanced models for task 
          automation, optimization, and cloud services. Describe your objective to begin, 
          or use / for commands.
        </Text>
      </Box>

      <Box marginTop={1} paddingX={2} gap={2}>
        <Text>
          <Text color="rgb(180,195,240)">○ </Text>
          <Text color="rgb(180,195,240)">Connected to APEX Core   </Text>
          <Text color="rgb(77,219,129)">● </Text>
          <Text color="rgb(108,234,156)">Online   </Text>
          <Text color="rgb(96,168,255)">● </Text>
          <Text color="rgb(127,186,255)">Model: gpt-oss:20b-cloud   </Text>
          <Text color="rgb(128,161,255)">● </Text>
          <Text color="rgb(154,181,255)">Billing: API Usage Billing</Text>
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1} paddingX={2}>
        <Text color="rgb(255,211,104)">⚠ Notices:</Text>
        <Text color="rgb(255,190,91)">⚠ Plugin sync delayed. Retrying in background.</Text>
      </Box>

      <Box flexDirection="row" justifyContent="space-between" marginTop={1} paddingX={2}>
        <Box flexDirection="column">
          <Text color="rgb(168,177,212)">Activity: No recent activity yet.</Text>
          <Text color="rgb(168,177,212)">Activity: No recent activity yet.</Text>
        </Box>
        <Box marginTop={1}>
          <Text color="rgb(192,180,127)">{`Dir: ${cwd}   ${apexMdStatus}`}</Text>
        </Box>
      </Box>

    </Box>
  );
}
