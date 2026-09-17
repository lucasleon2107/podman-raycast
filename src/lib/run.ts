import { Alert, Toast, confirmAlert, showToast } from "@raycast/api";
import { PodmanError } from "./podman";

interface RunOptions {
  loading: string;
  success: string;
  onDone?: () => void | Promise<void>;
}

/**
 * Run a podman action with an animated toast and friendly error reporting.
 * Resolves to true when the action succeeded.
 */
export async function runAction(action: () => Promise<unknown>, options: RunOptions): Promise<boolean> {
  const toast = await showToast({ style: Toast.Style.Animated, title: options.loading });
  try {
    await action();
    toast.style = Toast.Style.Success;
    toast.title = options.success;
    await options.onDone?.();
    return true;
  } catch (error) {
    toast.style = Toast.Style.Failure;
    toast.title = "Podman command failed";
    toast.message = errorMessage(error);
    await options.onDone?.();
    return false;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof PodmanError) {
    if (error.isMachineDown) return "Podman machine is not running. Start it with the Manage Machines command.";
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function confirmDestructive(title: string, message: string, actionTitle = "Remove"): Promise<boolean> {
  return confirmAlert({
    title,
    message,
    primaryAction: { title: actionTitle, style: Alert.ActionStyle.Destructive },
  });
}
