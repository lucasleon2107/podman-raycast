import { Action, ActionPanel, Detail, Keyboard } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { inspect } from "../lib/podman";
import { codeBlock } from "../lib/format";
import { errorMessage } from "../lib/run";

interface Props {
  kind: "container" | "image" | "pod" | "volume";
  id: string;
  title: string;
}

export function InspectDetail({ kind, id, title }: Props) {
  const { data, isLoading, error, revalidate } = useCachedPromise(inspect, [kind, id]);

  const markdown = error
    ? `# ${title}\n\n**Failed to inspect ${kind}**\n\n${errorMessage(error)}`
    : `# ${title}\n\n${codeBlock(data ?? "", "json")}`;

  return (
    <Detail
      navigationTitle={`Inspect ${title}`}
      isLoading={isLoading}
      markdown={markdown}
      actions={
        <ActionPanel>
          {data && <Action.CopyToClipboard title="Copy JSON" content={data} />}
          <Action
            title="Reload"
            icon="arrow-clockwise-16"
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={revalidate}
          />
        </ActionPanel>
      }
    />
  );
}
