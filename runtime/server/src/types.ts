export type SandtablePhase =
  | "INTAKE"
  | "RECON"
  | "OBJECTIVES"
  | "TESTCASES"
  | "PLAN"
  | "MENTAL_REHEARSAL"
  | "REDTEAM"
  | "IMPL_REHEARSAL"
  | "EVALUATE"
  | "INTEGRATE"
  | "VERIFY"
  | "DONE"
  | "FEEDBACK";

export type MessageSource = "agent" | "mobile" | "server";
export type MessageType =
  | "phase_update"
  | "document_snapshot"
  | "question_answer"
  | "confirmation"
  | "chat_message"
  | "mobile_paired"
  | "stop";

export interface MailboxMessage<T = unknown> {
  id: string;
  feature: string;
  sessionId?: string;
  agent?: AgentIdentity;
  source: MessageSource;
  type: MessageType;
  createdAt: string;
  payload: T;
}

export interface RuntimePaths {
  repoRoot: string;
  sandtableRoot: string;
  runtimeRoot: string;
  inbox: string;
  processed: string;
  outbox: string;
  cursors: string;
  session: string;
  conversations: string;
}

export type SandtableDocumentName = "state" | "prd" | "tests" | "plan" | "journal" | "questions";

export type AgentKind = "codex" | "cursor" | "claude-code" | "gemini" | "custom";

export interface AgentIdentity {
  id: string;
  kind: AgentKind;
  name: string;
}

export type RuntimeSessionStatus = "active" | "idle" | "blocked" | "done" | "stopped";

/**
 * Live runtime state of the agent pipeline behind a mobile-synced feature,
 * surfaced to the phone so the developer can see what the computer side is doing.
 * - `main`   : the orchestrating (main) agent.
 * - `waiter` : the single-job inbox waiting sub-agent.
 */
export type AgentRole = "main" | "waiter";
export type AgentRunState =
  // main agent
  | "idle"
  | "working"
  | "disconnected"
  | "error"
  // waiting sub-agent
  | "ready"
  | "waiting"
  | "processing"
  | "exited";

export interface AgentRuntimeState {
  role: AgentRole;
  state: AgentRunState;
  detail?: string;
  at: string;
}

export interface RuntimeSession {
  id: string;
  title: string;
  feature: string;
  workspace: string;
  agent: AgentIdentity;
  status: RuntimeSessionStatus;
  phase?: string;
  blocked: boolean;
  paired: boolean;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  summary?: string;
}

export interface RuntimeSessionInput {
  id?: string;
  title?: string;
  feature: string;
  workspace?: string;
  agent?: Partial<AgentIdentity>;
  phase?: string;
  blocked?: boolean;
  summary?: string;
  status?: RuntimeSessionStatus;
}

/**
 * Who authored a conversation message.
 * - `agent`  : a coding agent (Codex/Cursor/Claude Code/...).
 * - `mobile` : the developer using the phone app.
 * - `system` : runtime-generated notices (pairing, stop, phase changes).
 */
export type ConversationRole = "agent" | "mobile" | "system";

/**
 * Semantic kind of a conversation message. UI clients use this to decide how
 * to render a bubble (plain chat vs. a phase banner vs. a question, etc.).
 */
export type ConversationKind =
  | "chat"
  | "phase"
  | "question"
  | "answer"
  | "confirmation"
  | "document"
  | "status"
  | "paired"
  | "stop";

/**
 * A single durable entry in a session conversation. Conversations are the
 * mobile-facing transcript; they are persisted per session so history survives
 * server restarts. Durable Sandtable decisions still live in feature docs.
 */
export interface ConversationMessage {
  id: string;
  sessionId: string;
  feature: string;
  role: ConversationRole;
  kind: ConversationKind;
  text: string;
  payload?: Record<string, unknown>;
  agent?: AgentIdentity;
  createdAt: string;
}

/**
 * Structured envelope broadcast over the `/stream` SSE endpoint. Clients keep a
 * single subscription and route by `kind`.
 */
export type RuntimeBroadcast =
  | { kind: "session"; session: RuntimeSession }
  | { kind: "session_removed"; sessionId: string }
  | { kind: "message"; message: ConversationMessage }
  | { kind: "agent_state"; feature: string; agent: AgentRuntimeState };
