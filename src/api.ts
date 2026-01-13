import { getPreferenceValues } from "@raycast/api";

interface Preferences {
  serverHost: string;
  serverPort: string;
}

export interface Session {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  share?: string;
  parentID?: string;
}

export interface MessagePart {
  type: string;
  content?: string;
  text?: string;
  [key: string]: unknown;
}

export interface MessageInfo {
  id: string;
  sessionID: string;
  role: "user" | "assistant";
  createdAt: string;
}

export interface Message {
  info: MessageInfo;
  parts: MessagePart[];
}

export interface HealthResponse {
  healthy: boolean;
  version: string;
}

class OpenCodeAPI {
  private getBaseUrl(): string {
    const prefs = getPreferenceValues<Preferences>();
    const host = prefs.serverHost || "127.0.0.1";
    const port = prefs.serverPort || "4096";
    return `http://${host}:${port}`;
  }

  async checkHealth(): Promise<HealthResponse> {
    const response = await fetch(`${this.getBaseUrl()}/global/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return response.json() as Promise<HealthResponse>;
  }

  async listSessions(): Promise<Session[]> {
    const response = await fetch(`${this.getBaseUrl()}/session`);
    if (!response.ok) {
      throw new Error(`Failed to list sessions: ${response.statusText}`);
    }
    return response.json() as Promise<Session[]>;
  }

  async createSession(title?: string): Promise<Session> {
    const response = await fetch(`${this.getBaseUrl()}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }
    return response.json() as Promise<Session>;
  }

  async getSession(sessionId: string): Promise<Session> {
    const response = await fetch(`${this.getBaseUrl()}/session/${sessionId}`);
    if (!response.ok) {
      throw new Error(`Failed to get session: ${response.statusText}`);
    }
    return response.json() as Promise<Session>;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const response = await fetch(`${this.getBaseUrl()}/session/${sessionId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`Failed to delete session: ${response.statusText}`);
    }
    return response.json() as Promise<boolean>;
  }

  async sendMessage(sessionId: string, prompt: string): Promise<Message> {
    const response = await fetch(`${this.getBaseUrl()}/session/${sessionId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parts: [{ type: "text", text: prompt }],
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }
    return response.json() as Promise<Message>;
  }

  async getMessages(sessionId: string, limit?: number): Promise<Message[]> {
    const url = new URL(`${this.getBaseUrl()}/session/${sessionId}/message`);
    if (limit) {
      url.searchParams.set("limit", limit.toString());
    }
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to get messages: ${response.statusText}`);
    }
    return response.json() as Promise<Message[]>;
  }

  async abortSession(sessionId: string): Promise<boolean> {
    const response = await fetch(`${this.getBaseUrl()}/session/${sessionId}/abort`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Failed to abort session: ${response.statusText}`);
    }
    return response.json() as Promise<boolean>;
  }
}

export const api = new OpenCodeAPI();

export function extractTextFromParts(parts: MessagePart[]): string {
  return parts
    .map((part) => {
      if (part.type === "text") {
        return part.text || part.content || "";
      }
      if (part.type === "tool-invocation" || part.type === "tool-result") {
        return "";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}
