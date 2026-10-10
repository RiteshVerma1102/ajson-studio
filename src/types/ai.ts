/**
 * Ajson Studio - AI Core Architectural Interfaces
 * 
 * Foundation scaffold for future AI-native agentic development capabilities:
 * Requirement -> Plan -> Code -> Understand -> Test -> Debug -> Security -> Browser Test -> Deploy
 */

export type AIProviderId = 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom'

export interface ModelConfig {
  id: string
  name: string
  provider: AIProviderId
  contextWindow: number
  supportsStreaming: boolean
  supportsToolCalling: boolean
  supportsVision: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  toolCalls?: ToolCall[]
  toolResultId?: string
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ToolResult {
  toolCallId: string
  name: string
  output: string
  error?: string
}

/**
 * AI Provider Interface
 * Abstraction layer for multi-provider support (OpenAI, Anthropic, Google Gemini, local Ollama)
 */
export interface AIProvider {
  id: AIProviderId
  displayName: string
  isConfigured: boolean
  getAvailableModels(): Promise<ModelConfig[]>
  sendMessage(
    messages: ChatMessage[],
    options?: {
      modelId?: string
      temperature?: number
      tools?: Tool[]
      signal?: AbortSignal
    }
  ): Promise<ChatMessage>
  streamMessage?(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    options?: {
      modelId?: string
      temperature?: number
      tools?: Tool[]
      signal?: AbortSignal
    }
  ): Promise<ChatMessage>
}

/**
 * Project Context Interface
 * Aggregates workspace state, AST, file indexes, and active editor context for AI reasoning
 */
export interface ProjectContext {
  workspaceRoot: string
  openFiles: string[]
  activeFile: {
    path: string
    language: string
    content: string
    selection?: {
      startLine: number
      startCol: number
      endLine: number
      endCol: number
      selectedText: string
    }
  } | null
  gitStatus?: {
    branch: string
    modifiedFiles: string[]
    stagedFiles: string[]
  }
  diagnostics?: Array<{
    filePath: string
    line: number
    message: string
    severity: 'error' | 'warning' | 'info'
  }>
  getFileContent(filePath: string): Promise<string>
  searchFiles(query: string): Promise<string[]>
}

/**
 * Agent Roles & Lifecycle
 * Coordinates multi-agent collaboration (Requirement -> Plan -> Code -> Review -> Test -> Deploy)
 */
export type AgentRole =
  | 'architect'    // Plans architecture & breaks down tasks
  | 'developer'    // Writes code & refactors
  | 'debugger'     // Analyzes errors & diagnoses bugs
  | 'reviewer'     // Code review & security inspection
  | 'qa_tester'    // Unit tests & browser testing

export interface Agent {
  id: string
  name: string
  role: AgentRole
  description: string
  assignedTools: Tool[]
  executeTask(task: string, context: ProjectContext): Promise<AgentTaskResult>
  cancelTask?(taskId: string): Promise<void>
}

export interface AgentTaskResult {
  taskId: string
  success: boolean
  summary: string
  modifiedFiles?: Array<{ path: string; diff: string }>
  proposedCommands?: string[]
}

/**
 * Tool Definition Schema
 * Executable capabilities available to Agents (File Read/Write, Terminal, Search, Linter, Browser)
 */
export interface ToolParameterSchema {
  type: 'object'
  properties: Record<string, {
    type: string
    description: string
    enum?: string[]
  }>
  required: string[]
}

export interface Tool {
  name: string
  description: string
  parameters: ToolParameterSchema
  execute(params: Record<string, unknown>, context: ProjectContext): Promise<unknown>
}

/**
 * Command Execution Interface
 * Secure, sandboxed shell and CLI execution with streaming I/O
 */
export interface CommandExecution {
  id: string
  command: string
  args?: string[]
  cwd: string
  isSandboxed: boolean
  timeoutMs?: number
  run(): Promise<CommandExecutionResult>
  onStdout?(callback: (chunk: string) => void): void
  onStderr?(callback: (chunk: string) => void): void
  kill?(): void
}

export interface CommandExecutionResult {
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
}
