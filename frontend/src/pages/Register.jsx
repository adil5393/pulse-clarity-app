import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    const r = await register(email, password, name); setBusy(false);
    if (r.ok) { toast.success("Account created"); nav("/app"); } else toast.error(r.error || "Failed");
  };
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:block relative overflow-hidden bg-gradient-to-br from-cyan-600 via-indigo-700 to-slate-900">
        <div className="absolute inset-0 grid-bg opacity-50"/>
        <div className="relative h-full p-12 flex flex-col justify-between text-white">
          <Link to="/" className="flex items-center gap-2"><div className="w-9 h-9 rounded-lg bg-white/15 grid place-items-center font-bold">P</div><span className="font-semibold">Pulse</span></Link>
          <div>
            <h2 className="text-4xl font-semibold tracking-tight leading-tight">Join the calmer<br/>way to work.</h2>
            <p className="mt-4 text-white/70 max-w-sm">Free forever for small teams. No credit card.</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center p-8 bg-background">
        <form onSubmit={submit} className="w-full max-w-sm" data-testid="register-form">
          <h1 className="text-3xl font-semibold tracking-tight">Create your account</h1>
          <p className="text-muted-foreground mt-2 mb-8">Takes less than 30 seconds</p>
          <div className="space-y-4">
            <div><Label>Full name</Label><Input data-testid="reg-name" required value={name} onChange={e=>setName(e.target.value)} className="mt-1.5"/></div>
            <div><Label>Email</Label><Input data-testid="reg-email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="mt-1.5"/></div>
            <div><Label>Password</Label><Input data-testid="reg-password" type="password" minLength={6} required value={password} onChange={e=>setPassword(e.target.value)} className="mt-1.5"/></div>
            <Button type="submit" disabled={busy} data-testid="reg-submit" className="w-full h-11 bg-primary hover:bg-primary/90">{busy ? "Creating…" : "Create Account"}</Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">Have an account? <Link to="/login" className="text-primary font-medium">Sign in</Link></p>
        </form>
      </div>
    </div>
  );
}
