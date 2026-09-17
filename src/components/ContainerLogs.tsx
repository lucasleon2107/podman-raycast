import { useState } from "react";
import { Action, ActionPanel, Detail, Icon, getPreferenceValues, Keyboard } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { containerLogsCombined } from "../lib/podman";
import { codeBlock } from "../lib/format";
import { errorMessage } from "../lib/run";

interface Props {
  id: string;
  name: string;
}

function defaultTail(): number {
  const { logTail } = getPreferenceValues<Preferences>();
  const parsed = Number.parseInt(logTail ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 200;
}

export function ContainerLogs({ id, name }: Props) {
  const [tail, setTail] = useState(defaultTail);
  const { data, isLoading, error, revalidate } = useCachedPromise(containerLogsCombined, [id, tail], {
    keepPreviousData: true,
  });

  let markdown: string;
  if (error) {
    markdown = `# ${name}\n\n**Failed to load logs**\n\n${errorMessage(error)}`;
  } else if (data !== undefined && data.trim() === "") {
    markdown = `# ${name}\n\n_No log output._`;
  } else {
    markdown = `# ${name}\n\n_Last ${tail} lines_\n\n${codeBlock(data ?? "")}`;
  }

  return (
    <Detail
      navigationTitle={`Logs: ${name}`}
      isLoading={isLoading}
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action
            title="Reload"
            icon={Icon.ArrowClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={revalidate}
          />
          <Action
            title="Load More Lines"
            icon={Icon.Plus}
            shortcut={{ modifiers: ["cmd"], key: "l" }}
            onAction={() => setTail((t) => t * 2)}
          />
          {data && <Action.CopyToClipboard title="Copy Logs" content={data} />}
        </ActionPanel>
      }
    />
  );
}
