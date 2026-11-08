/**
 * PhysicsCanvas — AntiGravity interactive physics simulation panel.
 *
 * Uses Matter.js Engine with a custom canvas render loop.
 * Features: gravity, ground/wall boundaries, draggable card nodes via
 * MouseConstraint, and a public `addCard` API exposed through a ref.
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
import styles from './PhysicsCanvas.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhysicsCard {
  id: string;
  label: string;
  sublabel?: string;
  color?: string;
}

export interface PhysicsCanvasHandle {
  addCard: (label: string, sublabel?: string, color?: string) => void;
  clear: () => void;
  toggleGravity: () => void;
}

interface CardBody extends Matter.Body {
  _card: PhysicsCard;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CARD_WIDTH = 160;
const CARD_HEIGHT = 54;
const CARD_RADIUS = 10;
const WALL_THICKNESS = 60;
const GRAVITY_DEFAULT = 1;

const CARD_COLORS: Record<string, string> = {
  ts: '#3b82f6',
  tsx: '#3b82f6',
  js: '#f59e0b',
  jsx: '#f59e0b',
  json: '#10b981',
  css: '#a855f7',
  md: '#6b7280',
  default: '#6366f1',
};

function getColorForLabel(label: string): string {
  const ext = label.split('.').pop()?.toLowerCase() ?? '';
  return CARD_COLORS[ext] ?? CARD_COLORS['default']!;
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
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
// Component
// ---------------------------------------------------------------------------

const PhysicsCanvasInner = forwardRef<PhysicsCanvasHandle>((_props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const rafRef = useRef<number | null>(null);
  const bodiesRef = useRef<CardBody[]>([]);
  const gravityOnRef = useRef(true);
  const [gravityOn, setGravityOn] = useState(true);
  const [cardCount, setCardCount] = useState(0);

  // Expose imperative API
  useImperativeHandle(ref, () => ({
    addCard: (label: string, sublabel?: string, color?: string) => {
      addCardInternal(label, sublabel, color);
    },
    clear: () => {
      if (!engineRef.current) return;
      const toRemove = bodiesRef.current.map((b) => b as Matter.Body);
      Matter.World.remove(engineRef.current.world, toRemove);
      bodiesRef.current = [];
      setCardCount(0);
    },
    toggleGravity: () => {
      toggleGravityInternal();
    },
  }));

  const addCardInternal = useCallback(
    (label: string, sublabel?: string, color?: string) => {
      const engine = engineRef.current;
      const canvas = canvasRef.current;
      if (!engine || !canvas) return;

      const w = canvas.width;

      const x = WALL_THICKNESS + CARD_WIDTH / 2 + Math.random() * (w - WALL_THICKNESS * 2 - CARD_WIDTH);
      const y = -CARD_HEIGHT - 10;

      const resolvedColor = color ?? getColorForLabel(label);
      const card: PhysicsCard = { id: `card-${Date.now()}-${Math.random()}`, label, sublabel, color: resolvedColor };

      const body = Matter.Bodies.rectangle(x, y, CARD_WIDTH, CARD_HEIGHT, {
        restitution: 0.4,
        friction: 0.3,
        frictionAir: 0.02,
        label: card.id,
        chamfer: { radius: CARD_RADIUS },
      }) as CardBody;
      body._card = card;

      Matter.World.add(engine.world, body);
      bodiesRef.current.push(body);
      setCardCount((c) => c + 1);
    },
    [],
  );

  const toggleGravityInternal = useCallback(() => {
    if (!engineRef.current) return;
    gravityOnRef.current = !gravityOnRef.current;
    engineRef.current.gravity.y = gravityOnRef.current ? GRAVITY_DEFAULT : 0;
    setGravityOn(gravityOnRef.current);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Size canvas to container
    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width || 600;
      canvas.height = rect.height || 500;
      rebuildWalls();
    };

    // -------------------------------------------------------------------------
    // Matter.js setup
    // -------------------------------------------------------------------------
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: GRAVITY_DEFAULT },
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
      ground = Matter.Bodies.rectangle(w / 2, h + WALL_THICKNESS / 2, w * 2, WALL_THICKNESS, { isStatic: true });
      wallL = Matter.Bodies.rectangle(-WALL_THICKNESS / 2, h / 2, WALL_THICKNESS, h * 2, { isStatic: true });
      wallR = Matter.Bodies.rectangle(w + WALL_THICKNESS / 2, h / 2, WALL_THICKNESS, h * 2, { isStatic: true });
      ceiling = Matter.Bodies.rectangle(w / 2, -WALL_THICKNESS / 2, w * 2, WALL_THICKNESS, { isStatic: true });
      Matter.World.add(engine.world, [ground, wallL, wallR, ceiling]);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // Mouse constraint for dragging
    const mouse = Matter.Mouse.create(canvas);
    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse,
      constraint: {
        stiffness: 0.2,
        render: { visible: false },
      },
    });
    Matter.World.add(engine.world, mouseConstraint);

    // -------------------------------------------------------------------------
    // Runner
    // -------------------------------------------------------------------------
    Matter.Runner.run(runner, engine);

    // -------------------------------------------------------------------------
    // Render loop
    // -------------------------------------------------------------------------
    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      const w = canvas!.width;
      const h = canvas!.height;
      ctx.clearRect(0, 0, w, h);

      // Background grid
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
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

      // Ground indicator line
      ctx.strokeStyle = 'rgba(99,102,241,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, h - 2);
      ctx.lineTo(w, h - 2);
      ctx.stroke();

      // Draw card bodies
      for (const body of bodiesRef.current) {
        const { position: pos, angle } = body;
        const card = body._card;
        const color = card.color ?? '#6366f1';

        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(angle);

        // Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 4;

        // Card background
        drawRoundRect(ctx, -CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);
        ctx.fillStyle = '#1e1e2e';
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Accent left border
        drawRoundRect(ctx, -CARD_WIDTH / 2, -CARD_HEIGHT / 2, 4, CARD_HEIGHT, 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Glow outline
        drawRoundRect(ctx, -CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);
        ctx.strokeStyle = color + '55';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Label text
        ctx.fillStyle = '#e2e8f0';
        ctx.font = `bold 11px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const maxLabelWidth = CARD_WIDTH - 24;
        let labelText = card.label;
        while (ctx.measureText(labelText).width > maxLabelWidth && labelText.length > 4) {
          labelText = labelText.slice(0, -4) + '...';
        }
        ctx.fillText(labelText, -CARD_WIDTH / 2 + 14, card.sublabel ? -CARD_HEIGHT / 2 + 16 : 0);

        // Sub-label
        if (card.sublabel) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = `9px 'JetBrains Mono', monospace`;
          let sub = card.sublabel;
          while (ctx.measureText(sub).width > maxLabelWidth && sub.length > 4) {
            sub = sub.slice(0, -4) + '...';
          }
          ctx.fillText(sub, -CARD_WIDTH / 2 + 14, -CARD_HEIGHT / 2 + 34);
        }

        // Color dot
        ctx.beginPath();
        ctx.arc(CARD_WIDTH / 2 - 12, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.restore();
      }
    };

    render();

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      Matter.Runner.stop(runner);
      Matter.World.clear(engine.world, false);
      Matter.Engine.clear(engine);
      ro.disconnect();
      engineRef.current = null;
      runnerRef.current = null;
      bodiesRef.current = [];
    };
  }, []);

  // Sync open editor tabs as physics cards
  const { tabs } = useEditorStore();
  useEffect(() => {
    // Add a card for newly opened tabs (we track by count)
    // Simple heuristic: add card if tab path not already in bodies
    if (!engineRef.current) return;
    const existingLabels = new Set(bodiesRef.current.map((b) => b._card.label));
    for (const tab of tabs) {
      if (!existingLabels.has(tab.title)) {
        addCardInternal(tab.title, tab.path, getColorForLabel(tab.path));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.length]);

  return (
    <div ref={containerRef} className={styles.container}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <span className={styles.cardCount}>{cardCount} cards</span>
        <button
          className={`${styles.toolbarBtn} ${gravityOn ? styles.active : ''}`}
          onClick={toggleGravityInternal}
          title={gravityOn ? 'Disable Gravity' : 'Enable Gravity'}
        >
          {gravityOn ? '🌍 Gravity ON' : '🚀 Gravity OFF'}
        </button>
        <button
          className={styles.toolbarBtn}
          onClick={() => {
            if (!engineRef.current) return;
            const toRemove = bodiesRef.current.map((b) => b as Matter.Body);
            Matter.World.remove(engineRef.current.world, toRemove);
            bodiesRef.current = [];
            setCardCount(0);
          }}
          title="Clear all cards"
        >
          🗑 Clear
        </button>
        <button
          className={styles.toolbarBtn}
          onClick={() => addCardInternal('New Card', 'drag me!')}
          title="Add a test card"
        >
          ＋ Add Card
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
          <p>Open files to watch them float here</p>
          <p className={styles.emptyHint}>Cards represent your open editor tabs</p>
        </div>
      )}
    </div>
  );
});

PhysicsCanvasInner.displayName = 'PhysicsCanvas';

export const PhysicsCanvas = PhysicsCanvasInner;

