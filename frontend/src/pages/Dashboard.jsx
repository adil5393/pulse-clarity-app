import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { api, API } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Phone, Video, Send, Paperclip, Search, Bell, Moon, Sun, LogOut, Settings, Users, MessageCircle, PhoneCall, X, Mic, MicOff, VideoOff, PhoneOff } from "lucide-react";
import { useTheme } from "../lib/theme";
import { toast } from "sonner";

function Avi({ name, size="w-10 h-10" }) {
  const initials = (name || "?").split(" ").map(s=>s[0]).slice(0,2).join("").toUpperCase();
  return <Avatar className={size}><AvatarFallback className="bg-gradient-to-br from-primary to-[hsl(var(--accent))] text-white text-sm font-semibold">{initials}</AvatarFallback></Avatar>;
}

function CallUI({ call, onEnd, localStream, remoteStream }) {
  const localRef = useRef(); const remoteRef = useRef();
  const [muted, setMuted] = useState(false); const [camOff, setCamOff] = useState(false);
  const [sec, setSec] = useState(0);
  useEffect(() => { if (localStream && localRef.current) localRef.current.srcObject = localStream; }, [localStream]);
  useEffect(() => { if (remoteStream && remoteRef.current) remoteRef.current.srcObject = remoteStream; }, [remoteStream]);
  useEffect(() => { const t = setInterval(() => setSec(s=>s+1), 1000); return () => clearInterval(t); }, []);
  const mm = String(Math.floor(sec/60)).padStart(2,"0"); const ss = String(sec%60).padStart(2,"0");
  const toggleMute = () => { localStream?.getAudioTracks().forEach(t=>t.enabled=!t.enabled); setMuted(m=>!m); };
  const toggleCam = () => { localStream?.getVideoTracks().forEach(t=>t.enabled=!t.enabled); setCamOff(c=>!c); };
  return (
    <div className="fixed inset-0 z-50 bg-slate-950" data-testid="call-ui">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-900 to-cyan-950"/>
      {call.type === "video" ? (
        <>
          <video ref={remoteRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover"/>
          <video ref={localRef} autoPlay playsInline muted className="absolute bottom-28 right-6 w-40 h-56 rounded-2xl object-cover border-2 border-white/20 shadow-2xl"/>
        </>
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="relative inline-block"><div className="w-44 h-44 rounded-full bg-gradient-to-br from-primary to-[hsl(var(--accent))] ripple"/></div>
            <div className="mt-8 text-white text-2xl font-semibold">{call.peer?.name}</div>
            <div className="mt-2 text-white/60 tabular-nums">{mm}:{ss}</div>
          </div>
        </div>
      )}
      <div className="absolute top-6 left-6 glass rounded-full px-4 py-2 text-white text-sm tabular-nums">{mm}:{ss}</div>
      <div className="absolute bottom-8 inset-x-0 flex justify-center">
        <div className="glass rounded-full p-3 flex gap-3">
          <button data-testid="call-mute" onClick={toggleMute} className={`w-14 h-14 rounded-full grid place-items-center text-white transition ${muted ? 'bg-white/80 text-slate-900' : 'bg-white/10 hover:bg-white/20'}`}>{muted ? <MicOff className="w-5 h-5"/> : <Mic className="w-5 h-5"/>}</button>
          {call.type === "video" && <button data-testid="call-cam" onClick={toggleCam} className={`w-14 h-14 rounded-full grid place-items-center text-white ${camOff ? 'bg-white/80 text-slate-900' : 'bg-white/10 hover:bg-white/20'}`}>{camOff ? <VideoOff className="w-5 h-5"/> : <Video className="w-5 h-5"/>}</button>}
          <button data-testid="call-end" onClick={onEnd} className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 grid place-items-center text-white"><PhoneOff className="w-5 h-5"/></button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, logout, wsSend, addHandler } = useAuth();
  const { theme, toggle } = useTheme();
  const [tab, setTab] = useState("chats");
  const [convos, setConvos] = useState([]); const [users, setUsers] = useState([]);
  const [active, setActive] = useState(null); const [messages, setMessages] = useState([]);
  const [text, setText] = useState(""); const [search, setSearch] = useState("");
  const [typing, setTyping] = useState(null);
  const [call, setCall] = useState(null); const [incoming, setIncoming] = useState(null);
  const [localStream, setLocalStream] = useState(null); const [remoteStream, setRemoteStream] = useState(null);
  const pcRef = useRef(null); const fileRef = useRef(null);
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
    } else if (d.type === "call_ring") {
      setIncoming({ from: d.from, peer: d.peer, callType: d.callType });
    } else if (d.type === "call_offer") { handleOffer(d); }
    else if (d.type === "call_answer") { pcRef.current?.setRemoteDescription(d.sdp); }
    else if (d.type === "call_ice") { try { pcRef.current?.addIceCandidate(d.candidate); } catch {} }
    else if (d.type === "call_end") { endCall(); }
  }), [active, user]);

  const startConvo = async (u) => {
    const { data } = await api.post("/conversations", { user_id: u.id });
    setActive(data); setTab("chats"); loadConvos();
  };

  const send = async () => {
    if (!text.trim() && !fileRef.current?.files?.[0]) return;
    let attachment_id = null;
    const f = fileRef.current?.files?.[0];
    if (f) {
      const fd = new FormData(); fd.append("file", f);
      const { data } = await api.post("/upload", fd); attachment_id = data.id;
      fileRef.current.value = "";
    }
    await api.post(`/conversations/${active.id}/messages`, { text, attachment_id });
    setText("");
  };

  const handleTyping = (v) => {
    setText(v);
    const other = active?.other?.id;
    if (other) wsSend({ type: "typing", to: other, conversation_id: active.id });
  };

  // ---- WebRTC ----
  const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
  const setupPC = (to) => {
    const pc = new RTCPeerConnection(rtcConfig);
    pc.onicecandidate = (e) => e.candidate && wsSend({ type: "call_ice", to, candidate: e.candidate });
    pc.ontrack = (e) => setRemoteStream(e.streams[0]);
    pcRef.current = pc; return pc;
  };
  const startCall = async (type) => {
    if (!active?.other) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
    setLocalStream(stream);
    const pc = setupPC(active.other.id);
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    wsSend({ type: "call_ring", to: active.other.id, peer: { id: user.id, name: user.name }, callType: type });
    wsSend({ type: "call_offer", to: active.other.id, sdp: offer, callType: type });
    setCall({ type, peer: active.other });
  };
  const handleOffer = async (d) => {
    const type = d.callType || "video";
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
    setLocalStream(stream);
    const pc = setupPC(d.from);
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    await pc.setRemoteDescription(d.sdp);
    const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
    wsSend({ type: "call_answer", to: d.from, sdp: answer });
    setIncoming(null);
    setCall({ type, peer: { id: d.from, name: incoming?.peer?.name || "Caller" } });
  };
  const acceptIncoming = () => { /* offer already setting up on reception */ };
  const endCall = () => {
    try { pcRef.current?.close(); } catch {} pcRef.current = null;
    localStream?.getTracks().forEach(t=>t.stop());
    if (call?.peer) wsSend({ type: "call_end", to: call.peer.id });
    setCall(null); setLocalStream(null); setRemoteStream(null); setIncoming(null);
  };

  const filtered = useMemo(() => convos.filter(c => !search || c.other?.name?.toLowerCase().includes(search.toLowerCase())), [convos, search]);

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="h-16 border-b border-border flex items-center justify-between px-4 glass">
        <div className="flex items-center gap-3">
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
        <aside className="w-full md:w-80 border-r border-border flex flex-col">
          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-3 mx-3 mt-3">
              <TabsTrigger data-testid="tab-chats" value="chats"><MessageCircle className="w-4 h-4 mr-1.5"/>Chats</TabsTrigger>
              <TabsTrigger data-testid="tab-calls" value="calls"><PhoneCall className="w-4 h-4 mr-1.5"/>Calls</TabsTrigger>
              <TabsTrigger data-testid="tab-contacts" value="contacts"><Users className="w-4 h-4 mr-1.5"/>People</TabsTrigger>
            </TabsList>
            <div className="flex-1 overflow-y-auto p-2">
              {tab === "chats" && (filtered.length === 0 ? <p className="text-center text-sm text-muted-foreground p-8">No conversations yet. Start one from People.</p> :
                filtered.map(c => (
                  <button key={c.id} data-testid={`convo-${c.id}`} onClick={()=>setActive(c)} className={`w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted text-left transition ${active?.id===c.id?"bg-muted":""}`}>
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
              {tab === "calls" && <p className="text-center text-sm text-muted-foreground p-8">Call history will appear here.</p>}
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
                <div className="flex items-center gap-3"><Avi name={active.other?.name}/><div><div className="font-semibold">{active.other?.name}</div><div className="text-xs text-[hsl(var(--success))]">online</div></div></div>
                <div className="flex gap-1">
                  <button data-testid="start-voice" onClick={()=>startCall("voice")} className="p-2.5 rounded-lg hover:bg-muted text-primary"><Phone className="w-5 h-5"/></button>
                  <button data-testid="start-video" onClick={()=>startCall("video")} className="p-2.5 rounded-lg hover:bg-muted text-primary"><Video className="w-5 h-5"/></button>
                </div>
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
              <div className="p-4 border-t border-border flex items-end gap-2">
                <button data-testid="attach-btn" onClick={()=>fileRef.current?.click()} className="p-2.5 rounded-lg hover:bg-muted"><Paperclip className="w-5 h-5"/></button>
                <input ref={fileRef} type="file" className="hidden" onChange={()=>toast.success("File ready to send")}/>
                <Input data-testid="chat-input" placeholder="Type a message…" value={text} onChange={e=>handleTyping(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} className="flex-1 h-11"/>
                <Button data-testid="chat-send" onClick={send} className="h-11 bg-primary hover:bg-primary/90"><Send className="w-4 h-4"/></Button>
              </div>
            </>
          )}
        </main>
      </div>

      {incoming && !call && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 backdrop-blur-sm" data-testid="incoming-call">
          <div className="glass rounded-3xl p-8 w-80 text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary to-[hsl(var(--accent))] mb-4 ripple"/>
            <div className="text-lg font-semibold">{incoming.peer?.name || "Incoming"}</div>
            <div className="text-sm text-muted-foreground mt-1">{incoming.callType === "video" ? "Video call" : "Voice call"}…</div>
            <div className="flex gap-3 mt-6 justify-center">
              <button onClick={()=>setIncoming(null)} data-testid="decline-call" className="w-14 h-14 rounded-full bg-red-500 text-white grid place-items-center"><PhoneOff className="w-5 h-5"/></button>
              <button onClick={acceptIncoming} data-testid="accept-call" className="w-14 h-14 rounded-full bg-[hsl(var(--success))] text-white grid place-items-center"><Phone className="w-5 h-5"/></button>
            </div>
          </div>
        </div>
      )}

      {call && <CallUI call={call} onEnd={endCall} localStream={localStream} remoteStream={remoteStream}/>}
    </div>
  );
}
