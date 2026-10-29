/**
 * Phase 4 - NativeTerminalService unit tests
 * Uses mock-pty strategy: stubs node-pty so tests run without OS deps.
 */
import{describe,it,expect,vi,beforeEach,afterEach}from"vitest";

// Minimal IPty mock
const mockPtyInstance={
  onData:vi.fn(),
  onExit:vi.fn(),
  write:vi.fn(),
  resize:vi.fn(),
  kill:vi.fn(),
  pid:12345,
};

vi.mock("node-pty",()=>({
  default:{
    spawn:vi.fn(()=>mockPtyInstance),
  },
}));

// Import AFTER mock is set up
const{NativeTerminalService}=await import("../../../backend/src/services/nativeTerminal.js");

describe("NativeTerminalService",()=>{
  let svc:InstanceType<typeof NativeTerminalService>;

  beforeEach(()=>{
    vi.clearAllMocks();
    // Reset mock pty handlers
    mockPtyInstance.onData.mockImplementation(()=>{});
    mockPtyInstance.onExit.mockImplementation(()=>{});
    svc=new NativeTerminalService("/workspace");
  });

  afterEach(()=>{
    svc.disposeAll();
  });

  it("createSession returns a session id",async()=>{
    const id=await svc.createSession({title:"test"});
    expect(typeof id).toBe("string");
    expect(id.startsWith("pty_")).toBe(true);
  });

  it("listSessions shows created session",async()=>{
    await svc.createSession({title:"bash-1"});
    const list=svc.listSessions();
    expect(list.length).toBe(1);
    expect(list[0]!.title).toBe("bash-1");
  });

  it("write delegates to pty.write",async()=>{
    const id=await svc.createSession();
    svc.write(id,"ls");
    expect(mockPtyInstance.write).toHaveBeenCalledWith("ls");
  });

  it("kill removes session and calls pty.kill",async()=>{
    const id=await svc.createSession();
    svc.kill(id);
    expect(mockPtyInstance.kill).toHaveBeenCalled();
    expect(svc.listSessions()).toHaveLength(0);
  });

  it("resize delegates to pty.resize",async()=>{
    const id=await svc.createSession();
    svc.resize(id,80,24);
    expect(mockPtyInstance.resize).toHaveBeenCalledWith(80,24);
  });

  it("getCwd returns empty string for unknown id",()=>{
    expect(svc.getCwd("nonexistent")).toBe("");
  });
});