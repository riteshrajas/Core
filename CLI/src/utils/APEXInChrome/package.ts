type BrowserTool = { name: string }

type APEXForChromePackage = {
  BROWSER_TOOLS?: BrowserTool[]
  createAPEXForChromeMcpServer?: (...args: any[]) => any
}

let cachedPackage: APEXForChromePackage | null | undefined

function loadAPEXForChromePackage(): APEXForChromePackage | null {
  if (cachedPackage !== undefined) {
    return cachedPackage
  }

  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    cachedPackage = require('@ant/APEX-for-chrome-mcp') as APEXForChromePackage
    /* eslint-enable @typescript-eslint/no-require-imports */
  } catch {
    cachedPackage = null
  }

  return cachedPackage
}

export function getChromeBrowserTools(): BrowserTool[] {
  return loadAPEXForChromePackage()?.BROWSER_TOOLS ?? []
}

export async function importAPEXForChromePackage(): Promise<APEXForChromePackage> {
  return (await import('@ant/APEX-for-chrome-mcp')) as APEXForChromePackage
}
