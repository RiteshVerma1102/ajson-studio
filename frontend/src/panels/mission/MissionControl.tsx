import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bot,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Play,
  Plus,
  Terminal,
  FileCode,
  Globe,
  Radio,
  ArrowLeft,
} from 'lucide-react';
import { agentService, AgentMission } from '../../services';
import { useLayoutStore } from '../../state/layoutStore';
import { Button } from '../../components/Button/Button';
import { Badge } from '../../components/Badge/Badge';
import { Modal } from '../../components/Modal/Modal';
import styles from './MissionControl.module.css';

export const MissionControl: React.FC = () => {
  const [missions, setMissions] = useState<AgentMission[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [newMissionModalOpen, setNewMissionModalOpen] = useState(false);
  const [newMissionGoal, setNewMissionGoal] = useState('');

  const { setActiveView } = useLayoutStore();

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadMissions = useCallback(async () => {
    try {
      const list = await agentService.listMissions();
      if (!isMountedRef.current) return;
      setMissions(list);
      if (list.length > 0 && !selectedMissionId) {
        setSelectedMissionId(list[0]!.id);
      }
    } catch (err) {
      console.error('Failed to load agent missions', err);
    }
  }, [selectedMissionId]);

  useEffect(() => {
    void loadMissions();
    const unbind = agentService.onAgentEvent(() => {
      if (isMountedRef.current) {
        void loadMissions();
      }
    });
    return () => unbind();
  }, [loadMissions]);

  const activeMission = missions.find((m) => m.id === selectedMissionId) || missions[0];

  const handleApprove = async (approvalId: string) => {
    await agentService.approveAction(approvalId);
    void loadMissions();
  };

  const handleReject = async (approvalId: string) => {
    await agentService.rejectAction(approvalId, 'User rejected action in Mission Control');
    void loadMissions();
  };

  const handleCreateMission = async () => {
    if (!newMissionGoal.trim()) return;
    const mission = await agentService.createMission(newMissionGoal.trim());
    setNewMissionGoal('');
    setNewMissionModalOpen(false);
    setSelectedMissionId(mission.id);
    void loadMissions();
  };

  const pendingApprovals = missions.flatMap((m) =>
    m.approvals.filter((a) => a.status === 'pending')
  );

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ArrowLeft size={14} />}
            onClick={() => setActiveView('editor')}
          >
            Back to Editor
          </Button>
          <div className={styles.headerTitle}>
            <Bot size={18} color="var(--accent)" />
            <span>Mission Control — Autonomous Agent Orchestrator</span>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={14} />}
          onClick={() => setNewMissionModalOpen(true)}
        >
          New Mission
        </Button>
      </div>

      {/* Main Grid: Mission Sidebar + Central Timeline + Approvals */}
      <div className={styles.grid}>
        {/* Missions List Column */}
        <div className={styles.missionsCol}>
          <h3 className={styles.colHeader}>Active Missions ({missions.length})</h3>
          <div className={styles.missionCards}>
            {missions.map((m) => (
              <div
                key={m.id}
                className={`${styles.missionCard} ${
                  m.id === activeMission?.id ? styles.selectedCard : ''
                }`}
                onClick={() => setSelectedMissionId(m.id)}
              >
                <div className={styles.cardTop}>
                  <span className={styles.cardTitle}>{m.title}</span>
                  <Badge
                    variant={
                      m.status === 'running'
                        ? 'accent'
                        : m.status === 'waiting_approval'
                        ? 'warning'
                        : 'default'
                    }
                  >
                    {m.status}
                  </Badge>
                </div>
                <p className={styles.cardGoal}>{m.goal}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Central Mission Timeline */}
        <div className={styles.timelineCol}>
          {activeMission ? (
            <>
              <div className={styles.missionBanner}>
                <div>
                  <h2 className={styles.bannerTitle}>{activeMission.title}</h2>
                  <p className={styles.bannerGoal}>{activeMission.goal}</p>
                </div>
                <span className={styles.modelTag}>{activeMission.assignedModel}</span>
              </div>

              <div className={styles.eventsArea}>
                <h4 className={styles.eventsTitle}>Thought & Execution Log</h4>
                <div className={styles.timelineList}>
                  {activeMission.events.map((evt, idx) => (
                    <div key={idx} className={styles.eventRow}>
                      <span className={styles.eventTime}>
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </span>
                      {evt.type === 'thought' && (
                        <div className={styles.thoughtBox}>
                          <span className={styles.thoughtLabel}>Thought:</span>
                          <span>{evt.text}</span>
                        </div>
                      )}
                      {evt.type === 'tool_call' && (
                        <div className={styles.toolBox}>
                          <span className={styles.toolLabel}>Tool Call:</span>
                          <code>{evt.tool}</code>
                        </div>
                      )}
                      {evt.type === 'approval_resolved' && (
                        <div className={styles.resolvedBox}>
                          <span>Approval {evt.approved ? 'Granted' : 'Denied'}: {evt.id}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className={styles.emptyTimeline}>Select a mission to view its progress</div>
          )}
        </div>

        {/* Human-in-the-Loop Approval Inbox Column */}
        <div className={styles.approvalsCol}>
          <div className={styles.approvalsHeader}>
            <ShieldAlert size={16} color="var(--color-warning)" />
            <span>Approval Inbox ({pendingApprovals.length})</span>
          </div>

          <div className={styles.approvalList}>
            {pendingApprovals.map((approval) => (
              <div key={approval.id} className={styles.approvalCard}>
                <div className={styles.approvalTop}>
                  <div className={styles.kindBadge}>
                    {approval.kind === 'command' && <Terminal size={12} />}
                    {approval.kind === 'edit' && <FileCode size={12} />}
                    {approval.kind === 'browse' && <Globe size={12} />}
                    {approval.kind === 'mcp' && <Radio size={12} />}
                    <span>{approval.kind.toUpperCase()}</span>
                  </div>
                  <span className={styles.approvalTime}>
                    {new Date(approval.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <h4 className={styles.approvalTitle}>{approval.title}</h4>
                <p className={styles.approvalDesc}>{approval.description}</p>
                {approval.target && (
                  <code className={styles.approvalTarget}>{approval.target}</code>
                )}

                <div className={styles.approvalActions}>
                  <Button
                    variant="danger"
                    size="sm"
                    leftIcon={<XCircle size={13} />}
                    onClick={() => void handleReject(approval.id)}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<CheckCircle2 size={13} />}
                    onClick={() => void handleApprove(approval.id)}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            ))}

            {pendingApprovals.length === 0 && (
              <div className={styles.emptyApprovals}>
                <CheckCircle2 size={24} color="var(--color-success)" />
                <span>All actions approved. Zero pending requests.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Mission Modal */}
      <Modal
        isOpen={newMissionModalOpen}
        onClose={() => setNewMissionModalOpen(false)}
        title="Initialize Autonomous Agent Mission"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNewMissionModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!newMissionGoal.trim()}
              leftIcon={<Play size={13} />}
              onClick={() => void handleCreateMission()}
            >
              Start Mission
            </Button>
          </>
        }
      >
        <p style={{ fontSize: '13px', color: 'var(--fg-2)', marginBottom: '8px' }}>
          Define the objective for the autonomous coding agent. All tool calls and destructive
          actions will pause for your explicit confirmation.
        </p>
        <textarea
          style={{
            width: '100%',
            height: '90px',
            backgroundColor: 'var(--bg-1)',
            border: '1px solid var(--color-border)',
            borderRadius: '4px',
            color: 'var(--fg-0)',
            padding: '8px',
            fontSize: '13px',
            outline: 'none',
          }}
          placeholder="e.g. Audit all TypeScript interfaces and add Zod schema validation..."
          value={newMissionGoal}
          onChange={(e) => setNewMissionGoal(e.target.value)}
        />
      </Modal>
    </div>
  );
};
