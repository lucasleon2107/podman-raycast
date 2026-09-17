import { useState } from "react";
import { Action, ActionPanel, Color, Icon, Keyboard, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { ContainerLogs } from "./components/ContainerLogs";
import { InspectDetail } from "./components/InspectDetail";
import { firstHttpPort, formatPorts, shortId, shortImage, stateIcon } from "./lib/format";
import {
  containerName,
  killContainer,
  listContainers,
  pauseContainer,
  pruneContainers,
  removeContainer,
  restartContainer,
  startContainer,
  stopContainer,
  unpauseContainer,
} from "./lib/podman";
import { confirmDestructive, errorMessage, runAction } from "./lib/run";
import { openInTerminal, podmanCommandString } from "./lib/terminal";
import type { Container } from "./lib/types";

type Filter = "all" | "running" | "stopped";

export default function Command() {
  const [filter, setFilter] = useState<Filter>("all");
  const { data, isLoading, error, revalidate } = useCachedPromise(listContainers, [], { keepPreviousData: true });

  const containers = (data ?? []).filter((c) => !c.IsInfra);
  const running = containers.filter((c) => c.State === "running" || c.State === "paused");
  const stopped = containers.filter((c) => c.State !== "running" && c.State !== "paused");

  const sections: { title: string; items: Container[] }[] = [];
  if (filter !== "stopped") sections.push({ title: "Running", items: running });
  if (filter !== "running") sections.push({ title: "Stopped", items: stopped });

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search containers by name, image or ID"
      searchBarAccessory={
        <List.Dropdown tooltip="Filter" value={filter} onChange={(v) => setFilter(v as Filter)}>
          <List.Dropdown.Item title="All" value="all" />
          <List.Dropdown.Item title="Running" value="running" />
          <List.Dropdown.Item title="Stopped" value="stopped" />
        </List.Dropdown>
      }
    >
      {error && (
        <List.EmptyView
          icon={{ source: Icon.Warning, tintColor: Color.Red }}
          title="Could not list containers"
          description={errorMessage(error)}
          actions={
            <ActionPanel>
              <Action title="Retry" icon={Icon.ArrowClockwise} onAction={revalidate} />
            </ActionPanel>
          }
        />
      )}
      {!error && containers.length === 0 && (
        <List.EmptyView
          icon={Icon.Box}
          title="No containers"
          description="Run an image from the Manage Images command."
        />
      )}
      {sections.map((section) => (
        <List.Section key={section.title} title={section.title} subtitle={String(section.items.length)}>
          {section.items.map((c) => (
            <ContainerItem key={c.Id} container={c} revalidate={revalidate} />
          ))}
        </List.Section>
      ))}
    </List>
  );
}

function ContainerItem({ container: c, revalidate }: { container: Container; revalidate: () => void }) {
  const name = containerName(c);
  const isRunning = c.State === "running";
  const isPaused = c.State === "paused";
  const ports = formatPorts(c.Ports);
  const httpPort = firstHttpPort(c);

  const accessories: List.Item.Accessory[] = [];
  if (ports) accessories.push({ tag: ports, tooltip: "Published ports" });
  if (c.PodName) accessories.push({ icon: Icon.Layers, text: c.PodName, tooltip: "Pod" });
  accessories.push({ text: c.Status, tooltip: `State: ${c.State}` });

  const act = (fn: (id: string) => Promise<unknown>, verb: string) =>
    runAction(() => fn(c.Id), {
      loading: `${verb} ${name}`,
      success: `${name}: ${verb.toLowerCase()} done`,
      onDone: revalidate,
    });

  return (
    <List.Item
      icon={stateIcon(c.State)}
      title={name}
      subtitle={shortImage(c.Image)}
      keywords={[shortId(c.Id), c.Image, c.State]}
      accessories={accessories}
      actions={
        <ActionPanel title={name}>
          <ActionPanel.Section>
            {isRunning || isPaused ? (
              <Action title="Stop" icon={Icon.Stop} onAction={() => act(stopContainer, "Stopping")} />
            ) : (
              <Action title="Start" icon={Icon.Play} onAction={() => act(startContainer, "Starting")} />
            )}
            <Action
              title="Restart"
              icon={Icon.ArrowClockwise}
              shortcut={{ modifiers: ["cmd", "shift"], key: "r" }}
              onAction={() => act(restartContainer, "Restarting")}
            />
            {isRunning && (
              <Action
                title="Pause"
                icon={Icon.Pause}
                shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
                onAction={() => act(pauseContainer, "Pausing")}
              />
            )}
            {isPaused && (
              <Action
                title="Unpause"
                icon={Icon.Play}
                shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
                onAction={() => act(unpauseContainer, "Unpausing")}
              />
            )}
            {(isRunning || isPaused) && (
              <Action
                title="Kill"
                icon={Icon.XMarkCircle}
                style={Action.Style.Destructive}
                shortcut={{ modifiers: ["cmd", "shift"], key: "k" }}
                onAction={() => act(killContainer, "Killing")}
              />
            )}
          </ActionPanel.Section>

          <ActionPanel.Section>
            <Action.Push
              title="View Logs"
              icon={Icon.Document}
              shortcut={{ modifiers: ["cmd"], key: "l" }}
              target={<ContainerLogs id={c.Id} name={name} />}
            />
            <Action.Push
              title="Inspect"
              icon={Icon.MagnifyingGlass}
              shortcut={{ modifiers: ["cmd"], key: "i" }}
              target={<InspectDetail kind="container" id={c.Id} title={name} />}
            />
            {isRunning && (
              <Action
                title="Open Shell in Terminal"
                icon={Icon.Terminal}
                shortcut={{ modifiers: ["cmd"], key: "t" }}
                onAction={() =>
                  openInTerminal([
                    "exec",
                    "-it",
                    name,
                    "/bin/sh",
                    "-c",
                    "command -v bash >/dev/null && exec bash || exec sh",
                  ])
                }
              />
            )}
            {isRunning && (
              <Action
                title="Follow Logs in Terminal"
                icon={Icon.Terminal}
                shortcut={{ modifiers: ["cmd", "shift"], key: "l" }}
                onAction={() => openInTerminal(["logs", "--follow", "--tail", "100", name])}
              />
            )}
            {isRunning && httpPort && (
              <Action.OpenInBrowser
                title={`Open Port ${httpPort} in Browser`}
                url={`http://localhost:${httpPort}`}
                shortcut={Keyboard.Shortcut.Common.Open}
              />
            )}
          </ActionPanel.Section>

          <ActionPanel.Section>
            <Action.CopyToClipboard title="Copy Name" content={name} shortcut={Keyboard.Shortcut.Common.Copy} />
            <Action.CopyToClipboard title="Copy ID" content={c.Id} shortcut={Keyboard.Shortcut.Common.Copy} />
            <Action.CopyToClipboard title="Copy Image" content={c.Image} />
            <Action.CopyToClipboard
              title="Copy Exec Command"
              content={podmanCommandString(["exec", "-it", name, "sh"])}
            />
          </ActionPanel.Section>

          <ActionPanel.Section>
            <Action
              title="Remove"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              shortcut={Keyboard.Shortcut.Common.Remove}
              onAction={async () => {
                const ok = await confirmDestructive(
                  `Remove ${name}?`,
                  isRunning ? "The container is running and will be force-removed." : "This cannot be undone.",
                );
                if (ok) await act((id) => removeContainer(id, isRunning || isPaused), "Removing");
              }}
            />
            <Action
              title="Prune Stopped Containers"
              icon={Icon.Eraser}
              style={Action.Style.Destructive}
              onAction={async () => {
                const ok = await confirmDestructive(
                  "Prune stopped containers?",
                  "All stopped containers will be removed.",
                  "Prune",
                );
                if (ok)
                  await runAction(pruneContainers, {
                    loading: "Pruning",
                    success: "Stopped containers removed",
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
