import { Color, Icon, MenuBarExtra, launchCommand, LaunchType, open, showHUD, Keyboard } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { firstHttpPort, shortImage } from "./lib/format";
import {
  containerName,
  listContainers,
  listMachines,
  PodmanError,
  restartContainer,
  startContainer,
  startMachine,
  stopContainer,
  stopMachine,
} from "./lib/podman";
import { errorMessage } from "./lib/run";
import { openInTerminal } from "./lib/terminal";

async function loadStatus() {
  const machines = await listMachines().catch(() => []);
  const machine = machines.find((m) => m.Default) ?? machines[0];
  if (machine && !machine.Running) {
    return { machine, machines, containers: [], machineDown: true as const };
  }
  try {
    const containers = (await listContainers()).filter((c) => !c.IsInfra);
    return { machine, machines, containers, machineDown: false as const };
  } catch (error) {
    if (error instanceof PodmanError && error.isMachineDown) {
      return { machine, machines, containers: [], machineDown: true as const };
    }
    throw error;
  }
}

async function withHud(action: () => Promise<unknown>, done: string, revalidate: () => void) {
  try {
    await action();
    await showHUD(done);
  } catch (error) {
    await showHUD(`Podman: ${errorMessage(error)}`);
  } finally {
    revalidate();
  }
}

export default function Command() {
  const { data, isLoading, error, revalidate } = useCachedPromise(loadStatus, [], { keepPreviousData: true });

  const containers = data?.containers ?? [];
  const running = containers.filter((c) => c.State === "running" || c.State === "paused");
  const stopped = containers.filter((c) => c.State !== "running" && c.State !== "paused");
  const machineDown = data?.machineDown ?? false;

  const icon = machineDown
    ? { source: "podman-icon.png", tintColor: Color.SecondaryText }
    : { source: "podman-icon.png" };
  const title = machineDown ? undefined : running.length > 0 ? String(running.length) : undefined;

  return (
    <MenuBarExtra icon={icon} title={title} tooltip="Podman" isLoading={isLoading}>
      {error && <MenuBarExtra.Item title={errorMessage(error)} icon={Icon.Warning} />}

      {data?.machine && (
        <MenuBarExtra.Section title="Machine">
          <MenuBarExtra.Item
            title={`${data.machine.Name} · ${machineDown ? "stopped" : "running"}`}
            icon={{ source: Icon.Desktop, tintColor: machineDown ? Color.SecondaryText : Color.Green }}
            onAction={() => launchCommand({ name: "machine", type: LaunchType.UserInitiated })}
          />
          {machineDown ? (
            <MenuBarExtra.Item
              title="Start Machine"
              icon={Icon.Play}
              onAction={() => withHud(() => startMachine(data.machine.Name), "Podman machine started", revalidate)}
            />
          ) : (
            <MenuBarExtra.Item
              title="Stop Machine"
              icon={Icon.Stop}
              onAction={() => withHud(() => stopMachine(data.machine.Name), "Podman machine stopped", revalidate)}
            />
          )}
        </MenuBarExtra.Section>
      )}

      {!machineDown && (
        <MenuBarExtra.Section title={`Running (${running.length})`}>
          {running.length === 0 && <MenuBarExtra.Item title="No running containers" />}
          {running.map((c) => {
            const name = containerName(c);
            const port = firstHttpPort(c);
            return (
              <MenuBarExtra.Submenu
                key={c.Id}
                title={name}
                icon={{ source: Icon.CircleFilled, tintColor: c.State === "paused" ? Color.Yellow : Color.Green }}
              >
                <MenuBarExtra.Item title={shortImage(c.Image)} icon={Icon.HardDrive} />
                <MenuBarExtra.Item title={c.Status} icon={Icon.Clock} />
                <MenuBarExtra.Separator />
                <MenuBarExtra.Item
                  title="Stop"
                  icon={Icon.Stop}
                  onAction={() => withHud(() => stopContainer(c.Id), `${name} stopped`, revalidate)}
                />
                <MenuBarExtra.Item
                  title="Restart"
                  icon={Icon.ArrowClockwise}
                  onAction={() => withHud(() => restartContainer(c.Id), `${name} restarted`, revalidate)}
                />
                <MenuBarExtra.Item
                  title="Follow Logs in Terminal"
                  icon={Icon.Terminal}
                  onAction={() => openInTerminal(["logs", "--follow", "--tail", "100", name])}
                />
                <MenuBarExtra.Item
                  title="Open Shell in Terminal"
                  icon={Icon.Terminal}
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
                {port && (
                  <MenuBarExtra.Item
                    title={`Open localhost:${port}`}
                    icon={Icon.Globe}
                    onAction={() => open(`http://localhost:${port}`)}
                  />
                )}
              </MenuBarExtra.Submenu>
            );
          })}
        </MenuBarExtra.Section>
      )}

      {!machineDown && stopped.length > 0 && (
        <MenuBarExtra.Section title={`Stopped (${stopped.length})`}>
          {stopped.slice(0, 15).map((c) => {
            const name = containerName(c);
            return (
              <MenuBarExtra.Item
                key={c.Id}
                title={name}
                subtitle={shortImage(c.Image)}
                icon={{ source: Icon.CircleFilled, tintColor: Color.SecondaryText }}
                onAction={() => withHud(() => startContainer(c.Id), `${name} started`, revalidate)}
              />
            );
          })}
          {stopped.length > 15 && <MenuBarExtra.Item title={`… and ${stopped.length - 15} more`} />}
        </MenuBarExtra.Section>
      )}

      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          title="Manage Containers"
          icon={Icon.Box}
          shortcut={{ modifiers: ["cmd"], key: "m" }}
          onAction={() => launchCommand({ name: "containers", type: LaunchType.UserInitiated })}
        />
        <MenuBarExtra.Item
          title="Refresh"
          icon={Icon.ArrowClockwise}
          shortcut={Keyboard.Shortcut.Common.Refresh}
          onAction={revalidate}
        />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}
