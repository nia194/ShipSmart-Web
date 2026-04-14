import { LOGOS } from "@/lib/shipping-data";

interface LogoProps {
  name: string;
  sz?: number;
}

export const Logo = ({ name, sz = 32 }: LogoProps) => {
  const l = LOGOS[name] || { bg: "#6b7280", c: "#fff", t: name?.slice(0, 2) };
  return (
    <div
      style={{
        width: sz, height: sz, borderRadius: sz * 0.26, background: l.bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: l.c, fontSize: sz * 0.28, fontWeight: 800, flexShrink: 0,
      }}
    >
      {l.t}
    </div>
  );
};
