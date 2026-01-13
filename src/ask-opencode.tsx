import { Action, ActionPanel, Detail, Form, Icon, showToast, Toast, useNavigation } from "@raycast/api";
import { useState, useEffect } from "react";
import { api, extractTextFromParts, Message, Session } from "./api";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

function ConversationView({
  session,
  conversation,
  onSendMessage,
}: {
  session: Session;
  conversation: ConversationMessage[];
  onSendMessage: (prompt: string) => Promise<void>;
}) {
  const { push } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);

  function buildMarkdown(): string {
    if (conversation.length === 0) {
      return "*Waiting for response...*";
    }

    return conversation
      .map((msg) => {
        const role = msg.role === "user" ? "**You**" : "**OpenCode**";
        return `### ${role}\n\n${msg.content}`;
      })
      .join("\n\n---\n\n");
  }

  async function handleContinue() {
    push(<ContinueConversation session={session} conversation={conversation} onSendMessage={onSendMessage} />);
  }

  return (
    <Detail
      isLoading={isLoading}
      markdown={buildMarkdown()}
      navigationTitle={session.title || "Conversation"}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Session" text={session.title || session.id.slice(0, 12)} />
          <Detail.Metadata.Label title="Messages" text={String(conversation.length)} />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action title="Continue Conversation" icon={Icon.Message} onAction={handleContinue} />
          <Action.CopyToClipboard
            title="Copy Last Response"
            content={conversation.filter((m) => m.role === "assistant").pop()?.content || ""}
          />
          <Action.CopyToClipboard title="Copy Session ID" content={session.id} />
        </ActionPanel>
      }
    />
  );
}

function ContinueConversation({
  session,
  conversation,
  onSendMessage,
}: {
  session: Session;
  conversation: ConversationMessage[];
  onSendMessage: (prompt: string) => Promise<void>;
}) {
  const { pop } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(values: { prompt: string }) {
    if (!values.prompt.trim()) {
      await showToast({ style: Toast.Style.Failure, title: "Please enter a message" });
      return;
    }

    setIsLoading(true);
    try {
      await onSendMessage(values.prompt);
      pop();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await showToast({ style: Toast.Style.Failure, title: "Failed to send message", message });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      navigationTitle="Continue Conversation"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Send Message" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description title="Session" text={session.title || session.id.slice(0, 20)} />
      <Form.Description title="Messages" text={`${conversation.length} messages so far`} />
      <Form.TextArea id="prompt" title="Message" placeholder="Continue the conversation..." autoFocus enableMarkdown />
    </Form>
  );
}

export default function AskOpenCode() {
  const { push } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [isServerOnline, setIsServerOnline] = useState<boolean | null>(null);
  const [serverVersion, setServerVersion] = useState<string>("");
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);

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

  async function sendMessage(prompt: string): Promise<void> {
    if (!currentSession) {
      throw new Error("No active session");
    }

    setConversation((prev) => [...prev, { role: "user", content: prompt }]);

    await showToast({ style: Toast.Style.Animated, title: "Sending to OpenCode..." });

    const response = await api.sendMessage(currentSession.id, prompt);
    const responseText = extractTextFromParts(response.parts);

    setConversation((prev) => [...prev, { role: "assistant", content: responseText || "No response" }]);

    await showToast({ style: Toast.Style.Success, title: "Response received" });
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

      await showToast({ style: Toast.Style.Animated, title: "Creating session..." });

      const session = await api.createSession(`Raycast: ${values.prompt.slice(0, 50)}`);
      setCurrentSession(session);

      const userMessage: ConversationMessage = { role: "user", content: values.prompt };
      setConversation([userMessage]);

      await showToast({ style: Toast.Style.Animated, title: "Sending to OpenCode..." });

      const response = await api.sendMessage(session.id, values.prompt);
      const responseText = extractTextFromParts(response.parts);

      const assistantMessage: ConversationMessage = {
        role: "assistant",
        content: responseText || "No response received",
      };
      setConversation([userMessage, assistantMessage]);

      await showToast({ style: Toast.Style.Success, title: "Response received" });

      push(
        <ConversationView
          session={session}
          conversation={[userMessage, assistantMessage]}
          onSendMessage={async (prompt) => {
            await sendMessage(prompt);
          }}
        />,
      );
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
        text="This will create a new session. Use 'Browse Sessions' to continue existing conversations."
      />
    </Form>
  );
}
