import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { RpcRouter } from '../api/router';
import { InProcessTransport, createRpcClient } from '../api/inProcessTransport';
import { AjsonError, ErrorCode } from '@ajson/contracts';

describe('RPC Router & InProcessTransport', () => {
  it('registers and handles RPC methods successfully', async () => {
    const router = new RpcRouter();
    router.register(
      'math.add',
      z.object({ a: z.number(), b: z.number() }),
      async ({ a, b }) => ({ result: a + b })
    );

    const transport = new InProcessTransport(router);
    const client = createRpcClient(transport);

    const res = await client.call<{ result: number }>('math.add', { a: 10, b: 25 });
    expect(res.result).toBe(35);
  });

  it('rejects invalid parameters with JSON-RPC INVALID_PARAMS (-32602)', async () => {
    const router = new RpcRouter();
    router.register(
      'user.greet',
      z.object({ name: z.string().min(2) }),
      async ({ name }) => ({ greeting: `Hello, ${name}` })
    );

    const transport = new InProcessTransport(router);
    const client = createRpcClient(transport);

    await expect(client.call('user.greet', { name: 123 })).rejects.toThrow();
  });

  it('rejects unregistered methods with METHOD_NOT_FOUND (-32601)', async () => {
    const router = new RpcRouter();
    const transport = new InProcessTransport(router);
    const client = createRpcClient(transport);

    await expect(client.call('nonexistent.method')).rejects.toThrow(/Unknown RPC method/i);
  });

  it('propagates AjsonError details cleanly through RPC error response', async () => {
    const router = new RpcRouter();
    router.register('fs.guarded', z.object({}), async () => {
      throw new AjsonError(ErrorCode.PATH_TRAVERSAL, 'Path outside root', { path: '../../evil' });
    });

    const transport = new InProcessTransport(router);
    const client = createRpcClient(transport);

    await expect(client.call('fs.guarded')).rejects.toThrow(/Path outside root/);
  });

  it('supports event pub/sub via transport emit & subscribe', () => {
    const router = new RpcRouter();
    const transport = new InProcessTransport(router);

    const received: unknown[] = [];
    const unsubscribe = transport.subscribe('workspace:changed', (data) => {
      received.push(data);
    });

    transport.emit('workspace:changed', { root: '/test/workspace' });
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ root: '/test/workspace' });

    unsubscribe();
    transport.emit('workspace:changed', { root: '/another' });
    expect(received).toHaveLength(1);
  });
});
