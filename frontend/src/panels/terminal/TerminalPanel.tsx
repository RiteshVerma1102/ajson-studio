import React,{useState,useEffect,useRef,useCallback}from"react";
import{Terminal as TerminalIcon,Plus,X,Trash2}from"lucide-react";
import{Terminal as XTerm}from"@xterm/xterm";
import{FitAddon}from"@xterm/addon-fit";
import{WebLinksAddon}from"@xterm/addon-web-links";
import{terminalService,TerminalSession,isDesktopBridgeAvailable}from"../../services";
import{IconButton}from"../../components/IconButton/IconButton";
import"@xterm/xterm/css/xterm.css";
import styles from"./TerminalPanel.module.css";

const XTERM_THEME={background:"#06080E",foreground:"#C4CFE0",cursor:"#7B9CEA",cursorAccent:"#06080E",selectionBackground:"rgba(123,156,234,0.25)",black:"#0C1019",red:"#E06C75",green:"#56BA5B",yellow:"#E5C07B",blue:"#7B9CEA",magenta:"#C678DD",cyan:"#56B6C2",white:"#ABB2BF",brightBlack:"#4B5263",brightRed:"#E06C75",brightGreen:"#56BA5B",brightYellow:"#E5C07B",brightBlue:"#7B9CEA",brightMagenta:"#C678DD",brightCyan:"#56B6C2",brightWhite:"#FFFFFF"};

interface TabState{
  session:TerminalSession;
  xterm:XTerm|null;
  fitAddon:FitAddon|null;
  unbindData:(()=>void)|null;
  unbindExit:(()=>void)|null;
}

export const TerminalPanel:React.FC=()=>{
  const[tabs,setTabs]=useState<Map<string,TabState>>(new Map());
  const[activeId,setActiveId]=useState<string|null>(null);
  const xtermContainerRef=useRef<HTMLDivElement|null>(null);
  const isElectron=isDesktopBridgeAvailable();
  const[outputLines,setOutputLines]=useState<string[]>([]);
  const[inputVal,setInputVal]=useState("");
  const[sessions,setSessions]=useState<TerminalSession[]>([]);
  const outputEndRef=useRef<HTMLDivElement|null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const createTab=useCallback(async(title?:string)=>{
    const id=await terminalService.createSession({title});
    if (!isMountedRef.current) return;
    const list=terminalService.listSessions();
    const found=list.find(s=>s.id===id)??{id,title:title??"Terminal",cwd:"",shell:"bash"as const,owner:"user"as const,readOnly:false,createdAt:Date.now()};
    setTabs(prev=>{const m=new Map(prev);m.set(id,{session:found,xterm:null,fitAddon:null,unbindData:null,unbindExit:null});return m;});
    setSessions(terminalService.listSessions());
    setActiveId(id);
  },[]);

  const mountXterm=useCallback((id:string,container:HTMLDivElement)=>{
    setTabs(prev=>{
      const tab=prev.get(id);
      if(!tab)return prev;
      if(tab.xterm){
        if(!container.contains(tab.xterm.element??null))tab.xterm.open(container);
        tab.fitAddon?.fit();
        return prev;
      }
      const term=new XTerm({theme:XTERM_THEME,fontFamily:"JetBrains Mono,Fira Code,monospace",fontSize:13,lineHeight:1.5,cursorBlink:true,allowTransparency:true,scrollback:5000});
      const fitAddon=new FitAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon());
      term.open(container);
      fitAddon.fit();
      const unbindData=terminalService.onData(id,chunk=>{term.write(chunk);});
      term.onData(input=>{terminalService.write(id,input);});
      const ro=new ResizeObserver(()=>{fitAddon.fit();terminalService.resize(id,term.cols,term.rows);});
      ro.observe(container);
      const unbindExit=terminalService.onExit(id,()=>{term.writeln("\r\n\x1b[2m[Process exited]\x1b[0m");ro.disconnect();});
      const updated=new Map(prev);
      updated.set(id,{session:tab.session,xterm:term,fitAddon,unbindData,unbindExit});
      return updated;
    });
  },[]);

  useEffect(()=>{
    if(!isElectron||!activeId||!xtermContainerRef.current)return;
    mountXterm(activeId,xtermContainerRef.current);
  },[activeId,isElectron,mountXterm]);

  useEffect(()=>{
    const existing=terminalService.listSessions();
    if(existing.length===0)void createTab("bash");
    else{setSessions(existing);setActiveId(existing[0]!.id);}
  },[createTab]);

  useEffect(()=>{
    if(isElectron||!activeId)return;
    const unbind=terminalService.onData(activeId,chunk=>{setOutputLines(prev=>[...prev,chunk]);});
    return()=>unbind();
  },[activeId,isElectron]);

  useEffect(()=>{if(!isElectron)outputEndRef.current?.scrollIntoView({behavior:"smooth"});},[outputLines,isElectron]);

  const handleKillTab=(id:string,e:React.MouseEvent)=>{
    e.stopPropagation();
    const tab=tabs.get(id);
    if(tab){tab.unbindData?.();tab.unbindExit?.();tab.xterm?.dispose();}
    terminalService.kill(id);
    const m=new Map(tabs);m.delete(id);setTabs(m);
    setSessions(terminalService.listSessions());
    if(activeId===id){const rem=[...m.keys()];setActiveId(rem[0]??null);}
  };

  const handleClear=()=>{
    if(isElectron)tabs.get(activeId??"")?.xterm?.clear();
    else setOutputLines([]);
  };

  const handleKeyDown=(e:React.KeyboardEvent<HTMLInputElement>)=>{
    if(e.key==="Enter"&&activeId){terminalService.write(activeId,inputVal+"\n");setInputVal("");}
  };

  const allSessions=isElectron?[...tabs.values()].map(t=>t.session):sessions;

  return(
    <div className={styles.container}>
      <div className={styles.tabBar}>
        <div className={styles.sessionTabs}>
          {allSessions.map(s=>(<div key={s.id} className={styles.tab+" "+(s.id===activeId?styles.activeTab:"")} onClick={()=>setActiveId(s.id)}><TerminalIcon size={12} color="var(--accent)"/><span>{s.title}</span><button className={styles.closeBtn} onClick={e=>handleKillTab(s.id,e)} title="Kill Terminal"><X size={10}/></button></div>))}
          <IconButton label="New Terminal" size="sm" onClick={()=>void createTab("bash "+(allSessions.length+1))}><Plus size={13}/></IconButton>
        </div>
        <IconButton label="Clear Terminal" size="sm" onClick={handleClear}><Trash2 size={13}/></IconButton>
      </div>
      {isElectron?(
        <div ref={xtermContainerRef} className={styles.xtermContainer}/>
      ):(
        <>
          <div className={styles.terminalBody}>
            {outputLines.map((line,idx)=>(<div key={idx} className={styles.line}>{line}</div>))}
            <div ref={outputEndRef}/>
          </div>
          <div className={styles.inputRow}>
            <span className={styles.promptPrefix}>ajson-studio@desktop:~/workspace$</span>
            <input className={styles.terminalInput} value={inputVal} onChange={e=>setInputVal(e.target.value)} onKeyDown={handleKeyDown} placeholder="Type command..." autoFocus/>
          </div>
        </>
      )}
    </div>
  );
};