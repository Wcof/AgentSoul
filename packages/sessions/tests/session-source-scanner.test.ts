import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSessionLauncher, createSessionSourceScanner } from "@agentsoul/sessions";
import { decideSafetyPolicy } from "@agentsoul/safety";

describe("Session Source scanning", () => {
  it("scans a local JSONL Session Source into searchable Work Sessions with evidence", () => {
    withSessionScanner((dbPath, dir) => {
      const sourcePath = join(dir, "history.jsonl");
      writeFileSync(
        sourcePath,
        [
          JSON.stringify({
            sessionId: "session-1",
            cwd: "/workspace/app",
            timestamp: "2026-05-28T12:00:00.000Z",
            message: "Please refactor the gateway route.",
          }),
          "not json",
          JSON.stringify({
            sessionId: "session-2",
            cwd: "/workspace/cli",
            timestamp: "2026-05-28T12:05:00.000Z",
            message: "Add tests for session search.",
          }),
        ].join("\n"),
        "utf8",
      );

      const scanner = createSessionSourceScanner({ dbPath });

      try {
        const result = scanner.scanJsonlSessionSource({
          source: "claude-code-history-jsonl",
          sourcePath,
          client: "claude-code",
        });

        expect(result.scanned).toBe(3);
        expect(result.created).toBe(2);
        expect(result.skippedMalformed).toBe(1);

        const sessions = scanner.listWorkSessions();
        expect(sessions.map((session) => ({
            id: session.id,
            projectPath: session.projectPath,
            source: session.source,
            searchable: session.searchable,
            resumable: session.resumable,
            sessionId: session.sessionId,
          }))).toEqual([
            {
              id: "claude-code-history-jsonl:session-1",
              projectPath: "/workspace/app",
              source: "claude-code-history-jsonl",
              searchable: true,
              resumable: false,
              sessionId: "session-1",
            },
            {
              id: "claude-code-history-jsonl:session-2",
              projectPath: "/workspace/cli",
              source: "claude-code-history-jsonl",
              searchable: true,
              resumable: false,
              sessionId: "session-2",
            },
          ]);
        expect(sessions[0]?.evidenceSummary ?? "").toMatch(/gateway route/);
      } finally {
        scanner.close();
      }
    });
  });

  it("normalizes representative Claude, Codex, and IDE JSONL history formats", () => {
    withSessionScanner((dbPath, dir) => {
      const sourcePath = join(dir, "mixed-history.jsonl");
      writeFileSync(
        sourcePath,
        [
          JSON.stringify({
            session_id: "claude-session",
            cwd: "/workspace/claude-app",
            timestamp: "2026-05-28T13:00:00.000Z",
            message: {
              role: "user",
              content: "Continue the gateway adapter work.",
            },
          }),
          JSON.stringify({
            conversation_id: "codex-session",
            workspacePath: "/workspace/codex-app",
            updatedAt: "2026-05-28T13:05:00.000Z",
            events: [
              {
                type: "user_message",
                text: "Add tests for Codex session restore.",
              },
            ],
          }),
          JSON.stringify({
            threadId: "ide-session",
            project_path: "/workspace/ide-app",
            last_active_at: "2026-05-28T13:10:00.000Z",
            transcript: [
              {
                speaker: "user",
                content: "Find skill deployment regressions.",
              },
            ],
          }),
        ].join("\n"),
        "utf8",
      );

      const scanner = createSessionSourceScanner({ dbPath });

      try {
        const result = scanner.scanJsonlSessionSource({
          source: "mixed-assistant-history-jsonl",
          sourcePath,
          client: "assistant-history",
        });

        expect(result.scanned).toBe(3);
        expect(result.created).toBe(3);
        expect(result.skippedMalformed).toBe(0);

        const sessions = scanner.listWorkSessions();
        expect(sessions.map((session) => ({
            id: session.id,
            projectPath: session.projectPath,
            lastActiveAt: session.lastActiveAt,
            evidenceSummary: session.evidenceSummary,
            searchable: session.searchable,
            resumable: session.resumable,
          }))).toEqual([
            {
              id: "mixed-assistant-history-jsonl:claude-session",
              projectPath: "/workspace/claude-app",
              lastActiveAt: "2026-05-28T13:00:00.000Z",
              evidenceSummary: "Continue the gateway adapter work.",
              searchable: true,
              resumable: false,
            },
            {
              id: "mixed-assistant-history-jsonl:codex-session",
              projectPath: "/workspace/codex-app",
              lastActiveAt: "2026-05-28T13:05:00.000Z",
              evidenceSummary: "Add tests for Codex session restore.",
              searchable: true,
              resumable: false,
            },
            {
              id: "mixed-assistant-history-jsonl:ide-session",
              projectPath: "/workspace/ide-app",
              lastActiveAt: "2026-05-28T13:10:00.000Z",
              evidenceSummary: "Find skill deployment regressions.",
              searchable: true,
              resumable: false,
            },
          ]);
      } finally {
        scanner.close();
      }
    });
  });

  it("searches Work Sessions by project, source, time, and keyword without exposing resume actions for searchable-only sessions", () => {
    withSessionScanner((dbPath, dir) => {
      const sourcePath = join(dir, "history.jsonl");
      writeFileSync(
        sourcePath,
        [
          JSON.stringify({
            sessionId: "searchable-only",
            cwd: "/workspace/app",
            timestamp: "2026-05-28T12:00:00.000Z",
            message: "Refactor gateway routing with cost audit evidence.",
          }),
        ].join("\n"),
        "utf8",
      );

      const scanner = createSessionSourceScanner({ dbPath });

      try {
        scanner.scanJsonlSessionSource({
          source: "claude-code-history-jsonl",
          sourcePath,
          client: "claude-code",
        });
        scanner.recordWorkSession({
          id: "codex-responses:resumable-1",
          source: "codex-responses",
          client: "codex",
          projectPath: "/workspace/app",
          sessionId: "resumable-1",
          lastActiveAt: "2026-05-28T12:10:00.000Z",
          evidenceSummary: "Continue gateway route tests and session search.",
          searchable: true,
          resumable: true,
          resumeCommand: "codex resume resumable-1",
        });

        const results = scanner.searchWorkSessions({
          projectPath: "/workspace/app",
          keyword: "gateway",
          activeFrom: "2026-05-28T11:59:00.000Z",
          activeTo: "2026-05-28T12:11:00.000Z",
        });

        expect(results.map((session) => ({
            id: session.id,
            source: session.source,
            client: session.client,
            resumable: session.resumable,
            availableActions: session.availableActions,
            resumeCommand: session.resumeCommand,
          }))).toEqual([
            {
              id: "codex-responses:resumable-1",
              source: "codex-responses",
              client: "codex",
              resumable: true,
              availableActions: ["resume"],
              resumeCommand: "codex resume resumable-1",
            },
            {
              id: "claude-code-history-jsonl:searchable-only",
              source: "claude-code-history-jsonl",
              client: "claude-code",
              resumable: false,
              availableActions: [],
              resumeCommand: undefined,
            },
          ]);

        expect(scanner.searchWorkSessions({ source: "codex-responses" }).length).toBe(1);
        expect(scanner.searchWorkSessions({ client: "claude-code" }).length).toBe(1);
      } finally {
        scanner.close();
      }
    });
  });

  it("gates Session Launcher execution through approval decisions or scoped trust", () => {
    withSessionScanner((dbPath) => {
      const scanner = createSessionSourceScanner({ dbPath });
      const terminal = {
        executedCommands: new Array<string>(),
      };

      try {
        scanner.recordWorkSession({
          id: "claude-code-history-jsonl:searchable-only",
          source: "claude-code-history-jsonl",
          client: "claude-code",
          projectPath: "/workspace/app",
          sessionId: "searchable-only",
          lastActiveAt: "2026-05-28T12:00:00.000Z",
          evidenceSummary: "Searchable but not resumable.",
          searchable: true,
          resumable: false,
        });
        scanner.recordWorkSession({
          id: "claude-code-history-jsonl:resumable",
          source: "claude-code-history-jsonl",
          client: "claude-code",
          projectPath: "/workspace/app",
          sessionId: "resumable",
          lastActiveAt: "2026-05-28T12:05:00.000Z",
          evidenceSummary: "Resume gateway implementation.",
          searchable: true,
          resumable: true,
          resumeCommand: "claude -r resumable",
        });

        const launcher = createSessionLauncher({
          scanner,
          controlledEntryPoint: "client-hook",
          clientAuthorizationMode: "normal",
          approvalSurfaceAvailable: true,
          now: "2026-05-28T12:06:00.000Z",
          executeTerminalCommand(command) {
            terminal.executedCommands.push(command);
          },
          decideSafetyPolicy,
        });

        expect(launcher.launchWorkSession({
            workSessionId: "claude-code-history-jsonl:searchable-only",
          })).toEqual({
            status: "not-launchable",
            reason: "non-resumable",
          });
        expect(terminal.executedCommands).toEqual([]);

        const pending = launcher.launchWorkSession({
          workSessionId: "claude-code-history-jsonl:resumable",
        });
        expect(pending.status).toBe("approval-required");
        expect(terminal.executedCommands).toEqual([]);

        const denied = launcher.launchWorkSession({
          workSessionId: "claude-code-history-jsonl:resumable",
          approvalDecisionKind: "denied",
        });
        expect(denied.status).toBe("denied");
        expect(terminal.executedCommands).toEqual([]);

        const trustedLauncher = createSessionLauncher({
          scanner,
          controlledEntryPoint: "client-hook",
          clientAuthorizationMode: "normal",
          approvalSurfaceAvailable: true,
          now: "2026-05-28T12:06:00.000Z",
          scopedTrustGrants: [
            {
              id: "trust:launch-session",
              actionKinds: ["launch-session"],
              projectPath: "/workspace/app",
              clientId: "claude-code",
              maxRiskClass: "high-risk",
              expiresAt: "2026-05-28T13:00:00.000Z",
              createdAt: "2026-05-28T12:00:00.000Z",
            },
          ],
          executeTerminalCommand(command) {
            terminal.executedCommands.push(command);
          },
          decideSafetyPolicy,
        });

        const launched = trustedLauncher.launchWorkSession({
          workSessionId: "claude-code-history-jsonl:resumable",
        });

        expect(launched.status).toBe("launched");
        expect(launched.command).toBe("claude -r resumable");
        expect(launched.trustGrantId).toBe("trust:launch-session");
        expect(terminal.executedCommands).toEqual(["claude -r resumable"]);
      } finally {
        scanner.close();
      }
    });
  });
});

function withSessionScanner(assertions: (dbPath: string, dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "agentsoul-v2-sessions-"));
  const dbPath = join(dir, "agentsoul-v2.sqlite");

  try {
    assertions(dbPath, dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
