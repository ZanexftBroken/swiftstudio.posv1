export interface ThemeConfig {
  id: string;
  name: string;
  bgOuter: string;
  bgInner: string;
  border: string;
  borderHover: string;
  textPrimary: string;
  textSecondary: string;
  textAccent: string;
  bgAccent: string;
  borderAccent: string;
  gradient: string;
  gradientBtn: string;
  glow1: string;
  glow2: string;
  buttonText: string;
  isLight?: boolean;
}

export const THEMES: Record<string, ThemeConfig> = {
  "liquid-glass-ios26": {
    id: "liquid-glass-ios26",
    name: "Liquid Glass (Aurora Cyan)",
    bgOuter: "bg-[#03050d]",
    bgInner: "bg-slate-950/45 backdrop-blur-3xl shadow-[0_32px_80px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(255,255,255,0.15)]",
    border: "border-white/10",
    borderHover: "hover:border-cyan-400/40 hover:shadow-[0_0_30px_rgba(34,211,238,0.18)] hover:bg-white/[0.05]",
    textPrimary: "text-white",
    textSecondary: "text-slate-400",
    textAccent: "text-cyan-400",
    bgAccent: "bg-cyan-500/10",
    borderAccent: "border-cyan-500/20",
    gradient: "from-cyan-400 via-sky-500 to-indigo-500",
    gradientBtn: "from-cyan-500 to-blue-600",
    glow1: "bg-cyan-500/20",
    glow2: "bg-blue-600/15",
    buttonText: "text-white"
  },
  "liquid-glass-emerald": {
    id: "liquid-glass-emerald",
    name: "Liquid Glass (Forest Mint)",
    bgOuter: "bg-[#010604]",
    bgInner: "bg-slate-950/45 backdrop-blur-3xl shadow-[0_32px_80px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(255,255,255,0.15)]",
    border: "border-white/10",
    borderHover: "hover:border-emerald-400/40 hover:shadow-[0_0_30px_rgba(52,211,153,0.18)] hover:bg-white/[0.05]",
    textPrimary: "text-white",
    textSecondary: "text-slate-400",
    textAccent: "text-emerald-400",
    bgAccent: "bg-emerald-500/10",
    borderAccent: "border-emerald-500/20",
    gradient: "from-emerald-400 via-teal-500 to-cyan-500",
    gradientBtn: "from-emerald-500 to-teal-600",
    glow1: "bg-emerald-500/20",
    glow2: "bg-teal-600/15",
    buttonText: "text-white"
  },
  "liquid-glass-sunset": {
    id: "liquid-glass-sunset",
    name: "Liquid Glass (Amethyst Sunset)",
    bgOuter: "bg-[#06020c]",
    bgInner: "bg-slate-950/45 backdrop-blur-3xl shadow-[0_32px_80px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(255,255,255,0.15)]",
    border: "border-white/10",
    borderHover: "hover:border-purple-400/40 hover:shadow-[0_0_30px_rgba(192,132,252,0.18)] hover:bg-white/[0.05]",
    textPrimary: "text-white",
    textSecondary: "text-slate-400",
    textAccent: "text-purple-400",
    bgAccent: "bg-purple-500/10",
    borderAccent: "border-purple-500/20",
    gradient: "from-purple-400 via-pink-500 to-amber-500",
    gradientBtn: "from-purple-500 to-pink-600",
    glow1: "bg-purple-500/20",
    glow2: "bg-pink-600/15",
    buttonText: "text-white"
  },
  "immersive-glass": {
    id: "immersive-glass",
    name: "Immersive UI (Glass)",
    bgOuter: "bg-[#030712]",
    bgInner: "bg-[#090d16]/70 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(99,102,241,0.08)]",
    border: "border-white/10",
    borderHover: "hover:border-indigo-400/30 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]",
    textPrimary: "text-white",
    textSecondary: "text-slate-400",
    textAccent: "text-indigo-400",
    bgAccent: "bg-indigo-500/10",
    borderAccent: "border-indigo-500/20",
    gradient: "from-indigo-500 via-purple-500 to-cyan-400",
    gradientBtn: "from-indigo-600 to-cyan-500",
    glow1: "bg-indigo-600/10",
    glow2: "bg-cyan-600/10",
    buttonText: "text-white"
  },
  "cosmic-indigo": {
    id: "cosmic-indigo",
    name: "Cosmic Indigo",
    bgOuter: "bg-[#050505]",
    bgInner: "bg-[#0a0a0a]/80 backdrop-blur-md",
    border: "border-white/5",
    borderHover: "hover:border-indigo-500/20",
    textPrimary: "text-white",
    textSecondary: "text-slate-400",
    textAccent: "text-indigo-400",
    bgAccent: "bg-indigo-500/10",
    borderAccent: "border-indigo-500/20",
    gradient: "from-indigo-500 via-purple-500 to-pink-500",
    gradientBtn: "from-indigo-500 to-purple-500",
    glow1: "bg-indigo-600/10",
    glow2: "bg-purple-600/10",
    buttonText: "text-white"
  },
  "emerald-mint": {
    id: "emerald-mint",
    name: "Emerald Mint",
    bgOuter: "bg-[#020806]",
    bgInner: "bg-[#031410]/80 backdrop-blur-md",
    border: "border-emerald-500/10",
    borderHover: "hover:border-emerald-500/30",
    textPrimary: "text-white",
    textSecondary: "text-emerald-300/60",
    textAccent: "text-emerald-400",
    bgAccent: "bg-emerald-500/10",
    borderAccent: "border-emerald-500/20",
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    gradientBtn: "from-emerald-500 to-teal-500",
    glow1: "bg-emerald-600/10",
    glow2: "bg-teal-600/10",
    buttonText: "text-white"
  },
  "cyberpunk-amber": {
    id: "cyberpunk-amber",
    name: "Cyberpunk Amber",
    bgOuter: "bg-[#080500]",
    bgInner: "bg-[#140f03]/80 backdrop-blur-md",
    border: "border-amber-500/10",
    borderHover: "hover:border-amber-500/30",
    textPrimary: "text-white",
    textSecondary: "text-amber-300/50",
    textAccent: "text-amber-400",
    bgAccent: "bg-amber-500/10",
    borderAccent: "border-amber-500/20",
    gradient: "from-amber-500 via-orange-500 to-rose-500",
    gradientBtn: "from-amber-500 to-orange-500",
    glow1: "bg-amber-600/10",
    glow2: "bg-orange-600/10",
    buttonText: "text-white"
  },
  "velvet-rose": {
    id: "velvet-rose",
    name: "Velvet Rose",
    bgOuter: "bg-[#080205]",
    bgInner: "bg-[#14030d]/80 backdrop-blur-md",
    border: "border-rose-500/10",
    borderHover: "hover:border-rose-500/30",
    textPrimary: "text-white",
    textSecondary: "text-rose-300/50",
    textAccent: "text-rose-400",
    bgAccent: "bg-rose-500/10",
    borderAccent: "border-rose-500/20",
    gradient: "from-rose-500 via-pink-500 to-purple-500",
    gradientBtn: "from-rose-500 to-pink-500",
    glow1: "bg-rose-600/10",
    glow2: "bg-purple-600/10",
    buttonText: "text-white"
  },
  "classic-light": {
    id: "classic-light",
    name: "Classic Light",
    bgOuter: "bg-[#f8fafc]",
    bgInner: "bg-white border-slate-200/80 shadow-md",
    border: "border-slate-200",
    borderHover: "hover:border-indigo-400/50 hover:shadow-lg",
    textPrimary: "text-slate-800",
    textSecondary: "text-slate-500",
    textAccent: "text-indigo-600",
    bgAccent: "bg-indigo-50 border-indigo-100",
    borderAccent: "border-indigo-100",
    gradient: "from-indigo-600 via-blue-600 to-sky-600",
    gradientBtn: "from-indigo-600 to-blue-600",
    glow1: "bg-indigo-400/5",
    glow2: "bg-blue-400/5",
    buttonText: "text-white",
    isLight: true
  }
};

export function getTheme(themeName?: string): ThemeConfig {
  return THEMES[themeName || "immersive-glass"] || THEMES["immersive-glass"];
}
