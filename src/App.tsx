import React, { useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter as DialogFooterUI, DialogHeader as DialogHeaderUI, DialogTitle as DialogTitleUI } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Calendar, Check, ChevronLeft, ChevronRight, Clock, Heart, Home, LineChart, MessageSquare, School, Search, Sparkles, Stars, Video, LogIn, User, LogOut } from "lucide-react";
import { GraduationCap } from "lucide-react";

/************** TYPES **************/
export type Screen = "landing" | "onboarding" | "dashboard" | "tutors" | "buddies" | "community" | "live" | "progress";
type Role = "student" | "tutor" | null;

/************** UTIL & STORAGE **************/
const cn = (...args: (string | false | undefined)[]) => args.filter(Boolean).join(" ");
const storage = {
  get<T>(k: string, fallback: T): T {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },

  set<T>(k: string, v: T) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },

  del(k: string) {
    try {
      localStorage.removeItem(k);
    } catch {}
  },

  clearAll() {
    // wipe known keys
    const KEYS = [
      "auth",
      "profile",
      "streak",
      "feed",
      "weakness",
      "name",
      "tasks_today",
      "pymk",
      "quizSubjects",
      "saved_tutors",
    ];
    KEYS.forEach((k) => this.del(k));

    // wipe all tutor threads
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith("tutor_thread_")) {
        localStorage.removeItem(k);
      }
    });
  },
};

const cryptoId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const timeShort = (ts: number) => { const d = new Date(ts); const hh = d.getHours().toString().padStart(2, "0"); const mm = d.getMinutes().toString().padStart(2, "0"); return `${hh}:${mm}`; };
const getInitialStreak = () => Number(localStorage.getItem("streak") || 0);

/************** MOCK DATA **************/
const MOCK_TUTORS = [
  { id: 1, name: "Tutor Aisha", subject: "Mathematics", rating: 4.9, price: 25, bio: "Ex-competition coach, makes algebra fun.", availability: ["Mon 8pm", "Wed 9pm", "Sat 10am"] },
  { id: 2, name: "Tutor Ben", subject: "English", rating: 4.7, price: 22, bio: "Essay structure & IELTS tips.", availability: ["Tue 8pm", "Thu 8pm"] },
  { id: 3, name: "Tutor Chen", subject: "Physics", rating: 4.8, price: 28, bio: "Concept-first explanations with demos.", availability: ["Sat 2pm", "Sun 11am"] },
];
const MOCK_BUDDIES = [
  { id: 11, name: "Alex", subject: "Algebra", message: "Focused on quadratics this week." },
  { id: 12, name: "Mika", subject: "Essay Writing", message: "Practicing intros & thesis." },
  { id: 13, name: "Ravi", subject: "Mechanics", message: "Free nightly after 9pm." },
];
const BASE_FEED = [
  { id: 101, name: "Tom", content: "Finished 2 hours of Math today ✅", ts: "2025-08-24" },
  { id: 102, name: "Lisa", content: "Practicing English Essay writing ✍️", ts: "2025-08-25" },
];
const SAMPLE_QUESTIONS = [
  { q: "Solve: 2x + 6 = 14", options: ["x = 4", "x = 6", "x = 8"], correct: 0, topic: "Algebra" },
  { q: "Choose the best thesis statement", options: ["Cats are cute.", "This essay will talk about cats.", "While cats are adored for independence, their care needs are often underestimated."], correct: 2, topic: "Essay Writing" },
  { q: "Which unit is Newton?", options: ["Force", "Energy", "Power"], correct: 0, topic: "Physics" },
];
const SUBJECT_TOPIC_MAP: Record<string, string> = { Mathematics: "Algebra", English: "Essay Writing", Physics: "Physics", Chemistry: "Chemistry", Biology: "Biology" };

// ************ MOCK VIDEO LIBRARY ************
type TutorVideo = { id: string | number; title: string; duration: string; src: string; thumbnail?: string };

const MOCK_TUTOR_VIDEOS: Record<number, TutorVideo[]> = {
  1: [
    { id: "a1", title: "Factoring Quadratics — Quick Tips", duration: "08:42", src: "/videos/aisha_factoring.mp4", thumbnail: "FactorQuadratics.jpg" },
    { id: "a2", title: "Algebra Warm-ups (5 problems)", duration: "12:10", src: "/videos/aisha_warmups.mp4", thumbnail: "/AlgebraWarmup.jpg" },
  ],
  2: [
    { id: "b1", title: "Thesis Statements: Do & Don’t", duration: "06:58", src: "/videos/ben_thesis.mp4", thumbnail: "/thumbs/ben1.jpg" },
  ],
  3: [
    { id: "c1", title: "Newton’s 2nd Law: Worked Examples", duration: "09:33", src: "/videos/chen_n2l.mp4", thumbnail: "/thumbs/chen1.jpg" },
    { id: "c2", title: "Free-Body Diagrams 101", duration: "07:05", src: "/videos/chen_fbd.mp4", thumbnail: "/thumbs/chen2.jpg" },
  ],
};


/************** FEED HELPERS **************/
const getFeed = () => { const local = storage.get<any[]>("feed", []); return [...BASE_FEED, ...local]; };
const pushFeed = (post: any) => { const local = storage.get<any[]>("feed", []); storage.set("feed", [post, ...local]); };

/************** LEVEL INFERENCE **************/
function inferLevelFromScore(correct: number, total: number): "Primary" | "Secondary" | "University" {
  if (total <= 0) return "Secondary"; const pct = correct / total; if (pct < 0.34) return "Primary"; if (pct < 0.67) return "Secondary"; return "University";
}

/************** ROOT APP **************/
export default function App() {
  const [role, setRole] = useState<Role>(null);
  const [screen, setScreen] = useState<Screen>("landing");
  const [authOpen, setAuthOpen] = useState(false);

  const DEFAULTS = { name: "Alex", quizLevel: "Secondary", quizSubjects: ["Mathematics", "English"] as string[], quizAnswers: Array(SAMPLE_QUESTIONS.length).fill(-1) as number[], weakness: [] as string[] };
  const [name, setName] = useState(DEFAULTS.name);
  const [quizLevel, setQuizLevel] = useState(DEFAULTS.quizLevel as "Primary" | "Secondary" | "University" | string);
  const [quizSubjects, setQuizSubjects] = useState<string[]>(DEFAULTS.quizSubjects);
  const [quizAnswers, setQuizAnswers] = useState<number[]>(DEFAULTS.quizAnswers);
  const [weakness, setWeakness] = useState<string[]>(DEFAULTS.weakness);

  useEffect(() => {
    const n = localStorage.getItem("name"); const w = storage.get<string[]>("weakness", []); const auth = storage.get<{ user?: string; role?: Role } | null>("auth", null);
    if (n) setName(n); if (w?.length) setWeakness(w);
    if (auth?.role) { setRole(auth.role); setScreen("dashboard"); }
  }, []);

  const handleLogin = (asRole: "student" | "tutor", email: string) => {
    setRole(asRole); storage.set("auth", { user: email, role: asRole }); setScreen(asRole === "student" ? "onboarding" : "dashboard"); setAuthOpen(false); toast.success(`Welcome ${asRole === "student" ? "student" : "tutor"}!`);
  };
  const handleLogout = () => { setRole(null); storage.del("auth"); setScreen("landing"); toast("Logged out"); };

  const calcResults = () => {
    const activeTopics = new Set(quizSubjects.map(s => SUBJECT_TOPIC_MAP[s]).filter(Boolean));
    const used = SAMPLE_QUESTIONS.map((q, i) => ({ ...q, i })).filter(({ topic }) => (activeTopics.size ? activeTopics.has(topic) : true));
    const missed: Record<string, number> = {}; let correctCount = 0;
    used.forEach(({ i, correct, topic }) => { const ok = quizAnswers[i] === correct; if (ok) correctCount += 1; else missed[topic] = (missed[topic] || 0) + 1; });
    const result = Object.keys(missed); setWeakness(result); storage.set("weakness", result); localStorage.setItem("name", name);
    setQuizLevel(inferLevelFromScore(correctCount, used.length)); setScreen("dashboard");
  };

  const resetAll = () => { storage.clearAll(); setRole(null); setScreen("landing"); setName(DEFAULTS.name); setQuizLevel(DEFAULTS.quizLevel); setQuizSubjects(DEFAULTS.quizLevel as any); setQuizAnswers(DEFAULTS.quizAnswers); setWeakness(DEFAULTS.weakness); toast("Reset complete"); };

  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}

function AppInner() {
  const [role, setRole] = useState<Role>(null);
  const [authOpen, setAuthOpen] = useState(false);

  const DEFAULTS = { name: "Alex", quizLevel: "Secondary", quizSubjects: ["Mathematics", "English"] as string[], quizAnswers: Array(SAMPLE_QUESTIONS.length).fill(-1) as number[], weakness: [] as string[] };
  const [name, setName] = useState(DEFAULTS.name);
  const [quizLevel, setQuizLevel] = useState(DEFAULTS.quizLevel as "Primary" | "Secondary" | "University" | string);
  const [quizSubjects, setQuizSubjects] = useState<string[]>(DEFAULTS.quizSubjects);
  const [quizAnswers, setQuizAnswers] = useState<number[]>(DEFAULTS.quizAnswers);
  const [weakness, setWeakness] = useState<string[]>(DEFAULTS.weakness);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const n = localStorage.getItem("name");
    const w = storage.get<string[]>("weakness", []);
    const auth = storage.get<{ user?: string; role?: Role } | null>("auth", null);
    if (n) setName(n);
    if (w?.length) setWeakness(w);
    if (auth?.role) setRole(auth.role);
  }, []);

  const handleLogin = (asRole: "student" | "tutor", email: string) => {
    setRole(asRole);
    storage.set("auth", { user: email, role: asRole });
    setAuthOpen(false);
    toast.success(`Welcome ${asRole === "student" ? "student" : "tutor"}!`);
    navigate(asRole === "student" ? "/onboarding" : "/dashboard");
  };

  const handleLogout = () => {
    setRole(null);
    storage.del("auth");
    toast("Logged out");
    navigate("/");
  };

  const calcResults = () => {
    const activeTopics = new Set(quizSubjects.map(s => SUBJECT_TOPIC_MAP[s]).filter(Boolean));
    const used = SAMPLE_QUESTIONS.map((q, i) => ({ ...q, i })).filter(({ topic }) => (activeTopics.size ? activeTopics.has(topic) : true));
    const missed: Record<string, number> = {};
    let correctCount = 0;
    used.forEach(({ i, correct, topic }) => {
      const ok = quizAnswers[i] === correct;
      if (ok) correctCount += 1;
      else missed[topic] = (missed[topic] || 0) + 1;
    });
    const result = Object.keys(missed);
    setWeakness(result);
    storage.set("weakness", result);
    localStorage.setItem("name", name);
    setQuizLevel(inferLevelFromScore(correctCount, used.length));
    navigate("/dashboard");
  };

  const resetAll = () => {
    storage.clearAll();
    setRole(null);
    setName(DEFAULTS.name);
    setQuizLevel(DEFAULTS.quizLevel);
    setQuizSubjects(DEFAULTS.quizLevel as any);
    setQuizAnswers(DEFAULTS.quizAnswers);
    setWeakness(DEFAULTS.weakness);
    toast("Reset complete");
    navigate("/");
  };

  const onLiveRoute = location.pathname === "/live";

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-indigo-50 to-white text-slate-900" >
      <Toaster position="top-right" richColors />

      <AppHeader
        role={role}
        onLogout={handleLogout}
        onOpenAuth={() => setAuthOpen(true)}
        onReset={resetAll}
      />

      {onLiveRoute && (
        <div className="bg-rose-600 text-white">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
            <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-sm font-medium">You’re in a Live Session</span>
            <div className="ml-auto">
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-3 rounded-full text-rose-700 bg-white"
                onClick={() => navigate("/dashboard")}
              >
                Leave
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 w-full">
        <div className="max-w-6xl mx-auto px-10 py-8 md:py-10">
          <Routes>
            <Route path="/" element={<Landing onGetStarted={() => setAuthOpen(true)} />} />
            <Route path="/onboarding" element={
              <Onboarding
                name={name}
                setName={setName}
                quizLevel={quizLevel}
                setQuizLevel={setQuizLevel as any}
                quizSubjects={quizSubjects}
                setQuizSubjects={setQuizSubjects}
                quizAnswers={quizAnswers}
                setQuizAnswers={setQuizAnswers}
                onFinish={calcResults}
              />
            } />
            <Route path="/dashboard" element={<Dashboard name={name} weakness={weakness} onNavigatePath={(p) => navigate(p)} />} />
            <Route path="/tutors" element={<TutorDiscovery onNavigatePath={(p) => navigate(p)} />} />
            <Route path="/buddies" element={<StudyBuddy onNavigatePath={(p) => navigate(p)} />} />
            <Route path="/community" element={<Community />} />
            <Route path="/live" element={<LiveSession />} />
            <Route path="/progress" element={<ProgressPage weakness={weakness} />} />
            <Route path="/tutors/:tutorId/videos" element={<TutorVideos />} />

          </Routes>

          <HiddenTests />
        </div>
      </main>

      <footer className="border-t bg-white/70 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 text-xs text-slate-600 flex items-center gap-4">
          <span>© {new Date().getFullYear()} TutorGo</span>
          <a className="hover:underline" href="#">Privacy</a>
          <a className="hover:underline" href="#">Terms</a>
          <span className="ml-auto text-[11px]">Prototype v0.1</span>
        </div>
      </footer>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} onLogin={handleLogin} />
    </div>
  );
}

function AppHeader({
  role,
  onOpenAuth,
  onLogout,
  onReset,
}: {
  role: Role;
  onOpenAuth: () => void;
  onLogout: () => void;
  onReset: () => void;
}) {
  const location = useLocation();

  const path = location.pathname;
  const isActive = (target: string) => path === target;

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center gap-3">

        <Link
          to="/"
          className="flex items-center gap-2 rounded-2xl px-3 py-1 text-xl md:text-2xl font-extrabold tracking-tight text-indigo-600 hover:bg-indigo-50 transition-colors"
        >
          <GraduationCap className="w-6 h-6 text-indigo-600" />
          TutorGo
        </Link>


        <nav className="hidden md:flex items-center gap-1 ml-1" data-testid="topnav-tabs">
          <Link
            to="/dashboard"
            className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 ${isActive("/dashboard") ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
          >
            <Home className="w-4 h-4" /> Dashboard
          </Link>
          <Link
            to="/tutors"
            className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 ${isActive("/tutors") ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
          >
            <Search className="w-4 h-4" /> Find Tutor
          </Link>
          <Link
            to="/buddies"
            className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 ${isActive("/buddies") ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
          >
            <MessageSquare className="w-4 h-4" /> Buddy
          </Link>
          <Link
            to="/community"
            className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 ${isActive("/community") ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
          >
            <Heart className="w-4 h-4" /> Community
          </Link>
          <Link
            to="/progress"
            className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 ${isActive("/progress") ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
          >
            <LineChart className="w-4 h-4" /> Progress
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onReset}>Reset</Button>

          {!role ? (
            <Button size="sm" className="rounded-xl" onClick={onOpenAuth}>
              <LogIn className="w-4 h-4 mr-1" /> Login
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="rounded-full px-3">
                  <User className="w-4 h-4 mr-1" />
                  {role}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout}>
                  <LogOut className="w-4 h-4 mr-2" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}


/************** AUTH MODAL **************/
function AuthModal({ open, onOpenChange, onLogin }: { open: boolean; onOpenChange: (v: boolean) => void; onLogin: (role: "student" | "tutor", email: string) => void; }) {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [role, setRole] = useState<"student" | "tutor">("student");
  const submit = () => { if (!email || !pwd) { toast.error("Please enter email and password"); return; } if (tab === "signup") toast.success("Account created (mock)"); onLogin(role, email); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeaderUI><DialogTitleUI>{tab === "login" ? "Welcome back" : "Create your account"}</DialogTitleUI></DialogHeaderUI>
        <div className="space-y-4">
          <div className="flex gap-2 bg-slate-100 rounded-lg p-1 text-sm">
            <button className={cn("flex-1 py-1 rounded-md", tab === "login" && "bg-white shadow")} onClick={() => setTab("login")}>Login</button>
            <button className={cn("flex-1 py-1 rounded-md", tab === "signup" && "bg-white shadow")} onClick={() => setTab("signup")}>Sign up</button>
          </div>
          <div className="grid gap-2">
            <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input placeholder="Password" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Button variant={role === "student" ? "default" : "outline"} onClick={() => setRole("student")} className="rounded-xl">Student</Button>
              <Button variant={role === "tutor" ? "default" : "outline"} onClick={() => setRole("tutor")} className="rounded-xl">Tutor</Button>
            </div>
            <div className="text-xs text-slate-500">This is a prototype. Any values work.</div>
          </div>
        </div>
        <DialogFooterUI className="gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="rounded-xl" onClick={submit}>{tab === "login" ? "Login" : "Create account"}</Button>
        </DialogFooterUI>
        <div className="pt-2 text-xs text-slate-500">Or <button className="underline" onClick={() => { onOpenChange(false); toast("Continuing as guest"); }}>continue as guest</button></div>
      </DialogContent>
    </Dialog>
  );
}


/************** LANDING **************/
function Landing({ onGetStarted }: { onGetStarted: () => void }) {

  return (
    <section className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-violet-200/40 blur-3xl" />
      </div>

      <div>
        <div className="rounded-3xl overflow-hidden bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white ring-1 ring-white/10 shadow-lg">
          <div className="grid md:grid-cols-2 gap-0">
            <div className="p-6 md:p-8">
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 bg-white/15 text-xs font-medium backdrop-blur">
                <Sparkles className="w-3 h-3" />
                On-demand · Tutor + Buddy + Progress
              </div>

              <h1 className="mt-3 text-3xl md:text-4xl font-extrabold leading-tight">
                On-demand tutoring that fits your life
              </h1>

              <p className="mt-3 text-white/90 max-w-prose">
                Match with tutors, study with buddies, and keep your streak—short sessions, clear goals, steady momentum.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Button className="rounded-2xl bg-white text-indigo-700 hover:bg-white/90" onClick={onGetStarted}>
                  <LogIn className="w-4 h-4 mr-2" />
                  Create your account
                </Button>
              </div>

              <ul className="mt-5 flex flex-wrap gap-4 text-sm text-white/90">
                <li className="flex items-center gap-2"><Video className="w-4 h-4" /> Live sessions</li>
                <li className="flex items-center gap-2"><Stars className="w-4 h-4" /> Progress tracking</li>
                <li className="flex items-center gap-2"><School className="w-4 h-4" /> Study buddies</li>
              </ul>
            </div>

            <div className="relative h-full min-h-[240px] w-full overflow-hidden rounded-r-3xl">
              <HeroSlideshow
                images={[
                  "/hero1.jpg",
                  "/hero2.jpg",
                  "/hero3.jpg",
                  "/hero4.jpg",
                ]}
                interval={4000}
              />
            </div>

          </div>
        </div>

        <div className="mt-8 rounded-2xl bg-white ring-1 ring-slate-200 p-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-bold">Why TutorGo</h2>
            <span className="text-xs text-slate-500">Built for effective 1:1 tutoring</span>
          </div>

          <div className="mt-4 grid md:grid-cols-3 gap-4">
            <ColorFeature
              tone="indigo"
              icon={<Search className="w-5 h-5 text-indigo-600" />}
              title="Find the right tutor"
              points={[
                "Filter by subject & level",
                "Clear bio, rating, availability",
                "Fits budget & schedule",
              ]}
            />
            <ColorFeature
              tone="emerald"
              icon={<Calendar className="w-5 h-5 text-emerald-600" />}
              title="Book in minutes"
              points={[
                "60-min sessions",
                "Instant confirmation",
                "Reminders built in",
              ]}
            />
            <ColorFeature
              tone="violet"
              icon={<LineChart className="w-5 h-5 text-violet-600" />}
              title="Learn, track, improve"
              points={[
                "Simple tasks between sessions",
                "Streaks keep momentum",
                "See progress by topic",
              ]}
            />
          </div>

          {/* Secondary details */}
          <div className="mt-6 flex flex-wrap gap-2">
            <NeutralPill icon={<School className="w-4 h-4" />} label="Qualified tutors" />
            <NeutralPill icon={<Clock className="w-4 h-4" />} label="Flexible times" />
            <NeutralPill icon={<MessageSquare className="w-4 h-4" />} label="Buddy accountability" />
            <NeutralPill icon={<Stars className="w-4 h-4" />} label="Outcome-focused tasks" />
          </div>
        </div>

        {/* WHAT LEARNERS SAY */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold">What learners say</h2>
          </div>

          <NeutralTestimonialCarousel
            items={[
              { id: 1, name: "Alex", avatar: "/avatars/alex.jpg", quote: "15-minute practice finally got me consistent." },
              { id: 2, name: "Mika", avatar: "/avatars/mika.jpg", quote: "Matched with a great writing tutor quickly." },
              { id: 3, name: "Ravi", avatar: "/avatars/ravi.jpg", quote: "Buddy check-ins keep me accountable nightly." },
              { id: 4, name: "Ira", avatar: "/avatars/ira.jpg", quote: "Short sessions fit between classes perfectly." },
              { id: 5, name: "Chen", avatar: "/avatars/chen.jpg", quote: "Progress view makes my effort feel visible." },
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function HeroSlideshow({ images, interval = 4000 }: { images: string[]; interval?: number }) {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, interval);
    return () => clearInterval(id);
  }, [images.length, interval]);

  return (
    <div className="relative h-full w-full">
      {images.map((src, i) => (
        <img
          key={src}
          src={src}
          alt={`Slide ${i + 1}`}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${i === index ? "opacity-100" : "opacity-0"
            }`}
        />
      ))}
    </div>
  );
}


function NeutralPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 ring-1 ring-slate-200 px-3 py-1 text-xs text-slate-700">
      <span className="rounded-md bg-white ring-1 ring-slate-200 p-1">{icon}</span>
      <span className="font-medium">{label}</span>
    </span>
  );
}

function ColorFeature({
  icon,
  title,
  points,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  points: string[];
  tone: "indigo" | "emerald" | "violet";
}) {
  const bg =
    tone === "indigo"
      ? "bg-indigo-50"
      : tone === "emerald"
        ? "bg-emerald-50"
        : "bg-violet-50";
  const ring =
    tone === "indigo"
      ? "ring-indigo-100"
      : tone === "emerald"
        ? "ring-emerald-100"
        : "ring-violet-100";

  return (
    <div className={`rounded-xl p-4 ${bg} ring-1 ${ring}`}>
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-white ring-1 ring-slate-200 p-2">{icon}</div>
        <div className="min-w-0">
          <div className="font-semibold">{title}</div>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {points.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function NeutralTestimonialCarousel({
  items,
}: {
  items: Array<{ id: number; name: string; quote: string; avatar?: string }>;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  const scrollByAmount = (dir: "left" | "right") => {
    const el = ref.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-card]');
    const cardW = card?.offsetWidth ?? 260;
    el.scrollBy({ left: (dir === "left" ? -1 : 1) * (cardW + 16), behavior: "smooth" });
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Previous"
        onClick={() => scrollByAmount("left")}
        className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white shadow ring-1 ring-slate-200 p-2 hover:bg-slate-50"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div
        ref={ref}
        className="overflow-x-auto overflow-y-visible scroll-smooth pt-8 pb-2"
        style={{ scrollSnapType: "x mandatory" }}
      >
        <div className="flex gap-4 pr-2">
          {items.map((it) => (
            <NeutralTestimonialCard key={it.id} {...it} />
          ))}
        </div>
      </div>

      <button
        type="button"
        aria-label="Next"
        onClick={() => scrollByAmount("right")}
        className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white shadow ring-1 ring-slate-200 p-2 hover:bg-slate-50"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function NeutralTestimonialCard({
  name,
  quote,
  avatar,
}: {
  name: string;
  quote: string;
  avatar?: string;
}) {
  return (
    <div
      data-card
      className="relative min-w-[240px] max-w-[260px] scroll-ml-4 scroll-mr-4"
      style={{ scrollSnapAlign: "start" }}
    >
      <div className="absolute -top-7 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-white ring-1 ring-slate-200 overflow-hidden grid place-items-center">
        {avatar ? (
          <img src={avatar} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-sm font-medium text-slate-600">{name[0]}</span>
        )}
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-4 text-center">
        <div className="mt-4 text-sm font-medium">{name}</div>
        <div className="mt-1 text-xs text-slate-600 leading-relaxed">
          “{quote}”
        </div>
      </div>
    </div>
  );
}



/************** ONBOARDING **************/
function Onboarding({ name, setName, quizLevel, setQuizLevel, quizSubjects, setQuizSubjects, quizAnswers, setQuizAnswers, onFinish }: any) {
  const [step, setStep] = useState<1 | 2>(1);
  const toggleSubject = (sub: string) => { setQuizSubjects((prev: string[]) => prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub]); };
  const activeTopics = useMemo(() => new Set(quizSubjects.map((s: string) => SUBJECT_TOPIC_MAP[s]).filter(Boolean)), [quizSubjects]);
  const activeQuestions = useMemo(() => SAMPLE_QUESTIONS.map((q, i) => ({ q, i })).filter(({ q }) => (activeTopics.size ? activeTopics.has(q.topic) : true)), [activeTopics]);
  const goNext = () => { if (step === 1) { setQuizAnswers(Array(SAMPLE_QUESTIONS.length).fill(-1)); setStep(2); } else { onFinish(); } };
  const goBack = () => setStep(1);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Welcome! Tell us about you</CardTitle><CardDescription>We’ll personalize your dashboard (mocked)</CardDescription></CardHeader>
        {step === 1 && (
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="text-sm">Your name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
              <label className="text-sm mt-2">Subjects to focus on</label>
              <div className="flex flex-wrap gap-2">{["Mathematics", "English", "Physics", "Chemistry", "Biology"].map((s) => (<Badge key={s} className={cn("cursor-pointer", !quizSubjects.includes(s) && "opacity-50")} onClick={() => toggleSubject(s)}>{s}</Badge>))}</div>
              <p className="text-xs text-slate-500 mt-2">Tip: We’ll give you a short quiz and infer your level automatically.</p>
            </div>
            <div className="space-y-3">
              <div className="text-sm text-slate-600">Selected: {quizSubjects.length ? <span className="font-medium">{quizSubjects.join(", ")}</span> : <span className="italic text-slate-500">none</span>}</div>
              {activeQuestions.length === 0 && quizSubjects.length > 0 && (<div className="text-xs text-amber-600">We don’t have quiz items yet for one or more selected subjects—Finish will still work.</div>)}
            </div>
          </CardContent>
        )}
        {step === 2 && (
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between"><div className="text-sm text-slate-600">Quick check-in for: {quizSubjects.length ? quizSubjects.join(", ") : "All"}</div><div className="text-xs text-slate-500">{activeQuestions.length} question{activeQuestions.length === 1 ? "" : "s"}</div></div>
            {activeQuestions.length === 0 ? (
              <div className="text-sm text-slate-500">No quiz items. You can <button className="underline" onClick={goBack}>go back</button> or click <span className="font-medium">Finish</span>.</div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {activeQuestions.map(({ q, i }) => (
                  <Card key={i} className="border rounded-xl">
                    <CardHeader><CardTitle className="text-base">{q.topic}: {q.q}</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {q.options.map((opt, k) => (
                        <label key={k} className="flex items-center gap-2 text-sm">
                          <input type="radio" name={`q${i}`} checked={quizAnswers[i] === k} onChange={() => { const arr = [...quizAnswers]; arr[i] = k; setQuizAnswers(arr); }} />
                          {opt}
                        </label>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        )}
        <CardFooter className="justify-between">
          {step === 2 ? (
            <>
              <Button variant="outline" className="rounded-xl" onClick={goBack}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
              <div className="flex gap-2"><Button variant="outline" className="rounded-xl" onClick={onFinish}>Skip</Button><Button className="rounded-xl" onClick={goNext}>Finish <ChevronRight className="w-4 h-4 ml-1" /></Button></div>
            </>
          ) : (
            <>
              <div />
              <Button className="rounded-xl" onClick={goNext} disabled={quizSubjects.length === 0} title={quizSubjects.length === 0 ? "Pick at least one subject" : ""}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

/************** DASHBOARD **************/
function Dashboard(
  { name, weakness, onNavigatePath }: { name: string; weakness: string[]; onNavigatePath: (s: Screen) => void }
) {
  const focus = (weakness && weakness.length ? weakness : ["Algebra", "Essay Writing"]).slice(0, 3);

  const [streak, setStreak] = React.useState(getInitialStreak());
  const allTasks: Array<{ id: string; title: string; subject?: string; done?: boolean }> = (() => {
    try { const raw = localStorage.getItem("tasks_today"); const arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr : []; }
    catch { return []; }
  })();
  const doneCount = allTasks.filter(t => t.done).length;
  const tasksPct = allTasks.length ? Math.round((doneCount / allTasks.length) * 100) : 0;
  const tasksPreview = allTasks.slice(0, 3);

  const checkIn = () => {
    const s = streak + 1;
    setStreak(s);
    localStorage.setItem("streak", String(s));
    toast.success("Checked in!");
  };

  return (
    <section className="w-full">
      <div className="max-w-5xl mx-auto">
        <Card className="rounded-2xl overflow-hidden mb-4">
          <div className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white p-4 md:p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xl font-semibold">Hi {name}! 👋</div>
                <div className="text-xs md:text-sm text-white/90 mt-0.5">
                  Today’s focus: {focus.join(", ")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatPill icon={<Stars className="w-4 h-4" />} label="Streak" value={`${streak}d`} />
                <StatPill icon={<LineChart className="w-4 h-4" />} label="Tasks" value={allTasks.length ? `${doneCount}/${allTasks.length}` : "—"} />
                <StatPill icon={<Calendar className="w-4 h-4" />} label="Next" value="Sat 10:00" />
              </div>
            </div>
          </div>

          <div className="p-3 md:p-4">
            <div className="mx-auto max-w-fit flex flex-wrap items-center justify-center gap-4 md:gap-5">
              <ShortcutTile tone="indigo" icon={<Search className="w-4 h-4" />} title="Find Tutor" onClick={() => onNavigatePath("tutors")} />
              <ShortcutTile tone="rose" icon={<MessageSquare className="w-4 h-4" />} title="Find Buddy" onClick={() => onNavigatePath("buddies")} />
              <ShortcutTile tone="emerald" icon={<LineChart className="w-4 h-4" />} title="Progress" onClick={() => onNavigatePath("progress")} />
              <ShortcutTile tone="violet" icon={<Heart className="w-4 h-4" />} title="Community" onClick={() => onNavigatePath("community")} />
            </div>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-[0.8fr_1.7fr_1.3fr]">
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-violet-500" />
                Daily Check-in
              </CardTitle>
              <CardDescription className="text-xs">Build momentum</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-center">
              <div className="text-3xl font-bold">{streak}</div>
              <div className="text-sm text-slate-500">day streak</div>
              <Button size="sm" className="rounded-xl w-full" onClick={checkIn}>
                Check in
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-violet-500" />
                Today’s Tasks
              </CardTitle>
              <CardDescription className="text-xs">Keep it small & winnable</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {allTasks.length > 0 ? (
                <>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{doneCount}/{allTasks.length} done</span>
                      <span>{tasksPct}%</span>
                    </div>
                    <Progress value={tasksPct} />
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    {tasksPreview.map((t) => (
                      <li key={t.id} className="flex items-start gap-2">
                        <span className={`mt-1 inline-block h-1.5 w-1.5 rounded-full ${t.done ? "bg-emerald-500" : "bg-slate-300"}`} />
                        <span className={`${t.done ? "line-through text-slate-400" : ""}`}>
                          {t.title}{t.subject ? <span className="text-slate-500"> — {t.subject}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="text-sm text-slate-500">No tasks yet. Add some in Progress.</div>
              )}
              <Button size="sm" variant="outline" className="rounded-xl w-full" onClick={() => onNavigatePath("progress")}>
                Manage tasks
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-violet-500" />
                Next Session
              </CardTitle>
              <CardDescription className="text-xs">You’re booked</CardDescription>
            </CardHeader>
            <CardContent className="flex items-start justify-between gap-3 text-sm">
              <div>
                <div className="font-medium">Tutor Aisha · Mathematics</div>
                <div className="text-slate-600">Sat 10:00 AM</div>
              </div>
              <Button size="sm" className="rounded-xl" onClick={() => onNavigatePath("live")}>
                Join
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}


function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-full bg-white/10 ring-1 ring-white/20 px-3 py-1.5 text-xs flex items-center gap-2">
      <span className="rounded-md bg-white/20 p-1">{icon}</span>
      <span className="opacity-90">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function ShortcutTile({
  icon,
  title,
  onClick,
  tone = "indigo",
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  tone?: "indigo" | "rose" | "emerald" | "violet";
}) {
  const ring =
    tone === "indigo"
      ? "ring-indigo-200/70 hover:bg-indigo-50"
      : tone === "rose"
        ? "ring-rose-200/70 hover:bg-rose-50"
        : tone === "emerald"
          ? "ring-emerald-200/70 hover:bg-emerald-50"
          : "ring-violet-200/70 hover:bg-violet-50";

  return (
    <button
      onClick={onClick}
      className={`w-48 rounded-2xl bg-white ring-1 ${ring} transition p-5 text-center`}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="rounded-xl bg-slate-50 p-3">{icon}</div>
        <div className="text-base font-medium">{title}</div>
      </div>
    </button>

  );
}


/*** AI Assistant Panel ***/
function AIAssistantPanel({
  subjectFilter,
  highlight = false,
}: {
  subjectFilter: string | "all";
  highlight?: boolean;
}) {
  type Msg = { id: string; from: "ai" | "me"; text: string };
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: cryptoId(),
      from: "ai",
      text:
        subjectFilter === "Mathematics"
          ? "Hi! Stuck on algebra or calculus? Share a problem and I’ll walk through the steps."
          : subjectFilter === "English"
            ? "Need help with thesis statements or structure? Paste a prompt and I’ll suggest an outline."
            : "Ask me any study question—I'll explain step by step.",
    },
  ]);
  const [input, setInput] = useState("");

  const generateAnswer = (q: string) => {
    const s = subjectFilter;
    const lower = q.toLowerCase();

    if (s === "Mathematics" || /algebra|equation|solve|quadratic/.test(lower)) {
      return [
        "Let’s solve it together. General steps:",
        "1) Isolate like terms.",
        "2) If quadratic ax²+bx+c=0, try factoring or quadratic formula.",
        "3) Substitute back to check.",
        "Paste your exact problem and I’ll show each step.",
      ].join("\n");
    }

    if (s === "English" || /essay|thesis|intro|paragraph/.test(lower)) {
      return [
        "Here’s a quick structure you can use:",
        "• Hook (1–2 sentences)",
        "• Context (2–3 sentences)",
        "• Clear thesis with stance",
        "Send me your prompt; I’ll draft a thesis and topic sentences.",
      ].join("\n");
    }

    if (s === "Physics" || /force|newton|velocity|acceleration/.test(lower)) {
      return [
        "Tip: Start from known laws (e.g., F = m·a).",
        "• Draw a free-body diagram",
        "• Write equations along each axis",
        "• Solve, then check units",
        "Share the numbers; I’ll compute it with you.",
      ].join("\n");
    }

    return "Got it! Tell me the exact question (and any numbers); I’ll break it down step by step.";
  };

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const my: Msg = { id: cryptoId(), from: "me", text };
    setMessages((m) => [...m, my]);
    setInput("");

    setTimeout(() => {
      const ai: Msg = { id: cryptoId(), from: "ai", text: generateAnswer(text) };
      setMessages((m) => [...m, ai]);
    }, 450);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <Card className={`rounded-2xl ${highlight ? "border-2 border-violet-300" : ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-600" />
          Ask AI Tutor
        </CardTitle>
        <CardDescription className="text-xs">
          Can’t find a tutor? Get instant help while you search.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-h-56 overflow-auto space-y-2 pr-1">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`text-sm px-3 py-2 rounded-xl ${m.from === "me"
                ? "bg-slate-900 text-white ml-auto max-w-[80%] rounded-br-md"
                : "bg-slate-50 border max-w-[85%] rounded-bl-md"
                }`}
              style={{ width: "fit-content" }}
            >
              {m.text.split("\n").map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder={
              subjectFilter === "Mathematics"
                ? "e.g., How to solve 2x + 6 = 14?"
                : subjectFilter === "English"
                  ? "e.g., Help me write a thesis on climate policy"
                  : "Ask a study question…"
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            className="rounded-2xl"
          />
          <Button className="rounded-2xl" onClick={send}>
            <Sparkles className="w-4 h-4 mr-1" />
            Ask
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {subjectFilter === "Mathematics" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => setInput("Factor x^2 + 5x + 6")}
              >
                Factor x²+5x+6
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => setInput("Explain quadratic formula")}
              >
                Quadratic formula
              </Button>
            </>
          )}
          {subjectFilter === "English" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => setInput("Thesis for school uniforms debate")}
              >
                Thesis help
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => setInput("Outline for persuasive essay")}
              >
                Essay outline
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/************** TUTOR DISCOVERY **************/
function TutorDiscovery({ onNavigatePath }: { onNavigatePath: (s: Screen) => void }) {
  const [subjectFilter, setSubjectFilter] = useState<string | "all">("all");
  const tutors = useMemo(
    () =>
      subjectFilter === "all"
        ? MOCK_TUTORS
        : MOCK_TUTORS.filter((t) => t.subject === subjectFilter),
    [subjectFilter]
  );

  const [savedIds, setSavedIds] = useState<number[]>(
    () => storage.get<number[]>("saved_tutors", [])
  );
  const isSaved = (id: number) => savedIds.includes(id);
  const toggleSave = (id: number) => {
    setSavedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev];
      storage.set("saved_tutors", next);
      return next;
    });
  };

  const [msgOpen, setMsgOpen] = useState(false);
  const [msgTutor, setMsgTutor] = useState<typeof MOCK_TUTORS[number] | null>(null);
  const openMessage = (tutor: typeof MOCK_TUTORS[number]) => {
    setMsgTutor(tutor);
    setMsgOpen(true);
  };

  const [booking, setBooking] = useState<{ tutor?: any; slot?: string } | null>(null);

  return (
    <section className="w-full">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={subjectFilter} onValueChange={(v) => setSubjectFilter(v as any)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filter by subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {[...new Set(MOCK_TUTORS.map((t) => t.subject))].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-slate-500">{tutors.length} tutors</div>
        </div>

        <AIAssistantPanel subjectFilter={subjectFilter} highlight />

        <SavedTutorsPanel
          savedIds={savedIds}
          onMessage={openMessage}
          onUnsave={(id) => toggleSave(id)}
        />

        {/* Tutor cards */}
        <div className="grid md:grid-cols-3 gap-3">
          {tutors.map((t) => (
            <Card key={t.id} className="rounded-2xl">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{t.name.split(" ")[1]?.[0] || t.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{t.name}</CardTitle>
                    <CardDescription>
                      {t.subject} • ⭐ {t.rating} • ${t.price}/hr
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-2 text-sm">
                <p>{t.bio}</p>
                <div className="flex flex-wrap gap-2">
                  {t.availability.map((s: string) => (
                    <Badge key={s} variant="secondary" className="rounded-full">
                      {s}
                    </Badge>
                  ))}
                </div>

                <div className="pt-1 flex items-center gap-2 text-xs">
                  <Button
                    size="sm"
                    variant={isSaved(t.id) ? "default" : "outline"}
                    className="rounded-full h-7 px-3"
                    onClick={() => toggleSave(t.id)}
                  >
                    {isSaved(t.id) ? "Saved" : "Save"}
                  </Button>
                  {isSaved(t.id) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full h-7 px-3"
                      onClick={() => openMessage(t)}
                    >
                      Message
                    </Button>
                  )}
                </div>
              </CardContent>

              <CardFooter className="flex gap-2">
                <Button className="w-full rounded-xl" onClick={() => setBooking({ tutor: t })}>
                  Book Session
                </Button>
                <Link to={`/tutors/${t.id}/videos`} className="w-full">
                  <Button variant="outline" className="w-full rounded-xl">
                    Sample Lesson
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>

        {booking?.tutor && (
          <Card className="rounded-2xl border-2">
            <CardHeader>
              <CardTitle>Book with {booking.tutor.name}</CardTitle>
              <CardDescription>Select a time slot</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {booking.tutor.availability.map((s: string) => (
                  <Button
                    key={s}
                    variant={booking.slot === s ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => setBooking({ ...booking, slot: s })}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setBooking(null)}>
                Cancel
              </Button>
              <Button
                disabled={!booking.slot}
                className="rounded-xl"
                onClick={() => {
                  onNavigatePath("tutors");
                  toast.success(`Booked ${booking.tutor.name} at ${booking.slot}!`);
                  setBooking(null);
                }}
              >
                Confirm Booking
              </Button>
            </CardFooter>
          </Card>
        )}

        <MessageTutorDialog
          open={msgOpen}
          onOpenChange={setMsgOpen}
          tutor={msgTutor}
        />
      </section>
    </section>
  );
}

/************** SAVED TUTORS PANEL **************/
function SavedTutorsPanel({
  savedIds,
  onMessage,
  onUnsave,
}: {
  savedIds: number[];
  onMessage: (tutor: typeof MOCK_TUTORS[number]) => void;
  onUnsave: (id: number) => void;
}) {
  const saved = MOCK_TUTORS.filter((t) => savedIds.includes(t.id));
  if (saved.length === 0) return null;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Saved Tutors</CardTitle>
        <CardDescription className="text-xs">
          Tutors you shortlisted — message them anytime.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {saved.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between gap-3 p-2 rounded-lg border bg-white"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="w-8 h-8 ring-1 ring-slate-200">
                <AvatarFallback>{t.name.split(" ")[1]?.[0] || t.name[0]}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="font-medium truncate">{t.name}</div>
                <div className="text-[11px] text-slate-500 truncate">
                  {t.subject} • ⭐ {t.rating} • ${t.price}/hr
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" className="rounded-full h-8 px-3" onClick={() => onMessage(t)}>
                Message
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full h-8 px-3"
                onClick={() => onUnsave(t.id)}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/************** MESSAGE TUTOR DIALOG **************/
function MessageTutorDialog({
  open,
  onOpenChange,
  tutor,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tutor: typeof MOCK_TUTORS[number] | null;
}) {
  type ChatMsg = { id: string; from: "me" | "them"; text: string; ts: number };

  const threadKey = tutor ? `tutor_thread_${tutor.id}` : "";
  const loadThread = (): ChatMsg[] => {
    if (!tutor) return [];
    try {
      const raw = localStorage.getItem(threadKey);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  };

  const [messages, setMessages] = useState<ChatMsg[]>(loadThread);
  const [text, setText] = useState("");

  useEffect(() => {
    // reload when tutor changes
    setMessages(loadThread());
    setText("");
  }, [tutor?.id]);

  useEffect(() => {
    // persist thread
    if (tutor) localStorage.setItem(threadKey, JSON.stringify(messages));
  }, [messages, tutor, threadKey]);

  const send = () => {
    const t = text.trim();
    if (!t || !tutor) return;
    const now = Date.now();
    const mine: ChatMsg = { id: cryptoId(), from: "me", text: t, ts: now };
    const reply: ChatMsg = {
      id: cryptoId(),
      from: "them",
      text: `Thanks for reaching out! I can help with ${tutor.subject}.`,
      ts: now + 500,
    };
    setMessages((m) => [...m, mine]);
    setText("");
    setTimeout(() => setMessages((m) => [...m, reply]), 500);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeaderUI>
          <DialogTitleUI>
            {tutor ? `Chat with ${tutor.name}` : "Message Tutor"}
          </DialogTitleUI>
        </DialogHeaderUI>

        {!tutor ? (
          <div className="text-sm text-slate-500">Select a tutor to start chatting.</div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8 ring-1 ring-slate-200">
                <AvatarFallback>{tutor.name.split(" ")[1]?.[0] || tutor.name[0]}</AvatarFallback>
              </Avatar>
              <div className="text-sm">
                <div className="font-medium">{tutor.name}</div>
                <div className="text-slate-500 text-xs">{tutor.subject}</div>
              </div>
            </div>

            {/* history */}
            <div className="max-h-64 overflow-auto space-y-2 pr-1 border rounded-lg p-2 bg-slate-50">
              {messages.length === 0 && (
                <div className="text-xs text-slate-500">No messages yet. Say hi!</div>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`text-sm px-3 py-2 rounded-xl w-fit ${m.from === "me"
                    ? "bg-slate-900 text-white ml-auto rounded-br-md"
                    : "bg-white border rounded-bl-md"
                    }`}
                >
                  {m.text}
                </div>
              ))}
            </div>

            {/* input */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Type your message…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                className="rounded-2xl"
              />
              <Button className="rounded-2xl" onClick={send}>Send</Button>
            </div>
          </div>
        )}

        <DialogFooterUI className="gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooterUI>
      </DialogContent>
    </Dialog>
  );
}



/*** Tutor Videos ***/
import { useParams } from "react-router-dom";
import { Play } from "lucide-react";
function TutorVideos() {
  const { tutorId } = useParams();
  const navigate = useNavigate();

  const idNum = Number(tutorId);
  const tutor = MOCK_TUTORS.find((t) => t.id === idNum);
  const videos = MOCK_TUTOR_VIDEOS[idNum] || [];

  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const [playingId, setPlayingId] = useState<string | null>(null);

  const playThis = (id: string | number) => {
    const key = String(id);
    Object.entries(videoRefs.current).forEach(([vid, el]) => {
      if (vid !== key && el && !el.paused) el.pause();
    });
    const el = videoRefs.current[key];
    if (el) {
      el.play();
      setPlayingId(key);
    }
  };

  const onVideoPlay = (id: string | number) => {
    const key = String(id);
    Object.entries(videoRefs.current).forEach(([vid, el]) => {
      if (vid !== key && el && !el.paused) el.pause();
    });
    setPlayingId(key);
  };

  const onVideoPause = (id: string | number) => {
    const key = String(id);
    if (playingId === key) setPlayingId(null);
  };

  return (
    <section className="w-full">
      <div className="max-w-5xl mx-auto">
        <Card className="rounded-2xl overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">
                  {tutor
                    ? `${tutor.name} — Video Library`
                    : "Tutor Video Library"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {tutor
                    ? `${tutor.subject} · ⭐ ${tutor.rating} · $${tutor.price}/hr`
                    : "Curated uploads"}
                </CardDescription>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => navigate(-1)}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>

                {tutor && (
                  <Button
                    className="rounded-xl"
                    onClick={() => navigate("/tutors")}
                  >
                    Find more tutors
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {videos.length === 0 ? (
              <div className="text-sm text-slate-500">
                No videos uploaded yet.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {videos.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-xl border bg-white overflow-hidden"
                  >
                    <div className="relative">
                      <video
                        ref={(el) => {
                          videoRefs.current[String(v.id)] = el;
                        }}
                        className="w-full aspect-video rounded-b-none"
                        controls
                        preload="metadata"
                        src={v.src}
                        poster={v.thumbnail}
                        onPlay={() => onVideoPlay(v.id)}
                        onPause={() => onVideoPause(v.id)}
                      />

                      {/* Overlay play button, only when not playing */}
                      {playingId !== String(v.id) && (
                        <button
                          type="button"
                          className="absolute inset-0 flex items-center justify-center"
                          onClick={() => playThis(v.id)}
                          aria-label="Play video"
                        >
                          <span className="rounded-full bg-white/95 hover:bg-white shadow px-4 py-2 flex items-center gap-2 transition">
                            <Play className="w-4 h-4" />
                          </span>
                        </button>
                      )}
                    </div>

                    <div className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{v.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {v.duration}
                          </div>
                        </div>
                        <Badge variant="secondary" className="rounded-full">
                          {tutor?.subject ?? "Video"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

/************** STUDY BUDDY **************/
type ChatMsg = { id: string; text: string; ts: number; from: "me" | "them" };

const toneFor = (subject?: string) => {
  switch (subject) {
    case "Mathematics":
      return { chip: "bg-indigo-100 text-indigo-700 ring-indigo-300", row: "hover:bg-indigo-50", header: "from-indigo-500 to-indigo-600", btn: "bg-indigo-600 hover:bg-indigo-700 text-white" };
    case "English":
      return { chip: "bg-rose-100 text-rose-700 ring-rose-300", row: "hover:bg-rose-50", header: "from-rose-500 to-rose-600", btn: "bg-rose-600 hover:bg-rose-700 text-white" };
    case "Physics":
      return { chip: "bg-violet-100 text-violet-700 ring-violet-300", row: "hover:bg-violet-50", header: "from-violet-500 to-violet-600", btn: "bg-violet-600 hover:bg-violet-700 text-white" };
    case "Chemistry":
      return { chip: "bg-emerald-100 text-emerald-700 ring-emerald-300", row: "hover:bg-emerald-50", header: "from-emerald-500 to-emerald-600", btn: "bg-emerald-600 hover:bg-emerald-700 text-white" };
    case "Biology":
      return { chip: "bg-teal-100 text-teal-700 ring-teal-300", row: "hover:bg-teal-50", header: "from-teal-500 to-teal-600", btn: "bg-teal-600 hover:bg-teal-700 text-white" };
    default:
      return { chip: "bg-slate-100 text-slate-700 ring-slate-300", row: "hover:bg-slate-50", header: "from-slate-500 to-slate-600", btn: "bg-slate-600 hover:bg-slate-700 text-white" };
  }
};

function StudyBuddy({ onNavigatePath }: { onNavigatePath: (s: Screen) => void }) {
  const [selected, setSelected] = useState<typeof MOCK_BUDDIES[number] | null>(MOCK_BUDDIES[0]);
  const [threads, setThreads] = useState<Record<number, ChatMsg[]>>(() => {
    const seed: Record<number, ChatMsg[]> = {};
    for (const b of MOCK_BUDDIES) {
      seed[b.id] = [
        { id: "t1", text: `Hey ${b.name}! Want to revise ${b.subject} later?`, ts: Date.now() - 1000 * 60 * 60 * 22, from: "me" },
        { id: "t2", text: "Sure! I’m free after 9pm.", ts: Date.now() - 1000 * 60 * 60 * 21.5, from: "them" },
      ];
    }
    return seed;
  });

  return (
    <section className="grid md:grid-cols-[320px_minmax(0,1fr)] gap-4 min-h-[calc(100vh-160px)]">
      <Card className="overflow-hidden rounded-2xl flex flex-col border border-slate-200 bg-white">
        <div className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white">
          <div className="px-4 py-3">
            <div className="text-lg font-semibold">Chats</div>
            <div className="text-xs text-white/90">Study buddies</div>
          </div>
        </div>
        <CardContent className="p-0 flex-1 overflow-auto">
          <div className="border-t">
            {MOCK_BUDDIES.map((b) => {
              const msgs = threads[b.id] || [];
              const last = msgs[msgs.length - 1];
              const isActive = selected?.id === b.id;
              const tones = toneFor(b.subject);
              return (
                <button
                  key={b.id}
                  onClick={() => setSelected(b)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition ${tones.row} ${isActive ? "bg-slate-50" : ""}`}
                >
                  <Avatar className="w-9 h-9 shrink-0 ring-2 ring-offset-1 ring-indigo-300">
                    <AvatarFallback>{b.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="font-medium truncate text-slate-900">{b.name}</div>
                        <span className={`rounded-full text-[10px] px-2 py-0.5 ring-1 ${tones.chip}`}>{b.subject}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 shrink-0">{last ? timeShort(last.ts) : ""}</div>
                    </div>
                    <div className="mt-1 text-xs text-slate-600 truncate">{last ? last.text : "No messages yet"}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Right chat window */}
      <Card className="rounded-2xl overflow-hidden flex flex-col border border-slate-200 bg-white">
        {selected ? (
          <ChatWindow buddy={selected} messages={threads[selected.id] || []} onSend={(text) => {
            const buddyId = selected.id;
            const now = Date.now();
            const myMsg: ChatMsg = { id: cryptoId(), text, ts: now, from: "me" };
            const theirMsg: ChatMsg = { id: cryptoId(), text: "Got it 👍 See you later!", ts: now + 600, from: "them" };
            setThreads((prev) => ({ ...prev, [buddyId]: [...(prev[buddyId] || []), myMsg] }));
            setTimeout(() => setThreads((prev) => ({ ...prev, [buddyId]: [...(prev[buddyId] || []), theirMsg] })), 600);
          }} />
        ) : (
          <div className="grid place-items-center flex-1 text-sm text-slate-500">Select a buddy to start chatting</div>
        )}
      </Card>
    </section>
  );
}

function ChatWindow({
  buddy,
  messages,
  onSend,
}: {
  buddy: { id: number; name: string; subject: string };
  messages: ChatMsg[];
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleSend = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
    setTyping(true);
    setTimeout(() => setTyping(false), 1200);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white flex items-center gap-3">
        <Avatar className="w-9 h-9 shrink-0 ring-1 ring-white/30">
          <AvatarFallback className="bg-white text-indigo-600 font-bold">
            {buddy.name[0]}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="font-medium leading-tight truncate">{buddy.name}</div>
          <div className="text-xs text-white/90 truncate">
            Subject: <span className="font-medium">{buddy.subject}</span> ·{" "}
            <span className="text-emerald-200">{typing ? "typing…" : "online"}</span>
          </div>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="flex-1 min-h-0 overflow-y-auto bg-[rgb(248,250,252)] p-3"
      >
        {messages.map((m) => (
          <ChatBubble key={m.id} you={m.from === "me"} ts={m.ts}>
            {m.text}
          </ChatBubble>
        ))}
      </div>

      {/* Input bar */}
      <div className="p-3 border-t bg-white">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Type a message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            className="rounded-2xl"
          />
          <Button className="rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:opacity-90">
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}


function ChatBubble({ children, you, ts }: { children: React.ReactNode; you?: boolean; ts?: number }) {
  return (
    <div className={`flex ${you ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${you ? "bg-slate-900 text-white rounded-br-md" : "bg-white border border-slate-200 text-slate-800 rounded-bl-md"}`}>
        <div>{children}</div>
        {!!ts && (
          <div className={`mt-1 text-[10px] flex items-center gap-1 ${you ? "text-slate-300" : "text-slate-500"}`}>
            {timeShort(ts)} {you && <Check className="w-3 h-3 inline-block" />}
          </div>
        )}
      </div>
    </div>
  );
}




/************** Community **************/
function Community() {
  const [feed, setFeed] = useState(getFeed());
  const [post, setPost] = useState("");
  const [streak, setStreak] = useState(getInitialStreak());

  type Suggestion = { id: number; name: string; subjects: string[]; mutuals: number };

  const initialSuggestions: Suggestion[] = [
    { id: 201, name: "Nadia", subjects: ["Mathematics", "Physics"], mutuals: 3 },
    { id: 202, name: "Irfan", subjects: ["English", "Essay Writing"], mutuals: 2 },
    { id: 203, name: "Sofia", subjects: ["Biology", "Chemistry"], mutuals: 1 },
    { id: 204, name: "Ken", subjects: ["Mathematics", "Chemistry"], mutuals: 4 },
  ];

  const [suggestions, setSuggestions] = useState<Suggestion[]>(() =>
    storage.get("pymk", initialSuggestions)
  );

  const saveSuggestions = (list: Suggestion[]) => {
    setSuggestions(list);
    storage.set("pymk", list);
  };

  const addPost = () => {
    if (!post.trim()) return;
    const now = Date.now();
    const newPost = {
      id: now,
      name: "You",
      content: post.trim(),
      ts: new Date(now).toISOString(),
      createdAt: now,
    };
    pushFeed(newPost);
    setFeed(getFeed());
    setPost("");
    toast.success("Posted");
  };

  const checkIn = () => {
    const s = streak + 1;
    setStreak(s);
    localStorage.setItem("streak", String(s));
    toast.success("Checked in!");
  };

  const connectWith = (s: Suggestion) => {
    const now = Date.now();
    pushFeed({
      id: now,
      name: "You",
      content: `connected with ${s.name} 🎉`,
      ts: new Date(now).toISOString(),
      createdAt: now,
    });
    setFeed(getFeed());
    saveSuggestions(suggestions.filter((x) => x.id !== s.id));
  };

  return (
    <section className="grid md:grid-cols-3 gap-4">
      <Card className="md:col-span-2 rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white px-4 py-3">
          <CardTitle className="text-lg">Community Feed</CardTitle>
          <CardDescription className="text-xs text-white/80">
            Share progress & keep each other accountable
          </CardDescription>
        </div>
        <CardContent className="space-y-3 mt-3">
          <div className="flex gap-2">
            <Input
              placeholder="Share an update…"
              value={post}
              onChange={(e) => setPost(e.target.value)}
              className="rounded-xl"
            />
            <Button
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:opacity-90"
              onClick={addPost}
            >
              Post
            </Button>
          </div>

          <div className="space-y-3">
            {[...feed]
              .sort((a, b) => {
                const aTime = typeof a.createdAt === "number" ? a.createdAt : Date.parse(a.ts);
                const bTime = typeof b.createdAt === "number" ? b.createdAt : Date.parse(b.ts);
                return bTime - aTime;
              })
              .map((item) => (
                <Card key={item.id} className="rounded-xl hover:shadow-md transition">
                  <CardHeader className="pb-2">
                    <div className="flex items-start gap-2">
                      <Avatar className="w-8 h-8 shrink-0 ring-1 ring-indigo-200">
                        <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
                          {item.name?.[0] ?? "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-sm leading-tight">
                        <span className="font-medium">{item.name}</span>{" "}
                        <span className="text-slate-500">
                          • {new Date(item.ts).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 text-sm">{item.content}</CardContent>
                </Card>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Suggestions */}
      <div className="space-y-4">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>People You May Know</CardTitle>
            <CardDescription>Connect with learners who share your interests</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.length === 0 && (
              <div className="text-sm text-slate-500">No more suggestions for now.</div>
            )}
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 transition"
              >
                <Avatar className="w-9 h-9 shrink-0 ring-1 ring-indigo-200">
                  <AvatarFallback className="bg-indigo-100 text-indigo-700">
                    {s.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-medium truncate leading-tight">{s.name}</div>
                    <div className="text-[11px] text-slate-500 whitespace-nowrap">
                      {s.mutuals} mutual
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.subjects.map((sub) => (
                      <span
                        key={sub}
                        className="rounded-full text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700"
                      >
                        {sub}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:opacity-90"
                      onClick={() => connectWith(s)}
                    >
                      Connect
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl hover:bg-indigo-50"
                      onClick={() =>
                        saveSuggestions(suggestions.filter((x) => x.id !== s.id))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}


/************** LIVE SESSION **************/
function LiveSession() {
  const [tab, setTab] = useState<"whiteboard" | "notes" | "resources">("whiteboard");
  return (
    <section className="grid md:grid-cols-3 gap-4 min-h-[calc(100vh-200px)]">
      <Card className="md:col-span-2 min-h-[360px]">
        <CardHeader><CardTitle>Classroom</CardTitle><CardDescription>Video & tools</CardDescription></CardHeader>
        <CardContent className="grid gap-3">
          <div className="aspect-video w-full bg-black/80 rounded-xl grid place-items-center text-white">Video Placeholder</div>
          <div className="rounded-xl border bg-white">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
              <TabsList className="m-3"><TabsTrigger value="whiteboard">Whiteboard</TabsTrigger><TabsTrigger value="notes">Notes</TabsTrigger><TabsTrigger value="resources">Resources</TabsTrigger></TabsList>
              <TabsContent value="whiteboard" className="p-3 pt-0"><Whiteboard /></TabsContent>
              <TabsContent value="notes" className="p-3 pt-0"><NotesPad /></TabsContent>
              <TabsContent value="resources" className="p-3 pt-0"><ResourcesList /></TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Chat</CardTitle><CardDescription>Session messages</CardDescription></CardHeader>
        <CardContent className="space-y-2"><ChatBubble>Welcome! Today we’ll revise algebra.</ChatBubble><ChatBubble you>Can we try factoring?</ChatBubble><div className="flex gap-2 mt-2"><Input placeholder="Type a message" /><Button>Send</Button></div></CardContent>
      </Card>
    </section>
  );
}
function Whiteboard() { const canvasRef = useRef<HTMLCanvasElement | null>(null); const [drawing, setDrawing] = useState(false); useEffect(() => { const canvas = canvasRef.current; if (!canvas) return; const dpr = window.devicePixelRatio || 1; const rect = canvas.getBoundingClientRect(); canvas.width = rect.width * dpr; canvas.height = rect.height * dpr; const ctx = canvas.getContext("2d"); if (ctx) ctx.scale(dpr, dpr); }, []); const handlePointer = (e: React.PointerEvent<HTMLCanvasElement>) => { const canvas = canvasRef.current!; const ctx = canvas.getContext("2d")!; const rect = canvas.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top; if (e.type === "pointerdown") { setDrawing(true); ctx.beginPath(); ctx.moveTo(x, y); } if (e.type === "pointermove" && drawing) { ctx.lineTo(x, y); ctx.stroke(); } if (e.type === "pointerup" || e.type === "pointerleave") { setDrawing(false); } }; return (<div className="rounded-xl border overflow-hidden"><canvas ref={canvasRef} onPointerDown={handlePointer} onPointerMove={handlePointer} onPointerUp={handlePointer} onPointerLeave={handlePointer} className="w-full h-64 bg-white cursor-crosshair" /></div>); }
function NotesPad() { const [text, setText] = useState(""); return (<div className="space-y-2"><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type session notes…" className="w-full h-40 rounded-xl border p-2 text-sm" /><div className="text-xs text-slate-500">Autosave (mock)</div></div>); }
function ResourcesList() { const items = [{ id: 1, title: "Quadratic formula cheat sheet", type: "PDF" }, { id: 2, title: "Factoring practice (10 problems)", type: "Worksheet" },]; return (<div className="space-y-2">{items.map(i => (<div key={i.id} className="p-2 rounded-lg border flex items-center justify-between"><div className="text-sm"><span className="font-medium">{i.title}</span> <span className="text-slate-500">• {i.type}</span></div><Button size="sm" variant="outline" className="rounded-xl" onClick={() => toast("Downloading (mock)")}>Download</Button></div>))}</div>); }

/************** PROGRESS PAGE  **************/
function ProgressPage({ weakness }: { weakness: string[] }) {
  type Task = { id: string; title: string; subject: string; done: boolean; status?: "Planned" | "In Progress" | "Done" };
  type Activity = { id: string | number; type: "video" | "revision"; date: string; subject: string; tutor?: string; title: string; notes?: string; durationMin?: number };

  const fallbackFocus = weakness?.length ? weakness : ["Algebra", "Essay Writing"];
  const getStreak = () => Number(localStorage.getItem("streak") || 0);

  const seedTasks = (): Task[] => {
    const base = fallbackFocus.slice(0, 3);
    const now = Date.now();
    return base.map((subj, i) => ({
      id: `${now}-${i}`,
      title:
        i === 0
          ? `30 min practice on ${subj}`
          : i === 1
            ? `Revise 1 chapter: ${subj}`
            : `1 quiz attempt: ${subj}`,
      subject: subj,
      done: false,
      status: "Planned",
    }));
  };

  const loadTasks = (): Task[] => {
    try {
      const raw = localStorage.getItem("tasks_today");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { }
    const seeded = seedTasks();
    localStorage.setItem("tasks_today", JSON.stringify(seeded));
    return seeded;
  };

  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [streak] = useState(getStreak());

  const SUBJECT_OPTIONS = Array.from(new Set(fallbackFocus));
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState<string>(SUBJECT_OPTIONS[0] || "General");

  const toggleTask = (id: string) =>
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, done: !t.done, status: !t.done ? "Done" : "Planned" } : t
      )
    );

  const addTask = () => {
    const title = newTitle.trim();
    if (!title) return;
    const task: Task = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      subject: newSubject || "General",
      done: false,
      status: "Planned",
    };
    setTasks((prev) => [task, ...prev]);
    setNewTitle("");
    toast.success("Task added");
  };

  const removeTask = (id: string) => setTasks((prev) => prev.filter((t) => t.id !== id));
  const clearCompleted = () => setTasks((prev) => prev.filter((t) => !t.done));

  useEffect(() => {
    try {
      localStorage.setItem("tasks_today", JSON.stringify(tasks));
    } catch { }
  }, [tasks]);

  const doneCount = tasks.filter((t) => t.done).length;
  const pct = Math.round((doneCount / Math.max(tasks.length, 1)) * 100);

  const [activities] = useState<Activity[]>([
    { id: 9001, type: "video", date: "2025-08-24", subject: "Mathematics", tutor: "Tutor Aisha", title: "Video session with Tutor Aisha", notes: "Factoring quadratics (ax²+bx+c)", durationMin: 45 },
    { id: 9002, type: "revision", date: "2025-08-24", subject: "English", title: "Revised: Essay thesis & intros", notes: "Stronger thesis w/ clear stance" },
    { id: 9003, type: "video", date: "2025-08-25", subject: "Physics", tutor: "Tutor Chen", title: "Video session with Tutor Chen", notes: "Newton’s Second Law problems", durationMin: 30 },
    { id: 9004, type: "revision", date: "2025-08-26", subject: "Mathematics", title: "Revised: Algebra practice set", notes: "10 problems on linear equations" },
  ]);

  const ALL_SUBJECTS = Array.from(new Set([...fallbackFocus, ...activities.map((a) => a.subject), "Mathematics", "English", "Physics", "Chemistry", "Biology", "Essay Writing", "Algebra"]));

  const [filterType, setFilterType] = useState<"all" | "video" | "revision">("all");
  const [filterSubject, setFilterSubject] = useState<string>("all");

  const filteredActivities = useMemo(
    () =>
      activities.filter(
        (a) =>
          (filterType === "all" ? true : a.type === filterType) &&
          (filterSubject === "all" ? true : a.subject === filterSubject)
      ),
    [activities, filterType, filterSubject]
  );

  const grouped = useMemo(() => {
    const m = new Map<string, Activity[]>();
    for (const a of filteredActivities) {
      m.set(a.date, [...(m.get(a.date) || []), a]);
    }
    return Array.from(m.entries()).sort((a, b) => (a[0] > b[0] ? -1 : 1));
  }, [filteredActivities]);

  return (
    <section className="grid md:grid-cols-2 gap-4">
      <div className="space-y-4">
        <Card className="rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white px-4 py-3">
            <CardTitle className="text-lg">Today’s Tasks</CardTitle>
            <CardDescription className="text-xs text-white/80">
              Add, check off, and track progress
            </CardDescription>
          </div>

          <CardContent className="space-y-4 mt-3">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-xl border bg-indigo-50">
                <div className="text-xs text-indigo-700">Learning streak</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">{streak}</div>
              </div>
            </div>

            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
              <Input
                placeholder="Add a task (e.g., 'Finish Algebra worksheet')"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="flex-1 min-w-[220px] rounded-xl"
              />
              <Select value={newSubject} onValueChange={setNewSubject}>
                <SelectTrigger className="w-48 rounded-xl">
                  <SelectValue placeholder="Subject" />
                </SelectTrigger>
                <SelectContent>
                  {(SUBJECT_OPTIONS.length ? SUBJECT_OPTIONS : ["General"]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:opacity-90"
                onClick={addTask}
              >
                Add
              </Button>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>
                  {doneCount}/{tasks.length} completed
                </span>
                <span>{pct}%</span>
              </div>
              <Progress value={pct} />
            </div>

            <div className="space-y-2">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 p-2 rounded-lg border bg-white"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Checkbox checked={t.done} onCheckedChange={() => toggleTask(t.id)} />
                    <div className="min-w-0">
                      <div className={`text-sm ${t.done ? "line-through text-slate-400" : ""}`}>
                        {t.title}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                        Subject: {t.subject}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full ${t.done
                        ? "bg-emerald-100 text-emerald-700"
                        : t.status === "In Progress"
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-slate-100 text-slate-700"
                        }`}
                    >
                      {t.done ? "Done" : t.status || "Planned"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => removeTask(t.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              {tasks.length === 0 && (
                <div className="text-sm text-slate-500">No tasks for today.</div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl hover:bg-indigo-50"
                onClick={clearCompleted}
              >
                Clear completed
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Focus Areas</CardTitle>
            <CardDescription>Your current priorities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {fallbackFocus.map((w) => (
                <Badge key={w} variant="secondary" className="rounded-full bg-indigo-50 text-indigo-700">
                  {w}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white px-4 py-3">
          <CardTitle className="text-lg">My Activity History</CardTitle>
          <CardDescription className="text-xs text-white/80">
            Video sessions with tutors & what you revised
          </CardDescription>
        </div>

        <CardContent className="space-y-3 mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
              <SelectTrigger className="w-36 rounded-xl">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="video">Video sessions</SelectItem>
                <SelectItem value="revision">Revisions</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger className="w-48 rounded-xl">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {ALL_SUBJECTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {grouped.length === 0 && (
              <div className="text-sm text-slate-500">No activity matches your filters.</div>
            )}

            {grouped.map(([date, items]) => (
              <div key={date}>
                <div className="text-xs text-slate-500 mb-2">{date}</div>
                <div className="space-y-2">
                  {items.map((a) => (
                    <div key={a.id} className="p-3 rounded-lg border bg-white flex items-start gap-3">
                      <div className="mt-0.5">
                        {a.type === "video" ? (
                          <div className="w-9 h-9 rounded-md bg-slate-900 grid place-items-center text-white text-[10px]">
                            ▶
                          </div>
                        ) : (
                          <div className="w-9 h-9 rounded-md bg-indigo-50 grid place-items-center text-indigo-700 text-[10px]">
                            📘
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify_between gap-3">
                          <div className="font-medium truncate">{a.title}</div>
                          <span className="rounded-full text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700">
                            {a.subject}
                          </span>
                        </div>

                        <div className="mt-1 text-sm text-slate-700">
                          {a.type === "video" && a.tutor ? (
                            <span>
                              With <span className="font-medium">{a.tutor}</span>
                              {a.durationMin ? ` • ${a.durationMin} min` : ""}
                            </span>
                          ) : (
                            <span>{a.notes || "Revision session"}</span>
                          )}
                        </div>

                        {a.type === "video" && (
                          <div className="mt-2">
                            <Button size="sm" variant="outline" className="rounded-xl" disabled>
                              Watch replay (prototype)
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}


/************** Hidden runtime tests **************/
function HiddenTests() {
  useEffect(() => {
  }, []);
  return (
    <div style={{ display: "none" }} aria-hidden>
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">ok</TabsContent>
        <TabsContent value="b">ok</TabsContent>
      </Tabs>
    </div>
  );
}

