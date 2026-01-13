# OpenCast

OpenCast is a Raycast extension that allows you to interact with [OpenCode](https://opencode.ai/). It provides an interface to ask questions and manage your conversations directly from Raycast.

<img width="938" height="594" alt="image" src="https://github.com/user-attachments/assets/85d1f9a3-cd51-4c3c-938a-11c541f29069" />

## Prerequisites

You must have the OpenCode CLI installed and the server running.

1.  **Install OpenCode**:
    ```bash
    curl -fsSL https://opencode.ai/install | bash
    ```
2.  **Start the Server**:
    OpenCast communicates with OpenCode via its HTTP server. Start it by running:
    ```bash
    opencode serve
    ```
> [!NOTE]
> By default, the server runs on `http://127.0.0.1:4096`.

> [!CAUTION]
> It is recommended to set up `OPENCODE_SERVER_PASSWORD` for security

## Installation

1.  Ensure you have [Raycast](https://www.raycast.com/) installed.
2.  Import this extension into your Raycast environment.

### Configuration

You can configure the extension via Raycast Preferences:

- **OpenCode Server Host**: Defaults to `127.0.0.1`.
- **OpenCode Server Port**: Defaults to `4096`.
- **OpenCode Server Password**: If you have set the `OPENCODE_SERVER_PASSWORD` environment variable for your server, enter it here.

## Commands

### 1. Ask OpenCode

Send a prompt to OpenCode and get an instant response.

- Creates a new session for every initial request.
- Supports conversation continuity within the same window.
- Markdown support for code snippets and rich text.

### 2. List OpenCode Sessions

Browse your recent OpenCode history and resume existing conversations.

- View a list of all active sessions sorted by last update.
- Open any session to see the full message history.
- Continue existing conversations or delete old sessions.

## 📄 License

This project is licensed under the MIT License.
