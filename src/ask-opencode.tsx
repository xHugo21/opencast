import { Action, ActionPanel, Detail, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { useState, useEffect } from "react";
import { api, extractTextFromParts } from "./api";

function ResponseView({ response, sessionId }: { response: string; sessionId: string }) {
  const { pop } = useNavigation();

  return (
    <Detail
      markdown={response}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Response" content={response} />
          <Action title="Ask Another Question" onAction={pop} />
          <Action.OpenInBrowser title="Open OpenCode Docs" url="https://opencode.ai/docs" />
        </ActionPanel>
      }
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Session ID" text={sessionId} />
        </Detail.Metadata>
      }
    />
  );
}

export default function AskOpenCode() {
  const { push } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [isServerOnline, setIsServerOnline] = useState<boolean | null>(null);
  const [serverVersion, setServerVersion] = useState<string>("");

  useEffect(() => {
    checkServer();
  }, []);

  async function checkServer() {
    try {
      const health = await api.checkHealth();
      setIsServerOnline(health.healthy);
      setServerVersion(health.version);
    } catch {
      setIsServerOnline(false);
    }
  }

  async function handleSubmit(values: { prompt: string }) {
    if (!values.prompt.trim()) {
      await showToast({ style: Toast.Style.Failure, title: "Please enter a prompt" });
      return;
    }

    setIsLoading(true);

    try {
      const health = await api.checkHealth();
      if (!health.healthy) {
        throw new Error("OpenCode server is not healthy");
      }

      await showToast({ style: Toast.Style.Animated, title: "Sending to OpenCode..." });

      const session = await api.createSession(`Raycast: ${values.prompt.slice(0, 50)}`);
      const response = await api.sendMessage(session.id, values.prompt);

      const responseText = extractTextFromParts(response.parts);

      await showToast({ style: Toast.Style.Success, title: "Response received" });

      push(<ResponseView response={responseText || "No response received"} sessionId={session.id} />);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to get response",
        message: message.includes("ECONNREFUSED")
          ? "OpenCode server not running. Run `opencode serve` first."
          : message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  const serverStatusText =
    isServerOnline === null
      ? "Checking server..."
      : isServerOnline
        ? `Connected (v${serverVersion})`
        : "Server offline - run `opencode serve`";

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Ask OpenCode" onSubmit={handleSubmit} />
          <Action title="Refresh Server Status" onAction={checkServer} shortcut={{ modifiers: ["cmd"], key: "r" }} />
        </ActionPanel>
      }
    >
      <Form.Description title="OpenCode Status" text={serverStatusText} />
      <Form.TextArea
        id="prompt"
        title="Prompt"
        placeholder="Ask OpenCode anything about coding..."
        enableMarkdown
        autoFocus
      />
      <Form.Description
        title="Tips"
        text="OpenCode is an AI coding agent. Ask it to explain code, add features, fix bugs, or answer programming questions."
      />
    </Form>
  );
}
