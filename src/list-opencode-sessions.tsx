import { Action, ActionPanel, Detail, Form, Icon, List, showToast, Toast, useNavigation } from "@raycast/api";
import { useState, useEffect } from "react";
import { api, extractTextFromParts, Session, Message } from "./api";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SessionDetail({ session }: { session: Session }) {
  const { push } = useNavigation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMessages();
  }, [session.id]);

  async function loadMessages() {
    setIsLoading(true);
    try {
      const msgs = await api.getMessages(session.id);
      setMessages(msgs);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await showToast({ style: Toast.Style.Failure, title: "Failed to load messages", message });
    } finally {
      setIsLoading(false);
    }
  }

  function buildMarkdown(): string {
    if (messages.length === 0) {
      return "*No messages in this session*";
    }

    return messages
      .map((msg) => {
        const role = msg.info.role === "user" ? "**You**" : "**OpenCode**";
        const content = extractTextFromParts(msg.parts);
        return `### ${role}\n\n${content}`;
      })
      .join("\n\n---\n\n");
  }

  return (
    <Detail
      isLoading={isLoading}
      markdown={buildMarkdown()}
      navigationTitle={session.title || "Session"}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Session ID" text={session.id} />
          <Detail.Metadata.Label title="Created" text={formatDate(session.createdAt)} />
          <Detail.Metadata.Label title="Updated" text={formatDate(session.updatedAt)} />
          {session.share && <Detail.Metadata.Link title="Share Link" target={session.share} text="Open" />}
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action
            title="Continue Conversation"
            icon={Icon.Message}
            onAction={() => push(<ContinueSession session={session} messages={messages} onNewMessage={loadMessages} />)}
          />
          <Action.CopyToClipboard title="Copy Session ID" content={session.id} />
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            onAction={loadMessages}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
          />
          <Action
            title="Delete Session"
            icon={Icon.Trash}
            style={Action.Style.Destructive}
            shortcut={{ modifiers: ["cmd"], key: "backspace" }}
            onAction={async () => {
              try {
                await api.deleteSession(session.id);
                await showToast({ style: Toast.Style.Success, title: "Session deleted" });
              } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                await showToast({ style: Toast.Style.Failure, title: "Failed to delete", message });
              }
            }}
          />
        </ActionPanel>
      }
    />
  );
}

function ContinueSession({
  session,
  messages,
  onNewMessage,
}: {
  session: Session;
  messages: Message[];
  onNewMessage: () => void;
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
      await showToast({ style: Toast.Style.Animated, title: "Sending message..." });
      await api.sendMessage(session.id, values.prompt);
      await showToast({ style: Toast.Style.Success, title: "Message sent" });
      onNewMessage();
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
      <Form.Description title="Session" text={session.title || session.id} />
      <Form.Description title="Messages" text={`${messages.length} messages in conversation`} />
      <Form.TextArea id="prompt" title="Message" placeholder="Continue the conversation..." autoFocus />
    </Form>
  );
}

export default function BrowseSessions() {
  const { push } = useNavigation();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isServerOnline, setIsServerOnline] = useState<boolean | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    setIsLoading(true);
    try {
      await api.checkHealth();
      setIsServerOnline(true);
      const sessionList = await api.listSessions();
      const sorted = sessionList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setSessions(sorted);
    } catch (error) {
      setIsServerOnline(false);
      const message = error instanceof Error ? error.message : "Unknown error";
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to load sessions",
        message: message.includes("ECONNREFUSED")
          ? "OpenCode server not running. Run `opencode serve` first."
          : message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (isServerOnline === false) {
    return (
      <Detail
        markdown={`# OpenCode Server Offline

The OpenCode server is not running.

Start it with:
\`\`\`bash
opencode serve
\`\`\`

Then try again.`}
        actions={
          <ActionPanel>
            <Action title="Retry" icon={Icon.ArrowClockwise} onAction={loadSessions} />
            <Action.OpenInBrowser title="OpenCode Docs" url="https://opencode.ai/docs/server/" />
          </ActionPanel>
        }
      />
    );
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search sessions...">
      {sessions.length === 0 && !isLoading ? (
        <List.EmptyView
          title="No Sessions Found"
          description="Start a new conversation with 'Ask OpenCode'"
          icon={Icon.Message}
        />
      ) : (
        sessions.map((session) => (
          <List.Item
            key={session.id}
            title={session.title || "Untitled Session"}
            subtitle={session.id.slice(0, 12)}
            accessories={[{ text: formatDate(session.updatedAt), icon: Icon.Clock }]}
            actions={
              <ActionPanel>
                <Action
                  title="Open Session"
                  icon={Icon.Eye}
                  onAction={() => push(<SessionDetail session={session} />)}
                />
                <Action.CopyToClipboard title="Copy Session ID" content={session.id} />
                <Action
                  title="Refresh"
                  icon={Icon.ArrowClockwise}
                  onAction={loadSessions}
                  shortcut={{ modifiers: ["cmd"], key: "r" }}
                />
                <Action
                  title="Delete Session"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  shortcut={{ modifiers: ["cmd"], key: "backspace" }}
                  onAction={async () => {
                    try {
                      await api.deleteSession(session.id);
                      await showToast({ style: Toast.Style.Success, title: "Session deleted" });
                      loadSessions();
                    } catch (error) {
                      const message = error instanceof Error ? error.message : "Unknown error";
                      await showToast({ style: Toast.Style.Failure, title: "Failed to delete", message });
                    }
                  }}
                />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
