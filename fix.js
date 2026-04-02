const fs = require('fs');
const p = 'P:/APEX/Core/CLI/src/components/ConsoleOAuthFlow.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(/isActive: oauthStatus\.state === 'platform_setup'/,
  "isActive: oauthStatus.state === 'platform_setup' || oauthStatus.state === 'pyintel_setup'");

c = c.replace(
  'case "platform_setup":',
  `case "pyintel_setup":
        return (
          <Box flexDirection="column" gap={1} marginTop={1}>
            <Text bold={true}>Using Pyintel Foundry</Text>
            <Box flexDirection="column" gap={1}>
              <Text>Set the required environment variables (e.g. for Ollama or LM Studio), then restart Pyintel Code.</Text>
              <Box marginTop={1}>
                <Text dimColor={true}>Press <Text bold={true}>Enter</Text> to go back to login options.</Text>
              </Box>
            </Box>
          </Box>
        );
      case "platform_setup":`
);

let t6Match = c.match(/\{[\s\S]*?value: "codex"[\s\S]*?\};/);
if (t6Match && !c.includes('value: "pyintel"')) {
    c = c.replace(/value: "codex"\n\s*\}\];/, `value: "codex"\n            }, {\n              label: <Text>Pyintel Foundry ·{" "}<Text dimColor={true}>Basically What the core inteligence ran on (ollama, lm studio)</Text>{"\\n"}</Text>,\n              value: "pyintel"\n            }];`);
}

c = c.replace(/} else if \(value_0 === "codex"\) \{/g, `} else if (value_0 === "pyintel") {\n                  logEvent("tengu_oauth_pyintel_selected", {});\n                  setOAuthStatus({\n                    state: "pyintel_setup"\n                  });\n                } else if (value_0 === "codex") {`);

fs.writeFileSync(p, c);
