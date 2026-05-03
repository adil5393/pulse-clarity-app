import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { api, API } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Send, Paperclip, Search, Bell, Moon, Sun, LogOut, Users, MessageCircle, PanelLeftClose, PanelLeftOpen, Trash2, X, FileText } from "lucide-react";
import { useTheme } from "../lib/theme";

function Avi({ name, size="w-10 h-10" }) {
  const initials = (name || "?").split(" ").map(s=>s[0]).slice(0,2).join("").toUpperCase();
  return <Avatar className={size}><AvatarFallback className="bg-gradient-to-br from-primary to-[hsl(var(--accent))] text-white text-sm font-semibold">{initials}</AvatarFallback></Avatar>;
}

export default function Dashboard() {
  const { user, logout, wsSend, addHandler } = useAuth();
  const { theme, toggle } = useTheme();
  const [tab, setTab] = useState("chats");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [convos, setConvos] = useState([]); const [users, setUsers] = useState([]);
  const [active, setActive] = useState(null); const [messages, setMessages] = useState([]);
  const [text, setText] = useState(""); const [search, setSearch] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [typing, setTyping] = useState(null);
  const fileRef = useRef(null);
  const scrollRef = useRef(null);

  const loadConvos = async () => { const { data } = await api.get("/conversations"); setConvos(data); };
  const loadUsers = async (q="") => { const { data } = await api.get(`/users${q ? `?q=${encodeURIComponent(q)}` : ""}`); setUsers(data); };

  useEffect(() => { loadConvos(); loadUsers(); }, []);
  useEffect(() => { if (active) { api.get(`/conversations/${active.id}/messages`).then(r=>setMessages(r.data)); } }, [active?.id]);
  useEffect(() => { scrollRef.current?.scrollTo(0, 9e9); }, [messages]);

  useEffect(() => addHandler((d) => {
    if (d.type === "message") {
      if (active && d.conversation_id === active.id) setMessages(m => [...m, d.message]);
      loadConvos();
    } else if (d.type === "typing") {
      if (active && d.conversation_id === active.id && d.from !== user.id) {
        setTyping(d.from); setTimeout(() => setTyping(null), 2000);
      }
    }
  }), [active, user]);

  const isMobile = () => window.innerWidth < 768;

  const startConvo = async (u) => {
    const { data } = await api.post("/conversations", { user_id: u.id });
    setActive(data); setTab("chats"); loadConvos();
    if (isMobile()) setSidebarOpen(false);
  };

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const isImage = f.type.startsWith("image/");
    const previewUrl = isImage ? URL.createObjectURL(f) : null;
    setPendingFile({ file: f, previewUrl, isImage });
    fileRef.current.value = "";
  };

  const cancelFile = () => {
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
  };

  const send = async () => {
    if (!text.trim() && !pendingFile) return;
    let attachment_id = null;
    if (pendingFile) {
      const fd = new FormData(); fd.append("file", pendingFile.file);
      const { data } = await api.post("/upload", fd);
      attachment_id = data.id;
      cancelFile();
    }
    await api.post(`/conversations/${active.id}/messages`, { text, attachment_id });
    setText("");
  };

  const handleTyping = (v) => {
    setText(v);
    const other = active?.other?.id;
    if (other) wsSend({ type: "typing", to: other, conversation_id: active.id });
  };

  const clearMessages = async () => {
    if (!active) return;
    await api.delete(`/conversations/${active.id}/messages`);
    setMessages([]);
  };

  const filtered = useMemo(() => convos.filter(c => !search || c.other?.name?.toLowerCase().includes(search.toLowerCase())), [convos, search]);

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="h-16 border-b border-border flex items-center justify-between px-4 glass">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(o => !o)} className="p-2 rounded-lg hover:bg-muted grid place-items-center">
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4"/> : <PanelLeftOpen className="w-4 h-4"/>}
          </button>
          <div className="w-9 h-9 rounded-lg bg-primary grid place-items-center text-primary-foreground font-bold">P</div>
          <div className="relative hidden md:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
            <Input data-testid="top-search" placeholder="Search conversations…" value={search} onChange={e=>setSearch(e.target.value)} className="pl-9 w-72 h-9"/>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} data-testid="theme-toggle" className="p-2 rounded-lg hover:bg-muted">{theme==="dark"?<Sun className="w-4 h-4"/>:<Moon className="w-4 h-4"/>}</button>
          <button className="p-2 rounded-lg hover:bg-muted"><Bell className="w-4 h-4"/></button>
          <button onClick={logout} data-testid="logout-btn" className="p-2 rounded-lg hover:bg-muted"><LogOut className="w-4 h-4"/></button>
          <Avi name={user?.name}/>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className={`border-r border-border flex flex-col transition-all duration-200 ${sidebarOpen ? "w-full md:w-80" : "hidden"}`}>
          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-2 mx-3 mt-3">
              <TabsTrigger data-testid="tab-chats" value="chats"><MessageCircle className="w-4 h-4 mr-1.5"/>Chats</TabsTrigger>
              <TabsTrigger data-testid="tab-contacts" value="contacts"><Users className="w-4 h-4 mr-1.5"/>People</TabsTrigger>
            </TabsList>
            <div className="flex-1 overflow-y-auto p-2">
              {tab === "chats" && (filtered.length === 0 ? <p className="text-center text-sm text-muted-foreground p-8">No conversations yet. Start one from People.</p> :
                filtered.map(c => (
                  <button key={c.id} data-testid={`convo-${c.id}`} onClick={()=>{ setActive(c); if(isMobile()) setSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted text-left transition ${active?.id===c.id?"bg-muted":""}`}>
                    <Avi name={c.other?.name}/>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{c.other?.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.last_message?.text || "Say hi 👋"}</div>
                    </div>
                  </button>
                ))
              )}
              {tab === "contacts" && users.map(u => (
                <button key={u.id} data-testid={`user-${u.id}`} onClick={()=>startConvo(u)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted text-left">
                  <Avi name={u.name}/>
                  <div className="flex-1 min-w-0"><div className="font-medium truncate">{u.name}</div><div className="text-xs text-muted-foreground truncate">{u.email}</div></div>
                </button>
              ))}
            </div>
          </Tabs>
        </aside>

        <main className="flex-1 flex flex-col">
          {!active ? (
            <div className="flex-1 grid place-items-center text-center p-8">
              <div>
                <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary grid place-items-center mx-auto mb-4"><MessageCircle className="w-8 h-8"/></div>
                <h2 className="text-xl font-semibold">Select a conversation</h2>
                <p className="text-muted-foreground mt-2">Or start a new one from the People tab.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="h-16 border-b border-border flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                  <Avi name={active.other?.name}/>
                  <div><div className="font-semibold">{active.other?.name}</div><div className="text-xs text-muted-foreground">{active.other?.email}</div></div>
                </div>
                <button onClick={clearMessages} className="p-2.5 rounded-lg hover:bg-muted text-destructive"><Trash2 className="w-5 h-5"/></button>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-3 no-scrollbar">
                {messages.map(m => {
                  const mine = m.sender_id === user.id;
                  return (
                    <div key={m.id} className={`flex ${mine?"justify-end":"justify-start"} msg-in`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${mine?"bg-primary text-primary-foreground rounded-br-md":"bg-muted rounded-bl-md"}`}>
                        {m.attachment_id && <img src={`${API}/files/${m.attachment_id}`} alt="" className="rounded-lg mb-2 max-h-64 object-cover" onError={(e)=>{e.currentTarget.style.display='none'}}/>}
                        {m.text && <div className="text-sm whitespace-pre-wrap break-words">{m.text}</div>}
                        <div className={`text-[10px] mt-1 ${mine?"text-white/70":"text-muted-foreground"}`}>{new Date(m.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
                      </div>
                    </div>
                  );
                })}
                {typing && <div className="flex gap-1.5 items-center px-3"><span className="typing-dot w-1.5 h-1.5 bg-muted-foreground rounded-full"/><span className="typing-dot w-1.5 h-1.5 bg-muted-foreground rounded-full"/><span className="typing-dot w-1.5 h-1.5 bg-muted-foreground rounded-full"/></div>}
              </div>
              {pendingFile && (
                <div className="px-4 pt-3 border-t border-border flex items-center gap-3">
                  {pendingFile.isImage
                    ? <img src={pendingFile.previewUrl} alt="preview" className="h-16 w-16 rounded-lg object-cover border border-border"/>
                    : <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2"><FileText className="w-5 h-5 text-muted-foreground"/><span className="text-sm truncate max-w-[160px]">{pendingFile.file.name}</span></div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{pendingFile.file.name}</p>
                    <p className="text-xs text-muted-foreground">{(pendingFile.file.size/1024).toFixed(1)} KB</p>
                  </div>
                  <button type="button" onClick={cancelFile} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground"><X className="w-4 h-4"/></button>
                </div>
              )}
              <div className="p-4 border-t border-border flex items-end gap-2">
                <button data-testid="attach-btn" onClick={()=>fileRef.current?.click()} className="p-2.5 rounded-lg hover:bg-muted"><Paperclip className="w-5 h-5"/></button>
                <input ref={fileRef} type="file" className="hidden" onChange={onFileChange}/>
                <Input data-testid="chat-input" placeholder="Type a message…" value={text} onChange={e=>handleTyping(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} className="flex-1 h-11"/>
                <Button data-testid="chat-send" onClick={send} className="h-11 bg-primary hover:bg-primary/90"><Send className="w-4 h-4"/></Button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
