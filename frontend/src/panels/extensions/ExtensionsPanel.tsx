import React, { useState } from 'react';
import {
  Blocks,
  Server,
  Plus,
} from 'lucide-react';
import styles from './ExtensionsPanel.module.css';

interface McpServer {
  id: string;
  name: string;
  desc: string;
  transport: 'stdio' | 'sse';
  status: 'connected' | 'standby';
  tools: string[];
}

const MCP_SERVERS: McpServer[] = [
  {
    id: 'fs',
    name: 'filesystem-mcp',
    desc: 'Local project file system access with workspace sandbox boundaries.',
    transport: 'stdio',
    status: 'connected',
    tools: ['read_file', 'write_file', 'list_dir', 'delete_file'],
  },
  {
    id: 'term',
    name: 'terminal-mcp',
    desc: 'Interactive shell process execution engine for bash & powershell.',
    transport: 'stdio',
    status: 'connected',
    tools: ['execute_command', 'kill_process'],
  },
  {
    id: 'db',
    name: 'sqlite-mcp',
    desc: 'Local SQLite database query runner and schema inspector.',
    transport: 'stdio',
    status: 'standby',
    tools: ['run_query', 'inspect_schema'],
  },
  {
    id: 'browser',
    name: 'browser-cdp-mcp',
    desc: 'Headless Chrome DevTools Protocol client for automated web testing.',
    transport: 'sse',
    status: 'connected',
    tools: ['navigate', 'click', 'screenshot', 'eval_script'],
  },
];

const EXTENSIONS = [
  {
    id: 'ts',
    name: 'TypeScript & JavaScript',
    author: 'Ajson Core',
    ver: 'v5.7.2',
    desc: 'IntelliSense, syntax highlighting, and diagnostics engine.',
    active: true,
  },
  {
    id: 'json',
    name: 'JSON Tools & Schema Suite',
    author: 'Ajson Studio',
    ver: 'v1.0.0',
    desc: 'Live validation, AST tree inspector, JSONPath and CSV tools.',
    active: true,
  },
  {
    id: 'ai',
    name: 'Antigravity AI Agent Engine',
    author: 'Google Antigravity',
    ver: 'v0.2.0',
    desc: 'Multi-turn autonomous coding agents and approval safeguards.',
    active: true,
  },
];

export const ExtensionsPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'mcp' | 'extensions'>('mcp');
  const [search, setSearch] = useState('');
  const [mcpList, setMcpList] = useState<McpServer[]>(MCP_SERVERS);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newServerName, setNewServerName] = useState('');

  const handleAddServer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServerName.trim()) return;
    setMcpList((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: newServerName.trim(),
        desc: 'Custom user-defined Model Context Protocol tool server.',
        transport: 'stdio',
        status: 'connected',
        tools: ['custom_tool'],
      },
    ]);
    setNewServerName('');
    setShowAddForm(false);
  };

  return (
    <div className={styles.container}>
      {/* Tab Switcher */}
      <div className={styles.tabsHeader}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'mcp' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('mcp')}
        >
          MCP Tool Servers ({mcpList.length})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'extensions' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('extensions')}
        >
          Extensions ({EXTENSIONS.length})
        </button>
      </div>

      {/* Search Input */}
      <div className={styles.searchBox}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${activeTab === 'mcp' ? 'MCP servers' : 'extensions'}...`}
          className={styles.searchInput}
        />
      </div>

      {/* MCP Servers Tab */}
      {activeTab === 'mcp' && (
        <div className={styles.list}>
          {mcpList
            .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
            .map((s) => (
              <div key={s.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.serverName}>
                    <Server size={13} color="var(--accent)" />
                    <span>{s.name}</span>
                  </span>
                  <span
                    className={`${styles.statusTag} ${
                      s.status === 'connected' ? styles.statusConnected : styles.statusStandby
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
                <p className={styles.serverDesc}>{s.desc}</p>
                <div className={styles.toolsCount}>
                  <span>Tools: {s.tools.join(', ')}</span>
                  <span style={{ opacity: 0.6 }}>{s.transport}</span>
                </div>
              </div>
            ))}

          {showAddForm ? (
            <form onSubmit={handleAddServer} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px' }}>
              <input
                type="text"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                placeholder="MCP Server command (e.g. npx -y @modelcontextprotocol/server-postgres)"
                className={styles.searchInput}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--color-border)', color: 'var(--fg-1)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: 'var(--accent)', border: 'none', color: '#000', fontWeight: 'bold', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                >
                  Connect
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowAddForm(true)} className={styles.addBtn}>
              <Plus size={13} />
              <span>Connect Custom MCP Server</span>
            </button>
          )}
        </div>
      )}

      {/* Extensions Tab */}
      {activeTab === 'extensions' && (
        <div className={styles.list}>
          {EXTENSIONS.map((ext) => (
            <div key={ext.id} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.serverName}>
                  <Blocks size={13} color="var(--color-info)" />
                  <span>{ext.name}</span>
                </span>
                <span className={`${styles.statusTag} ${styles.statusConnected}`}>Active</span>
              </div>
              <p className={styles.serverDesc}>{ext.desc}</p>
              <div className={styles.toolsCount}>
                <span>{ext.author}</span>
                <span style={{ opacity: 0.6 }}>{ext.ver}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
