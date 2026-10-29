import { AgentService } from '../services/agent';

export async function runAgentConformanceTests(
  createService: () => Promise<AgentService> | AgentService
) {
  const agent = await createService();

  // 1. Create mission
  const mission = await agent.createMission('Refactor legacy parser and add unit tests');
  if (!mission || !mission.id) {
    throw new Error('createMission failed to create mission');
  }

  // 2. List missions
  const missions = await agent.listMissions();
  const found = missions.some((m) => m.id === mission.id);
  if (!found) {
    throw new Error('listMissions failed to include created mission');
  }

  // 3. Get mission
  const fetched = await agent.getMission(mission.id);
  if (!fetched || fetched.id !== mission.id) {
    throw new Error('getMission failed to fetch created mission');
  }

  return true;
}
