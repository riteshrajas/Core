const fs = require('fs');
const contents = fs.readFileSync('P:/APEX/Core/CLI/src/components/ConsoleOAuthFlow.tsx', 'utf8');

const t6ToFind = \            }, {
              label: <Text>OpenAI Codex account ·{" "}<Text dimColor={true}>ChatGPT Plus/Pro subscription</Text>{"\\\\n"}</Text>,
              value: "codex"
            }];
            $[5] = t6;\;

const t6Replacement = \            }, {
              label: <Text>OpenAI Codex account ·{" "}<Text dimColor={true}>ChatGPT Plus/Pro subscription</Text>{"\\\\n"}</Text>,
              value: "codex"
            }, {
              label: <Text>Pyintel Foundry ·{" "}<Text dimColor={true}>Basically What the core inteligence ran on (ollama, lm studio)</Text>{"\\\\n"}</Text>,
              value: "pyintel"
            }];
            $[5] = t6;\;

let updated = contents.replace(t6ToFind, t6Replacement);

const onChangeToFind = \                } else if (value_0 === "codex") {\;
const onChangeReplacement = \                } else if (value_0 === "pyintel") {
                  logEvent("tengu_oauth_pyintel_selected", {});
                  setOAuthStatus({
                    state: "pyintel_setup"
                  });
                } else if (value_0 === "codex") {\;
updated = updated.replace(onChangeToFind, onChangeReplacement);

const caseToFind = \      case "platform_setup":\;
const caseReplacement = \      case "pyintel_setup":
        return (
          <Box flexDirection="column" gap={1} marginTop={1}>
            <Text bold={true}>Using Pyintel Foundry</Text>
            <Box flexDirection="column" gap={1}>
              <Text>Set the required environment variables (e.g. for Ollama or LM Studio), then restart APEX Code.</Text>
              <Box marginTop={1}>
                <Text dimColor={true}>Press <Text bold={true}>Enter</Text> to go back to login options.</Text>
              </Box>
            </Box>
          </Box>
        );
      case "platform_setup":\;
updated = updated.replace(caseToFind, caseReplacement);

const isActiveToFind = \isActive: oauthStatus.state === 'platform_setup'\;
const isActiveReplacement = \isActive: oauthStatus.state === 'platform_setup' || oauthStatus.state === 'pyintel_setup'\;
updated = updated.replace(isActiveToFind, isActiveReplacement);

const typeToFind = \| {
  state: 'platform_setup';
} // Show platform setup info (Bedrock/Vertex/Foundry)\;

const typeReplacement = \| {
  state: 'platform_setup';
} // Show platform setup info (Bedrock/Vertex/Foundry)
| {
  state: 'pyintel_setup';
} // Show Pyintel Foundry setup info\;

updated = updated.replace(typeToFind, typeReplacement);

fs.writeFileSync('P:/APEX/Core/CLI/src/components/ConsoleOAuthFlow.tsx', updated);
