import { getPreferenceValues } from "@raycast/api";
import { runAppleScript } from "@raycast/utils";
import { podmanPath } from "./podman";

function shellQuote(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

function appleScriptQuote(text: string): string {
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Open the user's preferred terminal and run a podman command in it. */
export async function openInTerminal(args: string[]): Promise<void> {
  const { terminalApp } = getPreferenceValues<Preferences>();
  const command = [podmanPath(), ...args].map(shellQuote).join(" ");
  const quoted = appleScriptQuote(command);

  if (terminalApp === "iTerm") {
    await runAppleScript(`
      tell application "iTerm"
        activate
        if (count of windows) = 0 then
          create window with default profile
        else
          tell current window to create tab with default profile
        end if
        tell current session of current window to write text ${quoted}
      end tell
    `);
    return;
  }

  await runAppleScript(`
    tell application "Terminal"
      activate
      do script ${quoted}
    end tell
  `);
}

export function podmanCommandString(args: string[]): string {
  return ["podman", ...args].map((a) => (/[\s'"$`]/.test(a) ? shellQuote(a) : a)).join(" ");
}
