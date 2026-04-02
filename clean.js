const fs = require('fs');
const p = 'P:/APEX/Core/CLI/src/components/ConsoleOAuthFlow.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(/\} else if \(value_0 === "pyintel"\) \{\\n\s*logEvent\("tengu_oauth_pyintel_selected", \{\}\);\\n\s*setOAuthStatus\(\{\\n\s*state: "pyintel_setup"\\n\s*\}\);\\n\s*\}/, "");

c = c.replace(/\\n/g, "\n");
fs.writeFileSync(p, c);
