import { Color, Icon, type Image as RaycastImage } from "@raycast/api";
import type { Container, PortMapping } from "./types";

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exp;
  return `${value.toFixed(value >= 100 || exp === 0 ? 0 : 1)} ${units[exp]}`;
}

export function shortId(id: string): string {
  return id.slice(0, 12);
}

export function shortImage(ref: string): string {
  return ref.replace(/^docker\.io\/library\//, "").replace(/^docker\.io\//, "");
}

export function relativeTime(input: number | string): string {
  const date = typeof input === "number" ? new Date(input * 1000) : new Date(input);
  const diff = Date.now() - date.getTime();
  if (Number.isNaN(diff)) return String(input);
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 60) return `${days} d ago`;
  const months = Math.round(days / 30);
  if (months < 24) return `${months} mo ago`;
  return `${Math.round(months / 12)} y ago`;
}

export function stateIcon(state: string): RaycastImage.ImageLike {
  switch (state) {
    case "running":
      return { source: Icon.CircleFilled, tintColor: Color.Green };
    case "paused":
      return { source: Icon.Pause, tintColor: Color.Yellow };
    case "created":
    case "initialized":
      return { source: Icon.Circle, tintColor: Color.Blue };
    case "stopping":
      return { source: Icon.CircleProgress50, tintColor: Color.Orange };
    case "exited":
    case "stopped":
      return { source: Icon.CircleFilled, tintColor: Color.SecondaryText };
    default:
      return { source: Icon.QuestionMarkCircle, tintColor: Color.SecondaryText };
  }
}

export function formatPorts(ports: PortMapping[] | null | undefined): string {
  if (!ports?.length) return "";
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const p of ports) {
    const key = `${p.host_port}:${p.container_port}/${p.protocol}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const suffix = p.protocol && p.protocol !== "tcp" ? `/${p.protocol}` : "";
    parts.push(
      p.host_port === p.container_port ? `${p.host_port}${suffix}` : `${p.host_port}→${p.container_port}${suffix}`,
    );
  }
  return parts.join(", ");
}

export function firstHttpPort(container: Container): number | undefined {
  const tcp = (container.Ports ?? []).filter((p) => !p.protocol || p.protocol === "tcp");
  const preferred = tcp.find((p) =>
    [80, 443, 3000, 4200, 5173, 8000, 8080, 8443, 8888, 9000].includes(p.container_port),
  );
  return (preferred ?? tcp[0])?.host_port;
}

export function codeBlock(text: string, lang = ""): string {
  const safe = text.replace(/```/g, "` ` `");
  return `\`\`\`${lang}\n${safe}\n\`\`\``;
}
