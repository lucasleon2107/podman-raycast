import { Action, ActionPanel, Color, Icon, Keyboard, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { InspectDetail } from "./components/InspectDetail";
import { relativeTime } from "./lib/format";
import { listVolumes, pruneVolumes, removeVolume } from "./lib/podman";
import { confirmDestructive, errorMessage, runAction } from "./lib/run";
import type { Volume } from "./lib/types";

export default function Command() {
  const { data, isLoading, error, revalidate } = useCachedPromise(listVolumes, [], { keepPreviousData: true });
  const volumes = data ?? [];
  const named = volumes.filter((v) => !/^[0-9a-f]{64}$/.test(v.Name));
  const anonymous = volumes.filter((v) => /^[0-9a-f]{64}$/.test(v.Name));

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search volumes">
      {error && (
        <List.EmptyView
          icon={{ source: Icon.Warning, tintColor: Color.Red }}
          title="Could not list volumes"
          description={errorMessage(error)}
          actions={
            <ActionPanel>
              <Action title="Retry" icon={Icon.ArrowClockwise} onAction={revalidate} />
            </ActionPanel>
          }
        />
      )}
      {!error && volumes.length === 0 && <List.EmptyView icon={Icon.Folder} title="No volumes" />}
      <List.Section title="Named" subtitle={String(named.length)}>
        {named.map((v) => (
          <VolumeItem key={v.Name} volume={v} revalidate={revalidate} />
        ))}
      </List.Section>
      <List.Section title="Anonymous" subtitle={String(anonymous.length)}>
        {anonymous.map((v) => (
          <VolumeItem key={v.Name} volume={v} revalidate={revalidate} />
        ))}
      </List.Section>
    </List>
  );
}

function VolumeItem({ volume: v, revalidate }: { volume: Volume; revalidate: () => void }) {
  const title = /^[0-9a-f]{64}$/.test(v.Name) ? v.Name.slice(0, 12) : v.Name;
  const inUse = v.MountCount > 0;

  return (
    <List.Item
      icon={Icon.Folder}
      title={title}
      subtitle={v.Driver}
      keywords={[v.Name, v.Mountpoint]}
      accessories={[
        ...(inUse
          ? [{ tag: { value: "mounted", color: Color.Green }, tooltip: `${v.MountCount} active mount(s)` }]
          : []),
        { text: relativeTime(v.CreatedAt), tooltip: v.CreatedAt },
      ]}
      actions={
        <ActionPanel title={title}>
          <ActionPanel.Section>
            <Action.Push
              title="Inspect"
              icon={Icon.MagnifyingGlass}
              shortcut={{ modifiers: ["cmd"], key: "i" }}
              target={<InspectDetail kind="volume" id={v.Name} title={title} />}
            />
            <Action.CopyToClipboard title="Copy Name" content={v.Name} shortcut={Keyboard.Shortcut.Common.Copy} />
            <Action.CopyToClipboard title="Copy Mountpoint" content={v.Mountpoint} />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action
              title="Remove"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              shortcut={Keyboard.Shortcut.Common.Remove}
              onAction={async () => {
                const ok = await confirmDestructive(
                  `Remove volume ${title}?`,
                  inUse
                    ? "The volume is in use. Containers using it will be removed too."
                    : "All data in the volume is lost.",
                );
                if (ok)
                  await runAction(() => removeVolume(v.Name, inUse), {
                    loading: `Removing ${title}`,
                    success: `${title} removed`,
                    onDone: revalidate,
                  });
              }}
            />
            <Action
              title="Prune Unused Volumes"
              icon={Icon.Eraser}
              style={Action.Style.Destructive}
              onAction={async () => {
                const ok = await confirmDestructive(
                  "Prune unused volumes?",
                  "Every volume not used by a container is removed.",
                  "Prune",
                );
                if (ok)
                  await runAction(pruneVolumes, {
                    loading: "Pruning",
                    success: "Unused volumes removed",
                    onDone: revalidate,
                  });
              }}
            />
            <Action
              title="Refresh"
              icon={Icon.ArrowClockwise}
              shortcut={Keyboard.Shortcut.Common.Refresh}
              onAction={revalidate}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
