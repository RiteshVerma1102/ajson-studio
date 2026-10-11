# ADR-002: AI Provider Abstraction and Credential Security

## Status
Accepted

## Context
Ajson Studio requires AI-assisted coding capabilities that work seamlessly with multiple LLM services (Anthropic Claude, OpenAI, Google Gemini, and local Ollama instances). Embedding provider-specific network protocols directly into UI components introduces severe architectural liabilities:
1. Leaks vendor-specific models, headers, and payload structures throughout React components.
2. Increases vulnerability surface if API keys or session tokens are stored in unencrypted browser storage (`localStorage` or plaintext config files).
3. Makes error handling, stream cancellation, and network retry logic fragile and fragmented.
4. Prevents automated context-level privacy enforcement (such as preventing `.env` or credential leakage to external third-party APIs).

## Options Considered

### Option 1: Direct Renderer-Side Fetch Calls
- **Pros**: Quick to implement; handles fetch natively in Chromium.
- **Cons**: Exposes raw API keys inside the renderer process; violates Electron security best practices (`contextIsolation: true`); subject to CORS issues on local Ollama or certain cloud providers; risks leaking secrets into DOM inspection or renderer crashes.

### Option 2: Main-Process Service with Plaintext File Persistence
- **Pros**: Consolidates network calls in Electron's Node.js environment.
- **Cons**: Persisting keys to `.json` files on the filesystem creates security vulnerabilities where malware or unintended tools could read API keys; provides zero cryptographic protection at rest.

### Option 3: Provider-Independent IPC Gateway with OS-Level Encryption (Selected)
- **Pros**:
  - React components only interact with a unified contract (`AiCompletionRequest`, `AiCompletionResponse`).
  - Provider adapters (Anthropic, OpenAI, Gemini, Ollama) encapsulate payload format translation and response unpacking in Node.js.
  - API keys are protected at rest via Electron's `safeStorage` (Windows DPAPI, macOS Keychain, Linux Secret Service).
  - Centralized privacy gate automatically inspects outbound context and blocks sensitive files (`.env*`, private keys).
  - Centralized `AbortController` cancellation registry cleanly manages socket closures upon user cancellation.
- **Cons**: Requires IPC serialization across the context bridge.

## Decision
We adopted **Option 3**:
1. All AI operations are encapsulated behind the `window.ajsonAPI.ai` bridge.
2. In the Electron main process, `aiHandlers.ts` routes requests to provider-specific dispatcher functions.
3. API credentials are encrypted with `safeStorage.encryptString()` and stored in binary memory, falling back to an in-memory session map if running in unbundled test environments.
4. Outbound context fragments pass through privacy filtering that forbids files matching sensitive patterns (`.env`, `*.pem`, `id_rsa`, `*secret*`, `*token*`).
5. In-flight requests are assigned a unique `requestId` tracked in a cancellation registry, allowing the UI to abort requests immediately.

## Consequences

### Positive
- Strict security boundary: Renderer never sees raw cryptographic keys or file credentials at rest.
- Easy extensibility: Adding future providers (e.g. DeepSeek, Mistral, Azure OpenAI) only requires a single adapter file without changing any UI components.
- Complete cancellation and timeout reliability.
- Privacy compliance: Outbound project context is inspectable and modifiable by the developer prior to network transmission.

### Negative
- Payload size must fit within IPC message limits (enforced with a 128 KB safeguard limit).
