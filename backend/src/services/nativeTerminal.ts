import nodeOs from "node:os";
import nodePath from "node:path";
import{EventEmitter}from"node:events";
import pty from"node-pty";
import{TerminalService,TerminalSession,TerminalSessionOptions}from"@ajson/contracts";

interface ActivePtySession{
  info:TerminalSession;
  pty:pty.IPty;
  dataListeners:Set<(data:string)=>void>;
  exitListeners:Set<(code:number)=>void>;
  cmdStartListeners:Set<(cmd:string)=>void>;
  cmdEndListeners:Set<(cmd:string,code:number)=>void>;
  captureBuffer:string|null;
  cwd:string;
}

function resolveShell(req?:string):string{
  if(process.platform==="win32"){
    if(req==="bash")return"bash.exe";
    if(req==="zsh")return"zsh.exe";
    return process.env.ComSpec??"powershell.exe";
  }
  if(req==="bash")return"/bin/bash";
  if(req==="zsh")return"/bin/zsh";
  if(req==="pwsh")return"pwsh";
  return process.env.SHELL??"/bin/bash";
}

function sanitiseCwd(cwd?:string,root?:string):string{
  if(!cwd)return root??nodeOs.homedir();
  const r=nodePath.resolve(cwd);
  if(root&&!r.startsWith(nodePath.normalize(root)))return nodePath.normalize(root);
  return r;
}

export class NativeTerminalService implements TerminalService{
  private sessions=new Map<string,ActivePtySession>();
  private n=0;
  private root?:string;
  readonly _emitter=new EventEmitter();
  constructor(root?:string){this.root=root;}
  setWorkspaceRoot(r:string|undefined):void{this.root=r;}
  async createSession(o?:TerminalSessionOptions):Promise<string>{
    const n=++this.n;
    const id="pty_"+n+"_"+Date.now();
    const shell=resolveShell(o?.shell);
    const cwd=sanitiseCwd(o?.cwd,this.root);
    const p=pty.spawn(shell,[],{name:"xterm-color",cols:120,rows:30,cwd,env:{...process.env,TERM:"xterm-color",COLORTERM:"truecolor"}as NodeJS.ProcessEnv});
    const s:ActivePtySession={info:{id,title:o?.title??("Terminal "+n),cwd,shell:(o?.shell??(process.platform==="win32"?"pwsh":"bash"))as"bash"|"zsh"|"pwsh",owner:o?.owner??"user",readOnly:o?.readOnly??false,createdAt:Date.now()},pty:p,dataListeners:new Set(),exitListeners:new Set(),cmdStartListeners:new Set(),cmdEndListeners:new Set(),captureBuffer:null,cwd};
    p.onData((chunk:string)=>{if(s.captureBuffer!==null)s.captureBuffer+=chunk;for(const cb of s.dataListeners)try{cb(chunk);}catch{}});
    p.onExit(({exitCode})=>{const c=exitCode??0;for(const cb of s.exitListeners)try{cb(c);}catch{};this.sessions.delete(id);this._emitter.emit("sessionClosed",id);});
    this.sessions.set(id,s);this._emitter.emit("sessionCreated",id);return id;
  }
  write(id:string,data:string):void{const s=this.sessions.get(id);if(!s||s.info.readOnly)return;try{s.pty.write(data);}catch{}}
  resize(id:string,cols:number,rows:number):void{const s=this.sessions.get(id);if(s)try{s.pty.resize(Math.max(1,cols),Math.max(1,rows));}catch{}}
  kill(id:string):void{const s=this.sessions.get(id);if(!s)return;try{s.pty.kill();}catch{};this.sessions.delete(id);this._emitter.emit("sessionClosed",id);}
  listSessions():TerminalSession[]{return[...this.sessions.values()].map(s=>s.info);}
  getCwd(id:string):string{return this.sessions.get(id)?.cwd??"";}
  onData(id:string,cb:(data:string)=>void):()=>void{const s=this.sessions.get(id);if(!s)return()=>{};s.dataListeners.add(cb);return()=>{s.dataListeners.delete(cb);};}
  onExit(id:string,cb:(code:number)=>void):()=>void{const s=this.sessions.get(id);if(!s)return()=>{};s.exitListeners.add(cb);return()=>{s.exitListeners.delete(cb);};}
  onCommandStart(id:string,cb:(cmd:string)=>void):()=>void{const s=this.sessions.get(id);if(!s)return()=>{};s.cmdStartListeners.add(cb);return()=>{s.cmdStartListeners.delete(cb);};}
  onCommandEnd(id:string,cb:(cmd:string,code:number)=>void):()=>void{const s=this.sessions.get(id);if(!s)return()=>{};s.cmdEndListeners.add(cb);return()=>{s.cmdEndListeners.delete(cb);};}
  async runCommand(id:string,cmd:string,opts?:{timeoutMs?:number}):Promise<{exitCode:number;output:string}>{
    const s=this.sessions.get(id);if(!s)throw new Error("Session not found: "+id);
    const timeout=opts?.timeoutMs??30000;
    const sentinel="__AJSON_EXIT_"+id+"_"+Date.now()+"__";
    s.captureBuffer="";
    return new Promise((resolve,reject)=>{
      let done=false;
      const timer=setTimeout(()=>{if(!done){done=true;s.captureBuffer=null;reject(new Error("Timed out"));}},timeout);
      const unbind=this.onData(id,()=>{
        const buf=s.captureBuffer??"";
        const idx=buf.indexOf(sentinel);
        if(idx!==-1&&!done){done=true;clearTimeout(timer);unbind();s.captureBuffer=null;
          const after=buf.slice(idx+sentinel.length).trim();
          resolve({exitCode:parseInt(after,10)||0,output:buf.slice(0,idx)});}});
      const isWin=process.platform==="win32";
      const full=isWin?cmd+"; echo "+sentinel+" $LASTEXITCODE\r\n":cmd+"; echo \""+sentinel+" $?\"\n";
      s.pty.write(full);
    });
  }
  disposeAll():void{for(const[id]of this.sessions)this.kill(id);}
}