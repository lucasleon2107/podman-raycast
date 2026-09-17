import { Action, ActionPanel, Color, Icon, Keyboard, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { InspectDetail } from "./components/InspectDetail";
import { RunImageForm } from "./components/RunImageForm";
import { formatBytes, relativeTime, shortId, shortImage } from "./lib/format";
import { imageName, listImages, pruneImages, pullImage, removeImage } from "./lib/podman";
import { confirmDestructive, errorMessage, runAction } from "./lib/run";
import { podmanCommandString } from "./lib/terminal";
import type { Image } from "./lib/types";

export default function Command() {
  const { data, isLoading, error, revalidate } = useCachedPromise(listImages, [], { keepPreviousData: true });
  const images = [...(data ?? [])].sort((a, b) => b.Created - a.Created);
  const totalSize = images.reduce((sum, i) => sum + (i.Size ?? 0), 0);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search images by name, tag or ID">
      {error && (
        <List.EmptyView
          icon={{ source: Icon.Warning, tintColor: Color.Red }}
          title="Could not list images"
          description={errorMessage(error)}
          actions={
            <ActionPanel>
              <Action title="Retry" icon={Icon.ArrowClockwise} onAction={revalidate} />
            </ActionPanel>
          }
        />
      )}
      {!error && images.length === 0 && <List.EmptyView icon={Icon.HardDrive} title="No images" />}
      <List.Section
        title="Images"
        subtitle={images.length ? `${images.length} · ${formatBytes(totalSize)}` : undefined}
      >
        {images.map((img) => (
          <ImageItem key={img.Id} image={img} revalidate={revalidate} />
        ))}
      </List.Section>
    </List>
  );
}

function ImageItem({ image: img, revalidate }: { image: Image; revalidate: () => void }) {
  const fullName = imageName(img);
  const name = shortImage(fullName);
  const dangling = fullName === "<none>";
  const extraTags = (img.Names ?? []).slice(1).map(shortImage);
  const pullRef = dangling ? undefined : fullName;

  const accessories: List.Item.Accessory[] = [];
  if (extraTags.length) accessories.push({ tag: `+${extraTags.length}`, tooltip: extraTags.join("\n") });
  if (img.Containers > 0)
    accessories.push({ icon: Icon.Box, text: String(img.Containers), tooltip: "Containers using this image" });
  accessories.push({ text: formatBytes(img.Size), tooltip: "Size" });
  accessories.push({ text: relativeTime(img.Created), tooltip: img.CreatedAt });

  return (
    <List.Item
      icon={dangling ? { source: Icon.QuestionMarkCircle, tintColor: Color.SecondaryText } : Icon.HardDrive}
      title={name}
      subtitle={`${shortId(img.Id)} · ${img.Arch}`}
      keywords={[shortId(img.Id), ...(img.Names ?? []), ...extraTags]}
      accessories={accessories}
      actions={
        <ActionPanel title={name}>
          <ActionPanel.Section>
            <Action.Push
              title="Run Container…"
              icon={Icon.Play}
              target={<RunImageForm image={dangling ? img.Id : fullName} />}
            />
            {pullRef && (
              <Action
                title="Pull Latest"
                icon={Icon.Download}
                shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
                onAction={() =>
                  runAction(() => pullImage(pullRef), {
                    loading: `Pulling ${name}`,
                    success: `${name} up to date`,
                    onDone: revalidate,
                  })
                }
              />
            )}
            <Action.Push
              title="Inspect"
              icon={Icon.MagnifyingGlass}
              shortcut={{ modifiers: ["cmd"], key: "i" }}
              target={<InspectDetail kind="image" id={img.Id} title={name} />}
            />
          </ActionPanel.Section>

          <ActionPanel.Section>
            <Action.CopyToClipboard title="Copy Name" content={fullName} shortcut={Keyboard.Shortcut.Common.Copy} />
            <Action.CopyToClipboard title="Copy ID" content={img.Id} shortcut={Keyboard.Shortcut.Common.Copy} />
            <Action.CopyToClipboard
              title="Copy Run Command"
              content={podmanCommandString(["run", "-it", "--rm", fullName])}
            />
          </ActionPanel.Section>

          <ActionPanel.Section>
            <Action
              title="Remove"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              shortcut={Keyboard.Shortcut.Common.Remove}
              onAction={async () => {
                const inUse = img.Containers > 0;
                const ok = await confirmDestructive(
                  `Remove ${name}?`,
                  inUse
                    ? `${img.Containers} container(s) use this image. Removal will be forced.`
                    : "This cannot be undone.",
                );
                if (ok)
                  await runAction(() => removeImage(img.Id, inUse), {
                    loading: `Removing ${name}`,
                    success: `${name} removed`,
                    onDone: revalidate,
                  });
              }}
            />
            <Action
              title="Prune Dangling Images"
              icon={Icon.Eraser}
              style={Action.Style.Destructive}
              onAction={async () => {
                const ok = await confirmDestructive(
                  "Prune dangling images?",
                  "Untagged images not used by any container are removed.",
                  "Prune",
                );
                if (ok)
                  await runAction(() => pruneImages(false), {
                    loading: "Pruning",
                    success: "Dangling images removed",
                    onDone: revalidate,
                  });
              }}
            />
            <Action
              title="Prune All Unused Images"
              icon={Icon.Eraser}
              style={Action.Style.Destructive}
              onAction={async () => {
                const ok = await confirmDestructive(
                  "Prune all unused images?",
                  "Every image not used by a container is removed.",
                  "Prune",
                );
                if (ok)
                  await runAction(() => pruneImages(true), {
                    loading: "Pruning",
                    success: "Unused images removed",
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
