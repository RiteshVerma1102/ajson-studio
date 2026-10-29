import {
  AgentService,
  AgentMission,
  AIEvent,
} from '@ajson/contracts';

export class MockAgentService implements AgentService {
  private missions: Map<string, AgentMission> = new Map();
  private eventListeners: Set<(missionId: string, event: AIEvent) => void> = new Set();

  constructor() {
    this.seedDefaultMissions();
  }

  private seedDefaultMissions() {
    const defaultMission: AgentMission = {
      id: 'mission-alpha-01',
      title: 'Harden Authentication and Clean Up IPC Bridges',
      goal: 'Audit all Electron IPC handlers, enforce Zod schemas, and ensure zero unhandled rejections.',
      status: 'idle',
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 1800000,
      events: [
        {
          type: 'thought',
          text: 'Inspected 14 IPC handlers; all conform to contracts.',
          timestamp: Date.now() - 3500000,
        },
      ],
      approvals: [
        {
          id: 'approval-mcp-01',
          kind: 'mcp',
          title: 'Authorize MCP Tool Call',
          description: 'Agent requests permission to call MCP server git-tools:status on workspace.',
          target: 'git-tools:status',
          payload: { command: 'status' },
          timestamp: Date.now() - 1800000,
          status: 'pending',
        },
      ],
      assignedModel: 'claude-3-5-sonnet',
    };
    this.missions.set(defaultMission.id, defaultMission);
  }

  async createMission(goal: string, options?: { model?: string }): Promise<AgentMission> {
    const id = `mission-${Date.now().toString(36)}`;
    const mission: AgentMission = {
      id,
      title: goal.slice(0, 40) || 'New Mission',
      goal,
      status: 'running',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      events: [
        {
          type: 'thought',
          text: `Planning mission execution for goal: "${goal}"`,
          timestamp: Date.now(),
        },
      ],
      approvals: [],
      assignedModel: options?.model || 'claude-3-5-sonnet',
    };
    this.missions.set(id, mission);
    return mission;
  }

  async listMissions(): Promise<AgentMission[]> {
    return Array.from(this.missions.values());
  }

  async getMission(id: string): Promise<AgentMission | null> {
    return this.missions.get(id) || null;
  }

  async cancelMission(id: string): Promise<void> {
    const mission = this.missions.get(id);
    if (mission) {
      mission.status = 'cancelled';
      mission.updatedAt = Date.now();
    }
  }

  async approveAction(approvalId: string): Promise<void> {
    for (const mission of this.missions.values()) {
      const target = mission.approvals.find((a) => a.id === approvalId);
      if (target) {
        target.status = 'approved';
        target.resolvedAt = Date.now();
        mission.updatedAt = Date.now();
        this.notify(mission.id, {
          type: 'approval_resolved',
          id: approvalId,
          approved: true,
          timestamp: Date.now(),
        });
        return;
      }
    }
  }

  async rejectAction(approvalId: string, reason?: string): Promise<void> {
    for (const mission of this.missions.values()) {
      const target = mission.approvals.find((a) => a.id === approvalId);
      if (target) {
        target.status = 'rejected';
        target.resolvedAt = Date.now();
        target.resolvedReason = reason;
        mission.updatedAt = Date.now();
        this.notify(mission.id, {
          type: 'approval_resolved',
          id: approvalId,
          approved: false,
          reason,
          timestamp: Date.now(),
        });
        return;
      }
    }
  }

  onAgentEvent(cb: (missionId: string, event: AIEvent) => void): () => void {
    this.eventListeners.add(cb);
    return () => {
      this.eventListeners.delete(cb);
    };
  }

  private notify(missionId: string, event: AIEvent) {
    for (const listener of this.eventListeners) {
      try {
        listener(missionId, event);
      } catch (err) {
        console.error('Error in agent event listener', err);
      }
    }
  }
}
