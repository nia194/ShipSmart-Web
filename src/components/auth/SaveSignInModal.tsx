import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface SaveSignInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignInComplete?: () => void;
}

export const SaveSignInModal = ({ open, onOpenChange, onSignInComplete }: SaveSignInModalProps) => {
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast({
          title: "Sign in failed",
          description: error.message || "Unable to sign in. Please check your credentials.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Welcome back!",
          description: "Signed in successfully. Your option is being saved.",
        });
        onOpenChange(false);
        onSignInComplete?.();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const { error } = await signUp(email, password, name);
      if (error) {
        toast({
          title: "Sign up failed",
          description: error.message || "Unable to create account.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Account created!",
          description: "Please check your email to confirm your account.",
        });
        // Don't auto-close; let user see the confirmation message
        setEmail("");
        setPassword("");
        setName("");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: 420 }}>
        <DialogHeader>
          <DialogTitle>Save Shipping Option</DialogTitle>
          <DialogDescription>Sign in or create an account to save your favorite shipping options.</DialogDescription>
        </DialogHeader>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button
            onClick={() => setMode("signin")}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 8,
              border: "1.5px solid #e5e7eb",
              background: mode === "signin" ? "#0071e3" : "#fff",
              color: mode === "signin" ? "#fff" : "#111827",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all .2s",
              fontFamily: "'Outfit',sans-serif",
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => setMode("signup")}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 8,
              border: "1.5px solid #e5e7eb",
              background: mode === "signup" ? "#0071e3" : "#fff",
              color: mode === "signup" ? "#fff" : "#111827",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all .2s",
              fontFamily: "'Outfit',sans-serif",
            }}
          >
            Sign Up
          </button>
        </div>

        {mode === "signin" ? (
          <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#9ca3af", marginBottom: 6, textTransform: "uppercase" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 14,
                  fontFamily: "'Outfit',sans-serif",
                  outline: "none",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#9ca3af", marginBottom: 6, textTransform: "uppercase" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 14,
                  fontFamily: "'Outfit',sans-serif",
                  outline: "none",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email || !password}
              style={{
                width: "100%",
                padding: "13px 24px",
                borderRadius: 8,
                border: "none",
                background: loading || !email || !password ? "#d1d5db" : "#0071e3",
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: loading || !email || !password ? "not-allowed" : "pointer",
                transition: "all .2s",
                fontFamily: "'Outfit',sans-serif",
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#9ca3af", marginBottom: 6, textTransform: "uppercase" }}>
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 14,
                  fontFamily: "'Outfit',sans-serif",
                  outline: "none",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#9ca3af", marginBottom: 6, textTransform: "uppercase" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 14,
                  fontFamily: "'Outfit',sans-serif",
                  outline: "none",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#9ca3af", marginBottom: 6, textTransform: "uppercase" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 14,
                  fontFamily: "'Outfit',sans-serif",
                  outline: "none",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email || !password || !name}
              style={{
                width: "100%",
                padding: "13px 24px",
                borderRadius: 8,
                border: "none",
                background: loading || !email || !password || !name ? "#d1d5db" : "#0071e3",
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: loading || !email || !password || !name ? "not-allowed" : "pointer",
                transition: "all .2s",
                fontFamily: "'Outfit',sans-serif",
              }}
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
