export interface Container {
  Id: string;
  Names: string[];
  Image: string;
  ImageID: string;
  Command: string[] | null;
  Created: number;
  CreatedAt: string;
  StartedAt: number;
  ExitedAt: number;
  Exited: boolean;
  ExitCode: number;
  State: "running" | "exited" | "created" | "paused" | "stopping" | "unknown" | string;
  Status: string;
  Pod: string;
  PodName: string;
  IsInfra: boolean;
  AutoRemove: boolean;
  Labels: Record<string, string> | null;
  Networks: string[] | null;
  Mounts: string[] | null;
  Ports: PortMapping[] | null;
}

export interface PortMapping {
  host_ip: string;
  host_port: number;
  container_port: number;
  protocol: string;
  range: number;
}

export interface Image {
  Id: string;
  Names: string[] | null;
  RepoTags: string[] | null;
  RepoDigests: string[] | null;
  Digest: string;
  Size: number;
  Containers: number;
  Created: number;
  CreatedAt: string;
  Arch: string;
  Os: string;
  Dangling?: boolean;
}

export interface Pod {
  Id: string;
  Name: string;
  Status: string;
  Created: string;
  InfraId: string;
  Labels: Record<string, string> | null;
  Networks: string[] | null;
  Containers: { Id: string; Names: string; Status: string }[] | null;
}

export interface Volume {
  Name: string;
  Driver: string;
  Mountpoint: string;
  CreatedAt: string;
  Scope: string;
  Labels: Record<string, string> | null;
  MountCount: number;
}

export interface Machine {
  Name: string;
  Default: boolean;
  Created: string;
  Running: boolean;
  Starting: boolean;
  LastUp: string;
  VMType: string;
  CPUs: number;
  Memory: string;
  DiskSize: string;
  Port: number;
  RemoteUsername: string;
  IdentityPath: string;
}
