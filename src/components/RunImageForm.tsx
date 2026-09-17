import { Action, ActionPanel, Form, Icon, Toast, popToRoot, showToast } from "@raycast/api";
import { useForm } from "@raycast/utils";
import { podman } from "../lib/podman";
import { errorMessage } from "../lib/run";
import { openInTerminal } from "../lib/terminal";

interface Props {
  image: string;
}

interface Values {
  name: string;
  ports: string;
  env: string;
  volumes: string;
  command: string;
  detach: boolean;
  rm: boolean;
  interactive: boolean;
}

function splitLines(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function RunImageForm({ image }: Props) {
  const { handleSubmit, itemProps } = useForm<Values>({
    initialValues: {
      detach: true,
      rm: false,
      interactive: false,
      name: "",
      ports: "",
      env: "",
      volumes: "",
      command: "",
    },
    validation: {
      name: (value) => (value && !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(value) ? "Invalid container name" : undefined),
      ports: (value) =>
        splitLines(value ?? "").some((p) => !/^(\d{1,5}|[\d.]+:\d{1,5}):\d{1,5}(\/(tcp|udp))?$/.test(p))
          ? "Use host:container, one per line (e.g. 8080:80)"
          : undefined,
    },
    async onSubmit(values) {
      const args = ["run"];
      if (values.detach) args.push("--detach");
      if (values.rm) args.push("--rm");
      if (values.interactive) args.push("--interactive", "--tty");
      if (values.name) args.push("--name", values.name);
      for (const p of splitLines(values.ports)) args.push("--publish", p);
      for (const e of splitLines(values.env)) args.push("--env", e);
      for (const v of splitLines(values.volumes)) args.push("--volume", v);
      args.push(image);
      if (values.command.trim()) args.push(...values.command.trim().split(/\s+/));

      if (values.interactive) {
        // A TTY needs a real terminal, so hand the command over instead of running it here.
        await openInTerminal(args);
        await popToRoot();
        return;
      }

      const toast = await showToast({ style: Toast.Style.Animated, title: `Starting ${image}` });
      try {
        const out = await podman(args, { timeout: 5 * 60_000 });
        toast.style = Toast.Style.Success;
        toast.title = "Container started";
        toast.message = out.trim().slice(0, 12);
        await popToRoot();
      } catch (error) {
        toast.style = Toast.Style.Failure;
        toast.title = "podman run failed";
        toast.message = errorMessage(error);
      }
    },
  });

  return (
    <Form
      navigationTitle={`Run ${image}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Run Container" icon={Icon.Play} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description title="Image" text={image} />
      <Form.TextField title="Name" placeholder="my-container (optional)" {...itemProps.name} />
      <Form.TextArea
        title="Ports"
        placeholder={"8080:80\n5432:5432"}
        info="host:container, one per line"
        {...itemProps.ports}
      />
      <Form.TextArea title="Environment" placeholder={"KEY=value"} info="One KEY=value per line" {...itemProps.env} />
      <Form.TextArea
        title="Volumes"
        placeholder={"/host/path:/container/path"}
        info="One mount per line"
        {...itemProps.volumes}
      />
      <Form.TextField title="Command" placeholder="Override the image command (optional)" {...itemProps.command} />
      <Form.Separator />
      <Form.Checkbox label="Detach (run in background)" {...itemProps.detach} />
      <Form.Checkbox label="Remove container on exit (--rm)" {...itemProps.rm} />
      <Form.Checkbox label="Interactive TTY (-it), opens in your terminal" {...itemProps.interactive} />
    </Form>
  );
}
