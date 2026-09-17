# Podman for Raycast

Manage [Podman](https://podman.io) from Raycast: containers, images, pods, volumes and machines, plus a menu bar status item.

## Commands

| Command | What it does |
| --- | --- |
| Manage Containers | Start, stop, restart, pause, kill and remove containers. View logs, inspect, open a shell in your terminal, open published ports in the browser. |
| Manage Images | Pull, remove and prune images. Run a container from an image through a small form. |
| Manage Pods | Start, stop, restart, kill, inspect and remove pods. |
| Manage Volumes | Inspect, remove and prune volumes. |
| Manage Machines | Start, stop, restart, SSH into, set default and remove Podman machines. |
| Podman Status | Menu bar item showing the running container count with quick stop, restart, logs and shell actions. |

## Preferences

- **Podman Binary**: path to `podman`. Auto-detects Homebrew (`/opt/homebrew/bin`), `/usr/local/bin` and the podman.io installer (`/opt/podman/bin`).
- **Terminal**: Terminal.app or iTerm2, used for interactive shells, `podman machine ssh` and `podman logs --follow`.
- **Log Lines**: how many lines the log viewer loads (default 200). Load more with ⌘L.

## Development

```sh
npm install
npm run dev
```

`npm run dev` imports the extension into Raycast and hot-reloads on changes. `npm run lint` runs the Raycast lint (ESLint + Prettier), `npm run build` produces a production build.

## Requirements

- macOS with Raycast
- Podman 4 or newer with a machine created (`podman machine init`)

## Icon

`assets/podman-icon.svg` is the source. Render it to PNG with transparent corners using:

```sh
swift scripts/render-icon.swift assets/podman-icon.svg assets/podman-icon.png
```

Do not use `qlmanage` for this, it fills transparent areas with opaque white.
