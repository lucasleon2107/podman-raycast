import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { getPreferenceValues } from "@raycast/api";
import type { Container, Image, Machine, Pod, Volume } from "./types";

const execFileAsync = promisify(execFile);

const CANDIDATE_PATHS = [
  "/opt/homebrew/bin/podman",
  "/usr/local/bin/podman",
  "/opt/podman/bin/podman",
  "/usr/bin/podman",
];

const EXTRA_PATH = "/opt/homebrew/bin:/usr/local/bin:/opt/podman/bin";

export class PodmanError extends Error {
  readonly stderr: string;
  readonly args: string[];

  constructor(message: string, stderr: string, args: string[]) {
    super(message);
    this.name = "PodmanError";
    this.stderr = stderr;
    this.args = args;
  }

  get isMachineDown(): boolean {
    return /Cannot connect to Podman|connection refused|unable to connect to Podman socket|podman machine .* is not running|machine .* is not running/i.test(
      this.stderr,
    );
  }
}

export function podmanPath(): string {
  const { podmanPath } = getPreferenceValues<Preferences>();
  const configured = podmanPath?.trim();
  if (configured) return configured;
  return CANDIDATE_PATHS.find((p) => existsSync(p)) ?? "podman";
}

export function podmanEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PATH: `${process.env.PATH ?? ""}:${EXTRA_PATH}` };
}

function cleanStderr(stderr: string): string {
  const lines = stderr
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("WARN"));
  const last = lines.at(-1) ?? "";
  return last.replace(/^Error:\s*/i, "");
}

export async function podman(args: string[], options: { timeout?: number } = {}): Promise<string> {
  try {
    const { stdout } = await execFileAsync(podmanPath(), args, {
      env: podmanEnv(),
      timeout: options.timeout ?? 60_000,
      maxBuffer: 64 * 1024 * 1024,
    });
    return stdout;
  } catch (error) {
    const e = error as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
    if (e.code === "ENOENT") {
      throw new PodmanError(
        `podman not found at "${podmanPath()}". Set the Podman Binary preference.`,
        e.stderr ?? "",
        args,
      );
    }
    const stderr = e.stderr ?? "";
    throw new PodmanError(cleanStderr(stderr) || e.message, stderr, args);
  }
}

export async function podmanJson<T>(args: string[], options: { timeout?: number } = {}): Promise<T> {
  const out = await podman([...args, "--format", "json"], options);
  const trimmed = out.trim();
  if (!trimmed) return [] as unknown as T;
  return JSON.parse(trimmed) as T;
}

// Containers

export function listContainers(): Promise<Container[]> {
  return podmanJson<Container[]>(["ps", "--all"]);
}

export function containerName(c: Container): string {
  return c.Names?.[0] ?? c.Id.slice(0, 12);
}

export const startContainer = (id: string) => podman(["start", id]);
export const stopContainer = (id: string) => podman(["stop", id], { timeout: 120_000 });
export const restartContainer = (id: string) => podman(["restart", id], { timeout: 120_000 });
export const killContainer = (id: string) => podman(["kill", id]);
export const pauseContainer = (id: string) => podman(["pause", id]);
export const unpauseContainer = (id: string) => podman(["unpause", id]);
export const removeContainer = (id: string, force = false) => podman(["rm", ...(force ? ["--force"] : []), id]);
export const pruneContainers = () => podman(["container", "prune", "--force"]);

export async function containerLogsCombined(id: string, tail: number): Promise<string> {
  // Merge stdout and stderr so log output from either stream is shown.
  return new Promise((resolve, reject) => {
    execFile(
      podmanPath(),
      ["logs", "--tail", String(tail), id],
      { env: podmanEnv(), maxBuffer: 64 * 1024 * 1024, timeout: 30_000 },
      (error, stdout, stderr) => {
        if (error && !stdout && !stderr) {
          reject(new PodmanError(cleanStderr(stderr) || error.message, stderr, ["logs", id]));
          return;
        }
        if (error && !stdout) {
          // A hard failure (e.g. no such container) has only stderr with an Error: prefix.
          if (/^Error:/m.test(stderr)) {
            reject(new PodmanError(cleanStderr(stderr), stderr, ["logs", id]));
            return;
          }
        }
        resolve([stdout, stderr].filter(Boolean).join(""));
      },
    );
  });
}

export function inspect(kind: "container" | "image" | "pod" | "volume", id: string): Promise<string> {
  return podman([kind, "inspect", id]);
}

// Images

export function listImages(): Promise<Image[]> {
  return podmanJson<Image[]>(["images"]);
}

export function imageName(i: Image): string {
  return i.Names?.[0] ?? i.RepoTags?.[0] ?? "<none>";
}

export const pullImage = (ref: string) => podman(["pull", ref], { timeout: 15 * 60_000 });
export const removeImage = (id: string, force = false) => podman(["rmi", ...(force ? ["--force"] : []), id]);
export const pruneImages = (all = false) => podman(["image", "prune", "--force", ...(all ? ["--all"] : [])]);

// Pods

export function listPods(): Promise<Pod[]> {
  return podmanJson<Pod[]>(["pod", "ps"]);
}

export const startPod = (id: string) => podman(["pod", "start", id]);
export const stopPod = (id: string) => podman(["pod", "stop", id], { timeout: 120_000 });
export const restartPod = (id: string) => podman(["pod", "restart", id], { timeout: 120_000 });
export const killPod = (id: string) => podman(["pod", "kill", id]);
export const removePod = (id: string, force = false) => podman(["pod", "rm", ...(force ? ["--force"] : []), id]);

// Volumes

export function listVolumes(): Promise<Volume[]> {
  return podmanJson<Volume[]>(["volume", "ls"]);
}

export const removeVolume = (name: string, force = false) =>
  podman(["volume", "rm", ...(force ? ["--force"] : []), name]);
export const pruneVolumes = () => podman(["volume", "prune", "--force"]);

// Machines

export function listMachines(): Promise<Machine[]> {
  return podmanJson<Machine[]>(["machine", "list"]);
}

export const startMachine = (name: string) => podman(["machine", "start", name], { timeout: 5 * 60_000 });
export const stopMachine = (name: string) => podman(["machine", "stop", name], { timeout: 5 * 60_000 });
export const removeMachine = (name: string) => podman(["machine", "rm", "--force", name], { timeout: 2 * 60_000 });
export const setDefaultMachine = (name: string) => podman(["system", "connection", "default", name]);
export const inspectMachine = (name: string) => podman(["machine", "inspect", name]);
