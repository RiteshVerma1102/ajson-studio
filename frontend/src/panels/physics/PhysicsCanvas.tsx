/**
 * PhysicsCanvas — AntiGravity interactive physics simulation panel.
 *
 * Direct integration with Code Editor, Git, Terminal, and AI Panel:
 * - Dynamic nodes representing open workspace files, Git branches, and running terminals
 * - Matter.js mouse drag-and-drop constraints with click-to-open interaction
 * - Anti-gravity buoyancy forces and springy collision boundaries
 * - Workspace persistence of canvas node positions across reloads
 */
import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useState,
} from 'react';
import Matter from 'matter-js';
import { useEditorStore } from '../../state/editorStore';
import { useLayoutStore } from '../../state/layoutStore';
import { usePhysicsStore, PhysicsNodeType } from '../../state/physicsStore';
import { gitService, terminalService } from '../../services';
import styles from './PhysicsCanvas.module.css';

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

export interface PhysicsCard {
  id: string;
  label: string;
  sublabel?: string;
  color?: string;
  type?: PhysicsNodeType;
  meta?: Record<string, unknown>;
}

export interface PhysicsCanvasHandle {
  addCard: (
    label: string,
    sublabel?: string,
    color?: string,
    type?: PhysicsNodeType,
    meta?: Record<string, unknown>,
    x?: number,
    y?: number
  ) => void;
  clear: () => void;
  toggleGravity: () => void;
  toggleBuoyancy: () => void;
}

interface CardBody extends Matter.Body {
  _card: PhysicsCard;
}

const CARD_WIDTH = 168;
const CARD_HEIGHT = 56;
const CARD_RADIUS = 10;
const WALL_THICKNESS = 80;
const GRAVITY_DEFAULT = 1;

const TYPE_COLORS: Record<PhysicsNodeType, string> = {
  file: '#3b82f6',
  git: '#10b981',
  terminal: '#f59e0b',
  ai: '#a855f7',
  custom: '#6366f1',
};

const EXT_COLORS: Record<string, string> = {
  ts: '#3b82f6',
  tsx: '#3b82f6',
  js: '#eab308',
  jsx: '#eab308',
  json: '#10b981',
  css: '#ec4899',
  html: '#f97316',
  md: '#8b5cf6',
  sql: '#06b6d4',
};

function getColorForCard(card: PhysicsCard): string {
  if (card.color) return card.color;
  if (card.type && TYPE_COLORS[card.type]) {
    if (card.type === 'file') {
      const ext = card.label.split('.').pop()?.toLowerCase() ?? '';
      return EXT_COLORS[ext] ?? TYPE_COLORS.file;
    }
    return TYPE_COLORS[card.type];
  }
  return '#6366f1';
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Component Implementation
// ---------------------------------------------------------------------------

const PhysicsCanvasInner = forwardRef<PhysicsCanvasHandle>((_props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const rafRef = useRef<number | null>(null);
  const bodiesRef = useRef<CardBody[]>([]);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);

  const {
    antiGravity,
    buoyancy,
    customNodes,
    savedPositions,
    toggleAntiGravity,
    toggleBuoyancy,
    saveNodePosition,
  } = usePhysicsStore();

  const antiGravityRef = useRef(antiGravity);
  antiGravityRef.current = antiGravity;

  const buoyancyRef = useRef(buoyancy);
  buoyancyRef.current = buoyancy;

  const [cardCount, setCardCount] = useState(0);

  const { tabs, activeTabId } = useEditorStore();
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  // -------------------------------------------------------------------------
  // Add Card Internal
  // -------------------------------------------------------------------------
  const addCardInternal = useCallback(
    (
      label: string,
      sublabel?: string,
      color?: string,
      type: PhysicsNodeType = 'custom',
      meta?: Record<string, unknown>,
      forcedX?: number,
      forcedY?: number
    ) => {
      const engine = engineRef.current;
      const canvas = canvasRef.current;
      if (!engine || !canvas) return;

      const cardId = (meta?.id as string) || `${type}:${label}`;

      // Prevent duplicate nodes with the same ID
      const existing = bodiesRef.current.find((b) => b._card.id === cardId);
      if (existing) {
        // Update label or sublabel if changed
        existing._card.label = label;
        existing._card.sublabel = sublabel;
        return;
      }

      const w = canvas.width;
      const h = canvas.height;

      // Restore saved position if available
      const saved = savedPositions[cardId];
      let x = forcedX;
      let y = forcedY;

      if (x === undefined || y === undefined) {
        if (saved && saved.x > 20 && saved.x < w - 20 && saved.y > 20 && saved.y < h - 20) {
          x = saved.x;
          y = saved.y;
        } else {
          x =
            WALL_THICKNESS +
            CARD_WIDTH / 2 +
            Math.random() * Math.max(10, w - WALL_THICKNESS * 2 - CARD_WIDTH);
          y = Math.random() * (h * 0.4) + CARD_HEIGHT;
        }
      }

      const card: PhysicsCard = {
        id: cardId,
        label,
        sublabel,
        color,
        type,
        meta,
      };
      card.color = getColorForCard(card);

      const body = Matter.Bodies.rectangle(x, y, CARD_WIDTH, CARD_HEIGHT, {
        restitution: 0.55,
        friction: 0.2,
        frictionAir: antiGravityRef.current ? 0.04 : 0.02,
        density: 0.001,
        chamfer: { radius: CARD_RADIUS },
      }) as CardBody;
      body._card = card;

      Matter.World.add(engine.world, body);
      bodiesRef.current.push(body);
      setCardCount(bodiesRef.current.length);
    },
    [savedPositions]
  );

  // Expose imperative handle
  useImperativeHandle(ref, () => ({
    addCard: (label, sublabel, color, type, meta, x, y) => {
      addCardInternal(label, sublabel, color, type, meta, x, y);
    },
    clear: () => {
      if (!engineRef.current) return;
      const toRemove = bodiesRef.current.map((b) => b as Matter.Body);
      Matter.World.remove(engineRef.current.world, toRemove);
      bodiesRef.current = [];
      setCardCount(0);
    },
    toggleGravity: toggleAntiGravity,
    toggleBuoyancy: toggleBuoyancy,
  }));

  // -------------------------------------------------------------------------
  // Main Matter.js Engine & Canvas Setup
  // -------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const engine = Matter.Engine.create({
      gravity: { x: 0, y: antiGravityRef.current ? 0 : GRAVITY_DEFAULT },
    });
    engineRef.current = engine;

    const runner = Matter.Runner.create();
    runnerRef.current = runner;

    let ground: Matter.Body;
    let wallL: Matter.Body;
    let wallR: Matter.Body;
    let ceiling: Matter.Body;

    function rebuildWalls() {
      const w = canvas!.width;
      const h = canvas!.height;
      if (ground) {
        Matter.World.remove(engine.world, [ground, wallL, wallR, ceiling]);
      }
      ground = Matter.Bodies.rectangle(w / 2, h + WALL_THICKNESS / 2, w * 2, WALL_THICKNESS, {
        isStatic: true,
        restitution: 0.8,
      });
      wallL = Matter.Bodies.rectangle(-WALL_THICKNESS / 2, h / 2, WALL_THICKNESS, h * 2, {
        isStatic: true,
        restitution: 0.8,
      });
      wallR = Matter.Bodies.rectangle(w + WALL_THICKNESS / 2, h / 2, WALL_THICKNESS, h * 2, {
        isStatic: true,
        restitution: 0.8,
      });
      ceiling = Matter.Bodies.rectangle(w / 2, -WALL_THICKNESS / 2, w * 2, WALL_THICKNESS, {
        isStatic: true,
        restitution: 0.8,
      });
      Matter.World.add(engine.world, [ground, wallL, wallR, ceiling]);
    }

    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width || 600;
      canvas.height = rect.height || 500;
      rebuildWalls();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // Mouse constraint for dragging
    const mouse = Matter.Mouse.create(canvas);
    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse,
      constraint: {
        stiffness: 0.25,
        render: { visible: false },
      },
    });
    Matter.World.add(engine.world, mouseConstraint);

    // Track mouse down to distinguish click vs drag
    const onMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseDownPosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onMouseUp = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const upPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const downPos = mouseDownPosRef.current;
      mouseDownPosRef.current = null;

      if (!downPos) return;
      const dist = Math.hypot(upPos.x - downPos.x, upPos.y - downPos.y);

      // If moved less than 6px, treat as a node click interaction
      if (dist < 6) {
        const clicked = bodiesRef.current.find((b) =>
          Matter.Bounds.contains(b.bounds, upPos)
        );
        if (clicked) {
          handleNodeClick(clicked._card);
        }
      }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);

    // Persist position when drag ends
    Matter.Events.on(mouseConstraint, 'enddrag', (evt) => {
      const body = (evt as unknown as { body: CardBody }).body;
      if (body && body._card) {
        saveNodePosition(body._card.id, {
          x: Math.round(body.position.x),
          y: Math.round(body.position.y),
        });
      }
    });

    // AntiGravity Buoyancy Force in beforeUpdate loop
    Matter.Events.on(engine, 'beforeUpdate', () => {
      const isAntiGrav = antiGravityRef.current;
      const isBuoyant = buoyancyRef.current;
      if (!isBuoyant && !isAntiGrav) return;

      const time = performance.now() * 0.002;
      for (const body of bodiesRef.current) {
        if (body.isStatic) continue;

        // Upward buoyancy counteracting downward gravity + sinusoidal float
        const upwardBias = isAntiGrav ? 0 : -0.0009 * body.mass;
        const waveX = Math.sin(time + body.id * 1.7) * 0.00015 * body.mass;
        const waveY = Math.cos(time + body.id * 1.3) * 0.00025 * body.mass;

        Matter.Body.applyForce(body, body.position, {
          x: waveX,
          y: upwardBias + waveY,
        });

        // Angular damping for smooth floating orientation
        body.torque = -body.angularVelocity * 0.04 * body.mass;
      }
    });

    Matter.Runner.run(runner, engine);

    // -------------------------------------------------------------------------
    // Custom Render Loop
    // -------------------------------------------------------------------------
    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      const w = canvas!.width;
      const h = canvas!.height;
      ctx.clearRect(0, 0, w, h);

      // Background grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += 40) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      // Ground glow line
      ctx.strokeStyle = antiGravityRef.current
        ? 'rgba(168, 85, 247, 0.35)'
        : 'rgba(99, 102, 241, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, h - 2);
      ctx.lineTo(w, h - 2);
      ctx.stroke();

      // Render cards
      for (const body of bodiesRef.current) {
        const { position: pos, angle } = body;
        const card = body._card;
        const color = card.color ?? '#6366f1';

        const isActiveInMonaco =
          card.type === 'file' &&
          Boolean(activeTabIdRef.current) &&
          (card.id === `file:${activeTabIdRef.current}` ||
            card.meta?.path === activeTabIdRef.current ||
            card.label === activeTabIdRef.current?.split('/').pop());

        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(angle);

        // Drop Shadow & Neon Aura for active Monaco file
        if (isActiveInMonaco) {
          const pulse = Math.sin(performance.now() * 0.006) * 0.3 + 0.7;
          ctx.shadowColor = '#00F2FE';
          ctx.shadowBlur = 18 * pulse;
          ctx.shadowOffsetY = 0;
        } else {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 4;
        }

        // Card body background (Frosted glassmorphism surface)
        drawRoundRect(
          ctx,
          -CARD_WIDTH / 2,
          -CARD_HEIGHT / 2,
          CARD_WIDTH,
          CARD_HEIGHT,
          CARD_RADIUS
        );
        ctx.fillStyle = isActiveInMonaco ? '#101726' : '#141724';
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Color indicator pill on left edge
        drawRoundRect(
          ctx,
          -CARD_WIDTH / 2,
          -CARD_HEIGHT / 2,
          4,
          CARD_HEIGHT,
          2
        );
        ctx.fillStyle = isActiveInMonaco ? '#00F2FE' : color;
        ctx.fill();

        // Border outline (Neon cyan if active in Monaco)
        drawRoundRect(
          ctx,
          -CARD_WIDTH / 2,
          -CARD_HEIGHT / 2,
          CARD_WIDTH,
          CARD_HEIGHT,
          CARD_RADIUS
        );
        ctx.strokeStyle = isActiveInMonaco ? '#00F2FE' : color + '44';
        ctx.lineWidth = isActiveInMonaco ? 2.5 : 1.5;
        ctx.stroke();

        if (isActiveInMonaco) {
          // Draw active pulse indicator
          ctx.beginPath();
          ctx.arc(-CARD_WIDTH / 2 + 12, -CARD_HEIGHT / 2 + 12, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#00F2FE';
          ctx.fill();
        }

        // Badge pill in top right corner (FILE, GIT, TERM, AI)
        const typeBadge = (card.type || 'node').toUpperCase();
        ctx.fillStyle = color + '22';
        drawRoundRect(ctx, CARD_WIDTH / 2 - 46, -CARD_HEIGHT / 2 + 6, 38, 14, 3);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.font = `bold 8px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(typeBadge, CARD_WIDTH / 2 - 27, -CARD_HEIGHT / 2 + 13);

        // Label text
        ctx.fillStyle = '#f1f5f9';
        ctx.font = `600 11px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const maxLabelWidth = CARD_WIDTH - 60;
        let labelText = card.label;
        while (ctx.measureText(labelText).width > maxLabelWidth && labelText.length > 4) {
          labelText = labelText.slice(0, -4) + '...';
        }
        ctx.fillText(labelText, -CARD_WIDTH / 2 + 12, -CARD_HEIGHT / 2 + 18);

        // Sublabel text
        if (card.sublabel) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = `9px 'JetBrains Mono', monospace`;
          let sub = card.sublabel;
          const maxSubWidth = CARD_WIDTH - 24;
          while (ctx.measureText(sub).width > maxSubWidth && sub.length > 4) {
            sub = sub.slice(0, -4) + '...';
          }
          ctx.fillText(sub, -CARD_WIDTH / 2 + 12, -CARD_HEIGHT / 2 + 36);
        }

        ctx.restore();
      }
    };

    render();

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      Matter.Runner.stop(runner);
      Matter.World.clear(engine.world, false);
      Matter.Engine.clear(engine);
      ro.disconnect();
      engineRef.current = null;
      runnerRef.current = null;
      bodiesRef.current = [];
    };
  }, [saveNodePosition]);

  // Sync AntiGravity state to Engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.gravity.y = antiGravity ? 0 : GRAVITY_DEFAULT;
      for (const body of bodiesRef.current) {
        body.frictionAir = antiGravity ? 0.04 : 0.02;
      }
    }
  }, [antiGravity]);

  // -------------------------------------------------------------------------
  // Handle Node Click Interaction
  // -------------------------------------------------------------------------
  const handleNodeClick = (card: PhysicsCard) => {
    if (card.type === 'file') {
      const filePath = (card.meta?.path as string) || card.sublabel || card.label;
      void useEditorStore.getState().openFile(filePath);
    } else if (card.type === 'git') {
      useLayoutStore.getState().setActiveSidebarTab('git');
    } else if (card.type === 'terminal') {
      useLayoutStore.getState().setActiveBottomTab('terminal');
      useLayoutStore.getState().setBottomPanelOpen(true);
    } else if (card.type === 'ai') {
      useLayoutStore.getState().setRightPanelOpen(true);
    }
  };

  // -------------------------------------------------------------------------
  // Auto-synchronize Open Workspace Files
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!engineRef.current) return;
    for (const tab of tabs) {
      if (tab.type === 'diff') continue;
      addCardInternal(
        tab.title,
        tab.path,
        getColorForCard({ id: '', label: tab.title, type: 'file' }),
        'file',
        { path: tab.path, id: `file:${tab.path}` }
      );
    }
  }, [tabs, addCardInternal]);

  // -------------------------------------------------------------------------
  // Auto-synchronize Active Git Branch
  // -------------------------------------------------------------------------
  useEffect(() => {
    let unmounted = false;
    gitService
      .currentBranch()
      .then((branch) => {
        if (unmounted || !branch) return;
        addCardInternal(
          branch,
          'Active Branch (HEAD)',
          TYPE_COLORS.git,
          'git',
          { id: `git:${branch}` }
        );
      })
      .catch(() => {});

    const unbind = gitService.onDidChange(() => {
      gitService
        .currentBranch()
        .then((branch) => {
          if (!unmounted && branch) {
            addCardInternal(
              branch,
              'Active Branch (HEAD)',
              TYPE_COLORS.git,
              'git',
              { id: `git:${branch}` }
            );
          }
        })
        .catch(() => {});
    });

    return () => {
      unmounted = true;
      unbind();
    };
  }, [addCardInternal]);

  // -------------------------------------------------------------------------
  // Auto-synchronize Running Terminals
  // -------------------------------------------------------------------------
  useEffect(() => {
    const sessions = terminalService.listSessions();
    for (const s of sessions) {
      addCardInternal(
        s.title || `Terminal`,
        `${s.shell || 'bash'} · active`,
        TYPE_COLORS.terminal,
        'terminal',
        { id: `term:${s.id}` }
      );
    }
  }, [addCardInternal]);

  // -------------------------------------------------------------------------
  // Synchronize Custom Nodes (AI injected, user created)
  // -------------------------------------------------------------------------
  useEffect(() => {
    for (const node of customNodes) {
      addCardInternal(
        node.label,
        node.sublabel,
        node.color,
        node.type || 'ai',
        { ...node.meta, id: node.id },
        node.x,
        node.y
      );
    }
  }, [customNodes, addCardInternal]);

  return (
    <div ref={containerRef} className={styles.container}>
      {/* Interactive Toolbar */}
      <div className={styles.toolbar}>
        <span className={styles.cardCount}>{cardCount} physics nodes</span>

        <button
          className={`${styles.toolbarBtn} ${antiGravity ? styles.active : ''}`}
          onClick={toggleAntiGravity}
          title={antiGravity ? 'Turn Gravity ON' : 'Turn AntiGravity (Zero-G) ON'}
        >
          {antiGravity ? '🌌 AntiGravity ON' : '🌍 Gravity ON'}
        </button>

        <button
          className={`${styles.toolbarBtn} ${buoyancy ? styles.active : ''}`}
          onClick={toggleBuoyancy}
          title={buoyancy ? 'Disable Buoyant Drift' : 'Enable Buoyant Drift'}
        >
          {buoyancy ? '🎈 Buoyancy ON' : '⚓ Buoyancy OFF'}
        </button>

        <button
          className={styles.toolbarBtn}
          onClick={() => {
            if (!engineRef.current) return;
            const toRemove = bodiesRef.current.map((b) => b as Matter.Body);
            Matter.World.remove(engineRef.current.world, toRemove);
            bodiesRef.current = [];
            usePhysicsStore.getState().clearCustomNodes();
            setCardCount(0);
          }}
          title="Clear all cards"
        >
          🗑 Clear
        </button>

        <button
          className={styles.toolbarBtn}
          onClick={() =>
            usePhysicsStore.getState().spawnNode({
              label: 'AI Action Node',
              sublabel: 'Interactive Node',
              type: 'ai',
              color: '#a855f7',
            })
          }
          title="Add interactive AI card"
        >
          ＋ Spawn Node
        </button>

        <button
          className={styles.toolbarBtn}
          onClick={() => {
            const activeTab = tabs.find((t) => t.id === activeTabId);
            if (activeTab) {
              const existing = bodiesRef.current.find(
                (b) => b._card.id === `file:${activeTab.path}`
              );
              if (existing) {
                Matter.Body.applyForce(existing, existing.position, {
                  x: (Math.random() - 0.5) * 0.005,
                  y: -0.015 * existing.mass,
                });
              } else {
                addCardInternal(
                  activeTab.title,
                  activeTab.path,
                  undefined,
                  'file',
                  { path: activeTab.path, id: `file:${activeTab.path}` }
                );
              }
            }
          }}
          title="Float currently active Monaco file into canvas"
        >
          📄 Float Active Tab
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className={styles.canvas}
        style={{ cursor: 'grab' }}
      />

      {cardCount === 0 && (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>⚛</span>
          <p>AntiGravity Physics Simulation</p>
          <p className={styles.emptyHint}>
            Open editor tabs, Git branches, and terminals will float here as interactive nodes.
          </p>
        </div>
      )}
    </div>
  );
});

PhysicsCanvasInner.displayName = 'PhysicsCanvas';

export const PhysicsCanvas = PhysicsCanvasInner;
