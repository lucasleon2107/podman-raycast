import { Action, ActionPanel, Color, Icon, Keyboard, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { InspectDetail } from "./components/InspectDetail";
import { relativeTime, shortId, stateIcon } from "./lib/format";
import { killPod, listPods, removePod, restartPod, startPod, stopPod } from "./lib/podman";
import { confirmDestructive, errorMessage, runAction } from "./lib/run";
import type { Pod } from "./lib/types";

export default function Command() {
  const { data, isLoading, error, revalidate } = useCachedPromise(listPods, [], { keepPreviousData: true });
  const pods = data ?? [];

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search pods">
      {error && (
        <List.EmptyView
          icon={{ source: Icon.Warning, tintColor: Color.Red }}
          title="Could not list pods"
          description={errorMessage(error)}
          actions={
            <ActionPanel>
              <Action title="Retry" icon={Icon.ArrowClockwise} onAction={revalidate} />
            </ActionPanel>
          }
        />
      )}
      {!error && pods.length === 0 && (
        <List.EmptyView
          icon={Icon.Layers}
          title="No pods"
          description="Create one with: podman pod create --name my-pod"
        />
      )}
      {pods.map((pod) => (
        <PodItem key={pod.Id} pod={pod} revalidate={revalidate} />
      ))}
    </List>
  );
}

function PodItem({ pod, revalidate }: { pod: Pod; revalidate: () => void }) {
  const state = pod.Status.toLowerCase();
  const isRunning = state === "running" || state === "degraded";
  const userContainers = (pod.Containers ?? []).filter((c) => c.Id !== pod.InfraId);

  const act = (fn: (id: string) => Promise<unknown>, verb: string) =>
    runAction(() => fn(pod.Id), {
      loading: `${verb} ${pod.Name}`,
      success: `${pod.Name}: ${verb.toLowerCase()} done`,
      onDone: revalidate,
    });

  return (
    <List.Item
      icon={stateIcon(state === "degraded" ? "stopping" : state)}
      title={pod.Name}
      subtitle={shortId(pod.Id)}
      keywords={[shortId(pod.Id), pod.Status, ...userContainers.map((c) => c.Names)]}
      accessories={[
        {
          icon: Icon.Box,
          text: String(userContainers.length),
          tooltip: userContainers.map((c) => `${c.Names} (${c.Status})`).join("\n") || "No containers",
        },
        { tag: { value: pod.Status, color: isRunning ? Color.Green : Color.SecondaryText } },
        { text: relativeTime(pod.Created), tooltip: pod.Created },
      ]}
      actions={
        <ActionPanel title={pod.Name}>
          <ActionPanel.Section>
            {isRunning ? (
              <Action title="Stop" icon={Icon.Stop} onAction={() => act(stopPod, "Stopping")} />
            ) : (
              <Action title="Start" icon={Icon.Play} onAction={() => act(startPod, "Starting")} />
            )}
            <Action
              title="Restart"
              icon={Icon.ArrowClockwise}
              shortcut={{ modifiers: ["cmd", "shift"], key: "r" }}
              onAction={() => act(restartPod, "Restarting")}
            />
            {isRunning && (
              <Action
                title="Kill"
                icon={Icon.XMarkCircle}
                style={Action.Style.Destructive}
                shortcut={{ modifiers: ["cmd", "shift"], key: "k" }}
                onAction={() => act(killPod, "Killing")}
              />
            )}
            <Action.Push
              title="Inspect"
              icon={Icon.MagnifyingGlass}
              shortcut={{ modifiers: ["cmd"], key: "i" }}
              target={<InspectDetail kind="pod" id={pod.Id} title={pod.Name} />}
            />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action.CopyToClipboard title="Copy Name" content={pod.Name} shortcut={Keyboard.Shortcut.Common.Copy} />
            <Action.CopyToClipboard title="Copy ID" content={pod.Id} shortcut={Keyboard.Shortcut.Common.Copy} />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action
              title="Remove"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              shortcut={Keyboard.Shortcut.Common.Remove}
              onAction={async () => {
                const ok = await confirmDestructive(
                  `Remove pod ${pod.Name}?`,
                  `The pod and its ${userContainers.length} container(s) will be removed.`,
                );
                if (ok) await act((id) => removePod(id, true), "Removing");
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
