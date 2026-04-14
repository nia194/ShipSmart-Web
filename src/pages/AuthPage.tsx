import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !pass) { setErr("All fields required"); return; }
    if (!email.includes("@")) { setErr("Invalid email"); return; }
    if (mode === "signup" && !name) { setErr("Name required"); return; }
    if (mode === "signup" && pass.length < 6) { setErr("Min 6 characters"); return; }

    setLoading(true);
    setErr("");

    const result = mode === "login"
      ? await signIn(email, pass)
      : await signUp(email, pass, name);

    setLoading(false);

    if (result.error) {
      setErr(result.error.message);
    } else {
      if (mode === "signup") {
        toast({ title: "Account created!", description: "Check your email to verify your account." });
      }
      navigate("/");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8fa", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400, animation: "fadeUp .4s both" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#0071e3", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 17, fontWeight: 800 }}>S</div>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.5px" }}>ShipSmart</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-1px", marginBottom: 6 }}>
            {mode === "login" ? "Welcome back" : "Create account"}
          </h1>
          <p style={{ color: "#9ca3af", fontSize: 14 }}>
            {mode === "login" ? "Sign in to access saved services" : "Save services and track price changes"}
          </p>
        </div>

        <form onSubmit={submit} style={{ background: "#fff", borderRadius: 16, padding: "28px 24px", boxShadow: "0 1px 20px rgba(0,0,0,.04)" }}>
          {err && <div style={{ padding: "8px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 12, fontWeight: 600, marginBottom: 14 }}>{err}</div>}

          {mode === "signup" && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".8px" }}>Full Name</label>
              <input className="ss-inp" placeholder="John Doe" value={name} onChange={e => { setName(e.target.value); setErr(""); }} />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".8px" }}>Email</label>
            <input className="ss-inp" type="email" placeholder="you@example.com" value={email} onChange={e => { setEmail(e.target.value); setErr(""); }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".8px" }}>Password</label>
            <input className="ss-inp" type="password" placeholder={mode === "signup" ? "Min 6 characters" : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"} value={pass} onChange={e => { setPass(e.target.value); setErr(""); }} />
          </div>

          <button type="submit" className="ss-btn ss-btn-primary" disabled={loading}>
            {loading ? "Loading..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#9ca3af" }}>
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <span className="ss-link" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(""); }}>
            {mode === "login" ? "Create one" : "Sign in"}
          </span>
        </p>
        <p style={{ textAlign: "center", marginTop: 8, fontSize: 12, color: "#b0b5c0" }}>
          Or <span className="ss-link" onClick={() => navigate("/")} style={{ fontWeight: 500, color: "#9ca3af" }}>continue as guest</span>
        </p>
      </div>
    </div>
  );
}
