import { Action, ActionPanel, Color, Detail, Icon, Keyboard, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { codeBlock, formatBytes, relativeTime } from "./lib/format";
import {
  inspectMachine,
  listMachines,
  removeMachine,
  setDefaultMachine,
  startMachine,
  stopMachine,
} from "./lib/podman";
import { confirmDestructive, errorMessage, runAction } from "./lib/run";
import { openInTerminal } from "./lib/terminal";
import type { Machine } from "./lib/types";

export default function Command() {
  const { data, isLoading, error, revalidate } = useCachedPromise(listMachines, [], { keepPreviousData: true });
  const machines = data ?? [];

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search machines">
      {error && (
        <List.EmptyView
          icon={{ source: Icon.Warning, tintColor: Color.Red }}
          title="Could not list machines"
          description={errorMessage(error)}
          actions={
            <ActionPanel>
              <Action title="Retry" icon={Icon.ArrowClockwise} onAction={revalidate} />
            </ActionPanel>
          }
        />
      )}
      {!error && machines.length === 0 && (
        <List.EmptyView icon={Icon.Desktop} title="No machines" description="Create one with: podman machine init" />
      )}
      {machines.map((m) => (
        <MachineItem key={m.Name} machine={m} revalidate={revalidate} />
      ))}
    </List>
  );
}

function machineState(m: Machine): { label: string; color: Color } {
  if (m.Starting) return { label: "starting", color: Color.Orange };
  if (m.Running) return { label: "running", color: Color.Green };
  return { label: "stopped", color: Color.SecondaryText };
}

function MachineItem({ machine: m, revalidate }: { machine: Machine; revalidate: () => void }) {
  const state = machineState(m);
  const act = (fn: (name: string) => Promise<unknown>, verb: string, done: string) =>
    runAction(() => fn(m.Name), { loading: `${verb} ${m.Name}`, success: `${m.Name} ${done}`, onDone: revalidate });

  return (
    <List.Item
      icon={{ source: Icon.Desktop, tintColor: state.color }}
      title={m.Name}
      subtitle={m.VMType}
      keywords={[m.VMType, state.label]}
      accessories={[
        ...(m.Default ? [{ tag: "default", tooltip: "Default connection" }] : []),
        { icon: Icon.ComputerChip, text: `${m.CPUs} CPU`, tooltip: "CPUs" },
        { icon: Icon.MemoryChip, text: formatBytes(Number(m.Memory)), tooltip: "Memory" },
        { icon: Icon.HardDrive, text: formatBytes(Number(m.DiskSize)), tooltip: "Disk" },
        {
          tag: { value: state.label, color: state.color },
          tooltip: m.LastUp ? `Last up ${relativeTime(m.LastUp)}` : undefined,
        },
      ]}
      actions={
        <ActionPanel title={m.Name}>
          <ActionPanel.Section>
            {m.Running ? (
              <Action title="Stop Machine" icon={Icon.Stop} onAction={() => act(stopMachine, "Stopping", "stopped")} />
            ) : (
              <Action
                title="Start Machine"
                icon={Icon.Play}
                onAction={() => act(startMachine, "Starting", "started")}
              />
            )}
            {m.Running && (
              <Action
                title="Restart Machine"
                icon={Icon.ArrowClockwise}
                shortcut={{ modifiers: ["cmd", "shift"], key: "r" }}
                onAction={() =>
                  act(
                    async (name) => {
                      await stopMachine(name);
                      await startMachine(name);
                    },
                    "Restarting",
                    "restarted",
                  )
                }
              />
            )}
            {m.Running && (
              <Action
                title="SSH into Machine"
                icon={Icon.Terminal}
                shortcut={{ modifiers: ["cmd"], key: "t" }}
                onAction={() => openInTerminal(["machine", "ssh", m.Name])}
              />
            )}
            {!m.Default && (
              <Action
                title="Set as Default"
                icon={Icon.Star}
                onAction={() => act(setDefaultMachine, "Setting default", "is now the default")}
              />
            )}
            <Action.Push
              title="Inspect"
              icon={Icon.MagnifyingGlass}
              shortcut={{ modifiers: ["cmd"], key: "i" }}
              target={<MachineInspect name={m.Name} />}
            />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action.CopyToClipboard title="Copy Name" content={m.Name} shortcut={Keyboard.Shortcut.Common.Copy} />
            <Action.CopyToClipboard
              title="Copy SSH Command"
              content={`ssh -i ${m.IdentityPath} -p ${m.Port} ${m.RemoteUsername}@localhost`}
            />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action
              title="Remove Machine"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              shortcut={Keyboard.Shortcut.Common.Remove}
              onAction={async () => {
                const ok = await confirmDestructive(
                  `Remove machine ${m.Name}?`,
                  "The VM, its disk image and every container and image inside it are deleted permanently.",
                );
                if (ok) await act(removeMachine, "Removing", "removed");
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

function MachineInspect({ name }: { name: string }) {
  const { data, isLoading, error, revalidate } = useCachedPromise(inspectMachine, [name]);
  const markdown = error
    ? `# ${name}\n\n**Failed to inspect machine**\n\n${errorMessage(error)}`
    : `# ${name}\n\n${codeBlock(data ?? "", "json")}`;
  return (
    <Detail
      navigationTitle={`Inspect ${name}`}
      isLoading={isLoading}
      markdown={markdown}
      actions={
        <ActionPanel>
          {data && <Action.CopyToClipboard title="Copy JSON" content={data} />}
          <Action
            title="Reload"
            icon={Icon.ArrowClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={revalidate}
          />
        </ActionPanel>
      }
    />
  );
}
