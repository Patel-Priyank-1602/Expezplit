import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useUser } from "@clerk/react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  RadialBarChart,
  RadialBar,
} from "recharts";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  subMonths,
  getDay,
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
  isSameMonth,
  differenceInDays,
  isSameYear,
} from "date-fns";
import { supabase } from "./lib/supabase";

/* ─── Types ─── */
type Expense = {
  id: string;
  name: string;
  category: string;
  amount: number;
  created_at: string;
};

type GroupRow = { id: string; name: string; user_id: string };
type GroupMemberRow = { id: string; group_id: string; name: string; email: string };
type GroupExpenseRow = { id: string; group_id: string; description: string; amount: number; paid_by_id: string; created_at: string };
type GroupExpenseSplitRow = { expense_id: string; member_id: string; amount: number };

type CurrencyCode = string;

const BASE_CURRENCY: CurrencyCode = "INR";
const EXCHANGE_RATE_API_KEY = import.meta.env.VITE_EXCHANGE_RATE_API_KEY;

const DEFAULT_CURRENCY_META: Record<string, { symbol: string; label: string }> = {
  INR: { symbol: "₹", label: "Indian Rupee" },
  USD: { symbol: "$", label: "US Dollar" },
  EUR: { symbol: "€", label: "Euro" },
  GBP: { symbol: "£", label: "British Pound" },
  JPY: { symbol: "¥", label: "Japanese Yen" },
  AUD: { symbol: "A$", label: "Australian Dollar" },
  CAD: { symbol: "C$", label: "Canadian Dollar" },
};

const LEGACY_SYMBOL_TO_CODE: Record<string, string> = {
  "₹": "INR", $: "USD", "€": "EUR", "£": "GBP", "¥": "JPY",
};

const CURRENCY_DISPLAY_NAMES =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "currency" })
    : null;

const getCurrencyName = (code: string) => {
  const upper = code.toUpperCase();
  return DEFAULT_CURRENCY_META[upper]?.label ?? CURRENCY_DISPLAY_NAMES?.of(upper) ?? upper;
};

const getCurrencySymbol = (code: string) => {
  const upper = code.toUpperCase();
  if (DEFAULT_CURRENCY_META[upper]?.symbol) return DEFAULT_CURRENCY_META[upper].symbol;
  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency", currency: upper, currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).formatToParts(0);
    const cp = parts.find((p) => p.type === "currency")?.value;
    return cp && cp.trim() ? cp : upper;
  } catch { return upper; }
};

const formatCurrencyChip = (code: string) => {
  const symbol = getCurrencySymbol(code);
  if (symbol.toUpperCase() === code.toUpperCase()) return code;
  return `${code} (${symbol})`;
};

const COLORS = [
  "#7C5CFC", "#3B82F6", "#22C55E", "#F59E0B", "#EF4444",
  "#EC4899", "#14B8A6", "#8B5CF6", "#06B6D4", "#F97316",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ─── SVG Icons ─── */
const Icons = {
  dollar: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  calendar: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  pulse: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  layers: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  trendUp: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  streak: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  trophy: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  ),
  pause: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="10" y1="15" x2="10" y2="9" /><line x1="14" y1="15" x2="14" y2="9" />
    </svg>
  ),
  hash: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  ),
  target: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  ),
  barChart: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
};

/* ─── Compact number formatting ─── */
const fmtCompact = (n: number, sym: string) => {
  if (n >= 100000) return `${sym}${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${sym}${(n / 1000).toFixed(1)}K`;
  return `${sym}${n.toFixed(2)}`;
};

export function Analytics() {
  const { user } = useUser();
  const userId = user?.id;
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyticsMode, setAnalyticsMode] = useState<"expense" | "splitwise">("expense");
  const [momMonths, setMomMonths] = useState(6);
  const [catTrendMonths, setCatTrendMonths] = useState(6);
  const [swGroups, setSwGroups] = useState<GroupRow[]>([]);
  const [swMembers, setSwMembers] = useState<GroupMemberRow[]>([]);
  const [swExpenses, setSwExpenses] = useState<GroupExpenseRow[]>([]);
  const [swSplits, setSwSplits] = useState<GroupExpenseSplitRow[]>([]);

  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>(() => {
    const sc = localStorage.getItem("app_currency_code")?.toUpperCase();
    if (sc && /^[A-Z]{3}$/.test(sc)) return sc;
    const ls = localStorage.getItem("app_currency");
    if (ls && ls in LEGACY_SYMBOL_TO_CODE) return LEGACY_SYMBOL_TO_CODE[ls];
    return BASE_CURRENCY;
  });

  const [conversionRates, setConversionRates] = useState<Record<string, number>>({ [BASE_CURRENCY]: 1 });
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [lastRateUpdate, setLastRateUpdate] = useState<string | null>(null);
  const [isCurrencyMenuOpen, setIsCurrencyMenuOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  
  const currencyMenuRef = useRef<HTMLDivElement | null>(null);
  const currencySearchInputRef = useRef<HTMLInputElement | null>(null);

  const hasSelectedRate = currencyCode === BASE_CURRENCY || (conversionRates[currencyCode] ?? 0) > 0;
  const activeCurrencyCode: CurrencyCode = hasSelectedRate ? currencyCode : BASE_CURRENCY;
  const currencySymbol = getCurrencySymbol(activeCurrencyCode);
  const selectedRate = activeCurrencyCode === BASE_CURRENCY ? 1 : (conversionRates[activeCurrencyCode] ?? 1);

  const availableCurrencyCodes = useMemo(() => {
    const codes = Object.keys(conversionRates)
      .map((code) => code.toUpperCase())
      .filter((code) => /^[A-Z]{3}$/.test(code));

    if (!codes.includes(BASE_CURRENCY)) codes.push(BASE_CURRENCY);
    return Array.from(new Set(codes)).sort((a, b) => a.localeCompare(b));
  }, [conversionRates]);

  const filteredCurrencyCodes = useMemo(() => {
    const query = currencySearch.trim().toLowerCase();
    if (!query) return availableCurrencyCodes;

    return availableCurrencyCodes.filter((code) => {
      const label = getCurrencyName(code).toLowerCase();
      return code.toLowerCase().includes(query) || label.includes(query);
    });
  }, [availableCurrencyCodes, currencySearch]);

  const convertFromBase = useCallback((base: number) => base * selectedRate, [selectedRate]);

  useEffect(() => {
    if (!EXCHANGE_RATE_API_KEY) return;
    const controller = new AbortController();
    const fetchRates = async () => {
      setRatesLoading(true);
      try {
        const response = await fetch(`https://v6.exchangerate-api.com/v6/${EXCHANGE_RATE_API_KEY}/latest/${BASE_CURRENCY}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Rate API request failed");
        const payload = await response.json();
        if (payload.result === "success" && payload.conversion_rates) {
          setConversionRates({ ...payload.conversion_rates, [BASE_CURRENCY]: 1 });
          setLastRateUpdate(payload.time_last_update_utc ?? new Date().toISOString());
          setRatesError(null);
        } else {
          throw new Error("API returned invalid data");
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Error fetching exchange rates:", err);
          setRatesError("Live FX rates unavailable. Showing stored base amounts.");
        }
      } finally {
        setRatesLoading(false);
      }
    };
    fetchRates();
    const interval = window.setInterval(fetchRates, 5 * 60 * 1000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("app_currency_code", currencyCode);
  }, [currencyCode]);

  useEffect(() => {
    if (isCurrencyMenuOpen) {
      currencySearchInputRef.current?.focus();
    }
  }, [isCurrencyMenuOpen]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!currencyMenuRef.current) return;
      if (!currencyMenuRef.current.contains(event.target as Node)) {
        setIsCurrencyMenuOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsCurrencyMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  useEffect(() => {
    const updateViewport = () => {
      setIsMobileViewport(window.innerWidth <= 640);
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  const fetchExpenses = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase.from("expenses").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) console.error("Error fetching expenses:", error.message);
    else setExpenses(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const fetchSplitwiseAnalytics = useCallback(async () => {
    if (!userId) return;

    const { data: ownedGroups, error: ownedErr } = await supabase
      .from("groups")
      .select("id,name,user_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (ownedErr) {
      console.error("Error fetching owned splitwise groups:", ownedErr.message);
      setSwGroups([]);
      setSwMembers([]);
      setSwExpenses([]);
      setSwSplits([]);
      return;
    }

    let joinedGroups: GroupRow[] = [];
    if (userEmail) {
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("email", userEmail);

      const ownedIds = new Set((ownedGroups ?? []).map((g: GroupRow) => g.id));
      const joinedIds = (memberships ?? [])
        .map((m: { group_id: string }) => m.group_id)
        .filter((id: string) => !ownedIds.has(id));

      if (joinedIds.length > 0) {
        const { data: joinedRows } = await supabase
          .from("groups")
          .select("id,name,user_id")
          .in("id", joinedIds)
          .order("created_at", { ascending: true });
        joinedGroups = (joinedRows ?? []) as GroupRow[];
      }
    }

    const groups = [...((ownedGroups ?? []) as GroupRow[]), ...joinedGroups];
    setSwGroups(groups);

    if (groups.length === 0) {
      setSwMembers([]);
      setSwExpenses([]);
      setSwSplits([]);
      return;
    }

    const groupIds = groups.map((g) => g.id);
    const [{ data: membersData }, { data: expensesData }] = await Promise.all([
      supabase.from("group_members").select("id,group_id,name,email").in("group_id", groupIds),
      supabase.from("group_expenses").select("id,group_id,description,amount,paid_by_id,created_at").in("group_id", groupIds),
    ]);

    const expensesRows = (expensesData ?? []) as GroupExpenseRow[];
    setSwMembers((membersData ?? []) as GroupMemberRow[]);
    setSwExpenses(expensesRows);

    if (expensesRows.length === 0) {
      setSwSplits([]);
      return;
    }

    const { data: splitRows } = await supabase
      .from("group_expense_splits")
      .select("expense_id,member_id,amount")
      .in("expense_id", expensesRows.map((e) => e.id));

    setSwSplits((splitRows ?? []) as GroupExpenseSplitRow[]);
  }, [userId, userEmail]);

  useEffect(() => {
    fetchSplitwiseAnalytics();
  }, [fetchSplitwiseAnalytics]);

  /* ════════════════════════════════════════════
     COMPUTED DATA
     ════════════════════════════════════════════ */

  const now = new Date();

  /* 1. Month-over-Month */
  const monthlyComparison = useMemo(() => {
    const months: { key: string; label: string; total: number; count: number }[] = [];
    for (let i = momMonths - 1; i >= 0; i--) {
      const date = subMonths(now, i);
      const key = format(date, "yyyy-MM");
      const label = format(date, "MMM yy");
      const me = expenses.filter((e) => format(parseISO(e.created_at), "yyyy-MM") === key);
      const total = me.reduce((s, e) => s + convertFromBase(e.amount), 0);
      months.push({ key, label, total, count: me.length });
    }
    return months;
  }, [expenses, momMonths, convertFromBase]);

  const momChange = useMemo(() => {
    if (monthlyComparison.length < 2) return null;
    const c = monthlyComparison[monthlyComparison.length - 1].total;
    const p = monthlyComparison[monthlyComparison.length - 2].total;
    if (p === 0) return c > 0 ? 100 : 0;
    return ((c - p) / p) * 100;
  }, [monthlyComparison]);

  /* 2. Average Daily */
  const dailyAvgStats = useMemo(() => {
    const thisMonth = expenses.filter((e) => isSameMonth(parseISO(e.created_at), now));
    const totalThisMonth = thisMonth.reduce((s, e) => s + convertFromBase(e.amount), 0);
    const daysElapsed = now.getDate();
    const avgDaily = daysElapsed > 0 ? totalThisMonth / daysElapsed : 0;
    if (expenses.length === 0) return { avgDaily, avgAllTime: 0, totalThisMonth, projectedMonth: 0 };
    const dates = expenses.map((e) => parseISO(e.created_at).getTime());
    const earliest = new Date(Math.min(...dates));
    const totalDays = Math.max(1, differenceInDays(now, earliest) + 1);
    const allTimeTotal = expenses.reduce((s, e) => s + convertFromBase(e.amount), 0);
    const daysInMonth = endOfMonth(now).getDate();
    const projectedMonth = daysElapsed > 0 ? (totalThisMonth / daysElapsed) * daysInMonth : 0;
    return { avgDaily, avgAllTime: allTimeTotal / totalDays, totalThisMonth, projectedMonth };
  }, [expenses, convertFromBase]);

  /* 3. Biggest Day */
  const biggestDay = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    expenses.forEach((e) => {
      const k = format(parseISO(e.created_at), "yyyy-MM-dd");
      const p = map.get(k) ?? { total: 0, count: 0 };
      map.set(k, { total: p.total + convertFromBase(e.amount), count: p.count + 1 });
    });
    let mx = { date: "", total: 0, count: 0 };
    map.forEach((v, k) => { if (v.total > mx.total) mx = { date: k, ...v }; });
    return mx.date ? { ...mx, label: format(parseISO(mx.date), "dd MMM yyyy"), dayName: DAY_NAMES[getDay(parseISO(mx.date))] } : null;
  }, [expenses, convertFromBase]);

  /* 4. Biggest Week */
  const biggestWeek = useMemo(() => {
    if (expenses.length === 0) return null;
    const dates = expenses.map((e) => parseISO(e.created_at));
    const earliest = new Date(Math.min(...dates.map((d) => d.getTime())));
    const latest = new Date(Math.max(...dates.map((d) => d.getTime())));
    const weeks = eachWeekOfInterval({ start: earliest, end: latest }, { weekStartsOn: 1 });
    let mx = { start: "", end: "", total: 0, count: 0 };
    weeks.forEach((ws) => {
      const we = endOfWeek(ws, { weekStartsOn: 1 });
      const we2 = expenses.filter((e) => { const d = parseISO(e.created_at); return d >= ws && d <= we; });
      const t = we2.reduce((s, e) => s + convertFromBase(e.amount), 0);
      if (t > mx.total) mx = { start: format(ws, "dd MMM"), end: format(we, "dd MMM yy"), total: t, count: we2.length };
    });
    return mx.total > 0 ? mx : null;
  }, [expenses, convertFromBase]);

  /* 5. Day of Week */
  const dayOfWeekData = useMemo(() => {
    const totals = new Array(7).fill(0);
    const counts = new Array(7).fill(0);
    expenses.forEach((e) => { const d = getDay(parseISO(e.created_at)); totals[d] += convertFromBase(e.amount); counts[d]++; });
    return DAY_NAMES.map((name, i) => ({ day: name, total: totals[i], avg: counts[i] > 0 ? totals[i] / counts[i] : 0 }));
  }, [expenses, convertFromBase]);

  /* 6. Category Trends */
  const { categoryTrendData, categoryTrendSeries } = useMemo(() => {
    const months: string[] = [];
    for (let i = catTrendMonths - 1; i >= 0; i--) months.push(format(subMonths(now, i), "yyyy-MM"));
    const allCats = Array.from(new Set(expenses.map((e) => e.category.trim()).filter(Boolean))).sort();
    const sm = allCats.map((name, i) => ({ key: `ct_${i}`, name, color: COLORS[i % COLORS.length] }));
    const data = months.map((mk) => {
      const row: Record<string, number | string> = { month: format(parseISO(`${mk}-01`), "MMM yy") };
      sm.forEach((s) => {
        row[s.key] = expenses.filter((e) => format(parseISO(e.created_at), "yyyy-MM") === mk && e.category.trim() === s.name)
          .reduce((sum, e) => sum + convertFromBase(e.amount), 0);
      });
      return row;
    });
    return { categoryTrendData: data, categoryTrendSeries: sm };
  }, [expenses, catTrendMonths, convertFromBase]);

  /* 7. Top Categories */
  const topCategories = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    expenses.forEach((e) => {
      const cat = e.category.trim();
      const p = map.get(cat) ?? { total: 0, count: 0 };
      map.set(cat, { total: p.total + convertFromBase(e.amount), count: p.count + 1 });
    });
    const arr = Array.from(map.entries()).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.total - a.total);
    const gt = arr.reduce((s, c) => s + c.total, 0);
    return arr.map((c, i) => ({ ...c, pct: gt > 0 ? ((c.total / gt) * 100) : 0, color: COLORS[i % COLORS.length] }));
  }, [expenses, convertFromBase]);

  /* 8. Spending Pace */
  const spendingPace = useMemo(() => {
    const cms = startOfMonth(now), cme = endOfMonth(now);
    const lms = startOfMonth(subMonths(now, 1)), lme = endOfMonth(subMonths(now, 1));
    const cd = eachDayOfInterval({ start: cms, end: cme }), ld = eachDayOfInterval({ start: lms, end: lme });
    const cm = new Map<number, number>(), lm = new Map<number, number>();
    expenses.forEach((e) => {
      const d = parseISO(e.created_at), a = convertFromBase(e.amount);
      if (d >= cms && d <= cme) cm.set(d.getDate(), (cm.get(d.getDate()) ?? 0) + a);
      else if (d >= lms && d <= lme) lm.set(d.getDate(), (lm.get(d.getDate()) ?? 0) + a);
    });
    const maxD = Math.max(cd.length, ld.length);
    const data: { day: number; current: number; last: number }[] = [];
    let ca = 0, la = 0;
    for (let i = 1; i <= maxD; i++) { ca += cm.get(i) ?? 0; la += lm.get(i) ?? 0; data.push({ day: i, current: ca, last: la }); }
    return data;
  }, [expenses, convertFromBase]);

  /* 9. Streaks */
  const streaks = useMemo(() => {
    if (expenses.length === 0) return { currentStreak: 0, longestStreak: 0, expenseFreeStreak: 0 };
    const expDays = new Set(expenses.map((e) => format(parseISO(e.created_at), "yyyy-MM-dd")));
    let cs = 0; let d = new Date(now);
    while (expDays.has(format(d, "yyyy-MM-dd"))) { cs++; d.setDate(d.getDate() - 1); }
    const sd = Array.from(expDays).sort();
    let ls = 0, ts = 1;
    for (let i = 1; i < sd.length; i++) {
      if (differenceInDays(parseISO(sd[i]), parseISO(sd[i - 1])) === 1) ts++; else { ls = Math.max(ls, ts); ts = 1; }
    }
    ls = Math.max(ls, ts);
    let efs = 0; d = new Date(now);
    if (!expDays.has(format(d, "yyyy-MM-dd"))) { while (!expDays.has(format(d, "yyyy-MM-dd"))) { efs++; d.setDate(d.getDate() - 1); if (differenceInDays(now, d) > 365) break; } }
    return { currentStreak: cs, longestStreak: ls, expenseFreeStreak: efs };
  }, [expenses]);

  /* 10. Top Individual Expenses (this month) */
  const topExpensesThisMonth = useMemo(() => {
    return expenses
      .filter((e) => isSameMonth(parseISO(e.created_at), now))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((e) => ({ ...e, amount: convertFromBase(e.amount) }));
  }, [expenses, convertFromBase]);

  /* 11. Expense Frequency by Hour */
  const hourlyDistribution = useMemo(() => {
    const hours = new Array(24).fill(0);
    expenses.forEach((e) => { hours[parseISO(e.created_at).getHours()]++; });
    return hours.map((count, hour) => ({
      hour: `${hour.toString().padStart(2, "0")}:00`,
      count,
    }));
  }, [expenses]);

  /* 12. Monthly average & projected annual */
  const annualStats = useMemo(() => {
    const thisYear = expenses.filter((e) => isSameYear(parseISO(e.created_at), now));
    const totalYear = thisYear.reduce((s, e) => s + convertFromBase(e.amount), 0);
    const monthsElapsed = now.getMonth() + 1;
    const monthlyAvg = totalYear / monthsElapsed;
    const projectedAnnual = monthlyAvg * 12;
    return { totalYear, monthlyAvg, projectedAnnual, monthsElapsed };
  }, [expenses, convertFromBase]);

  /* 13. Category donut data (this month) */
  const categoryDonut = useMemo(() => {
    const thisMonth = expenses.filter((e) => isSameMonth(parseISO(e.created_at), now));
    const map = new Map<string, number>();
    thisMonth.forEach((e) => {
      const cat = e.category.trim();
      map.set(cat, (map.get(cat) ?? 0) + convertFromBase(e.amount));
    });
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
    return Array.from(map.entries())
      .map(([name, value], i) => ({
        name,
        value,
        pct: total > 0 ? ((value / total) * 100).toFixed(1) : "0",
        color: COLORS[i % COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [expenses, convertFromBase]);

  const splitwiseSummary = useMemo(() => {
    const realExpenses = swExpenses.filter((e) => e.description !== "Payment");
    const settlementExpenses = swExpenses.filter((e) => e.description === "Payment");
    const totalExpenseAmount = realExpenses.reduce((sum, e) => sum + convertFromBase(Number(e.amount)), 0);
    const totalSettlementAmount = settlementExpenses.reduce((sum, e) => sum + convertFromBase(Number(e.amount)), 0);
    const uniqueMembers = new Set(
      swMembers
        .map((m) => (m.email ?? "").trim().toLowerCase())
        .filter((email) => email.length > 0),
    ).size;
    const settlementCoverage = totalExpenseAmount > 0 ? Math.min(100, (totalSettlementAmount / totalExpenseAmount) * 100) : 0;

    return {
      groups: swGroups.length,
      members: uniqueMembers,
      expenses: realExpenses.length,
      settlements: settlementExpenses.length,
      totalExpenseAmount,
      totalSettlementAmount,
      settlementCoverage,
    };
  }, [swGroups, swMembers, swExpenses, convertFromBase]);

  const splitwiseGroupSpend = useMemo(() => {
    const map = new Map<string, number>();
    swExpenses.forEach((e) => {
      if (e.description === "Payment") return;
      map.set(e.group_id, (map.get(e.group_id) ?? 0) + convertFromBase(Number(e.amount)));
    });
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return Array.from(map.entries())
      .map(([groupId, amount], index) => {
        const group = swGroups.find((g) => g.id === groupId);
        return {
          name: group?.name ?? "Unknown Group",
          value: amount,
          pct: total > 0 ? (amount / total) * 100 : 0,
          color: COLORS[index % COLORS.length],
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [swExpenses, swGroups, convertFromBase]);

  const splitwiseMonthlyTrend = useMemo(() => {
    const rows: { month: string; total: number; settlements: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const dt = subMonths(now, i);
      const key = format(dt, "yyyy-MM");
      const label = format(dt, "MMM yy");
      let total = 0;
      let settlements = 0;
      swExpenses.forEach((e) => {
        if (format(parseISO(e.created_at), "yyyy-MM") !== key) return;
        if (e.description === "Payment") settlements += convertFromBase(Number(e.amount));
        else total += convertFromBase(Number(e.amount));
      });
      rows.push({ month: label, total, settlements });
    }
    return rows;
  }, [swExpenses, convertFromBase, now]);


  /* ════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════ */

  // IMPORTANT: All hooks must be called before any early returns (React Rules of Hooks)
  const lastRateUpdateText = useMemo(() => {
    if (!lastRateUpdate) return "";
    const parsed = new Date(lastRateUpdate);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleString();
  }, [lastRateUpdate]);

  const currentMonthTotal = monthlyComparison.length > 0 ? monthlyComparison[monthlyComparison.length - 1].total : 0;
  const progressPct = dailyAvgStats.projectedMonth > 0 ? Math.min(100, (currentMonthTotal / dailyAvgStats.projectedMonth) * 100) : 0;
  const radialData = [{ name: "progress", value: progressPct, fill: "#7C5CFC" }];

  const tooltipStyle = {
    background: "var(--bg-raised)", border: "1px solid var(--border)",
    borderRadius: 8, color: "var(--text)", fontSize: 13,
  };

  const emptyMsg = (msg: string) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: 14 }}>{msg}</div>
  );

  if (loading) return (
    <div className="skeleton-analytics">
      {/* Mode switch skeleton */}
      <div className="skeleton-ana-mode">
        <div className="skeleton skeleton-mode-btn" />
        <div className="skeleton skeleton-mode-btn" />
      </div>

      {/* Section header skeleton */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div className="skeleton skeleton-circle" style={{ width: 28, height: 28 }} />
        <div>
          <div className="skeleton skeleton-line lg" style={{ width: 160 }} />
          <div className="skeleton skeleton-line sm" style={{ width: 220, marginTop: 6 }} />
        </div>
      </div>

      {/* KPI grid skeleton */}
      <div className="skeleton-kpi-grid">
        {[1, 2, 3, 4].map((i) => (
          <div className="skeleton-kpi" key={i}>
            <div className="skeleton skeleton-kpi-icon" />
            <div className="skeleton-kpi-body">
              <div className="skeleton skeleton-line sm" style={{ width: "55%" }} />
              <div className="skeleton skeleton-line xl" style={{ width: "80%" }} />
              <div className="skeleton skeleton-line sm" style={{ width: "65%" }} />
            </div>
          </div>
        ))}
      </div>

      {/* Metrics bar skeleton */}
      <div className="skeleton-metrics-bar">
        {[1, 2, 3, 4, 5].map((i) => (
          <div className="skeleton-metric" key={i}>
            <div className="skeleton skeleton-circle" style={{ width: 28, height: 28 }} />
            <div className="skeleton skeleton-line xl" style={{ width: "50%" }} />
            <div className="skeleton skeleton-line sm" style={{ width: "70%" }} />
          </div>
        ))}
      </div>

      {/* Chart grids skeleton */}
      <div className="skeleton-ana-charts">
        <div className="skeleton-chart-card">
          <div className="skeleton skeleton-line lg" style={{ width: "50%" }} />
          <div className="skeleton skeleton-line sm" style={{ width: "35%" }} />
          <div className="skeleton-chart-area" style={{ minHeight: 180 }}>
            {[55, 40, 70, 50, 65, 45].map((h, i) => (
              <div key={i} className="skeleton skeleton-bar" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
        <div className="skeleton-chart-card">
          <div className="skeleton skeleton-line lg" style={{ width: "55%" }} />
          <div className="skeleton skeleton-line sm" style={{ width: "40%" }} />
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
            <div className="skeleton-chart-donut" />
          </div>
        </div>
      </div>

      {/* Bottom chart skeleton */}
      <div className="skeleton-chart-card">
        <div className="skeleton skeleton-line lg" style={{ width: "45%" }} />
        <div className="skeleton skeleton-line sm" style={{ width: "30%" }} />
        <div className="skeleton-chart-area" style={{ minHeight: 160 }}>
          {[45, 60, 35, 75, 50, 40, 65, 55, 70, 45, 55, 60].map((h, i) => (
            <div key={i} className="skeleton skeleton-bar" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="fade-in analytics-dashboard">
      <div className="ana-mode-switch">
        <button
          className={analyticsMode === "expense" ? "ana-mode-btn active" : "ana-mode-btn"}
          onClick={() => setAnalyticsMode("expense")}
        >
          Expense Tracker
        </button>
        <button
          className={analyticsMode === "splitwise" ? "ana-mode-btn active" : "ana-mode-btn"}
          onClick={() => setAnalyticsMode("splitwise")}
        >
          Splitwise
        </button>
      </div>

      {analyticsMode === "expense" ? (
        <>
          {expenses.length === 0 ? (
            <div className="fade-in analytics-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-muted)", marginBottom: 12 }}>
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>No expense analytics yet</div>
              <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Add expenses in Expense Tracker to unlock insights</div>
            </div>
          ) : (
            <>
      <div className="ana-header-row">
        <div className={`ana-rate-info ${ratesError ? "error" : ""}`}>
          {ratesError
            ? ratesError
            : activeCurrencyCode === BASE_CURRENCY
            ? `Base currency ${BASE_CURRENCY} | Live rates ${ratesLoading ? "updating..." : "active"}`
            : `1 ${BASE_CURRENCY} = ${selectedRate.toFixed(4)} ${activeCurrencyCode}${lastRateUpdateText ? ` | Updated ${lastRateUpdateText}` : ""}`}
        </div>
        <div className="currency-picker" ref={currencyMenuRef}>
          <button
            type="button"
            className={isCurrencyMenuOpen ? "currency-trigger open" : "currency-trigger"}
            onClick={() => {
              setIsCurrencyMenuOpen((open) => {
                const next = !open;
                if (!next) setCurrencySearch("");
                return next;
              });
            }}
            aria-haspopup="listbox"
            aria-expanded={isCurrencyMenuOpen}
          >
            <span className="currency-trigger-main">{formatCurrencyChip(activeCurrencyCode)}</span>
            <span className="currency-trigger-arrow">▾</span>
          </button>

          {isCurrencyMenuOpen && (
            <div className="currency-menu" role="listbox" aria-label="Select currency">
              <div className="currency-menu-search-wrap">
                <input
                  ref={currencySearchInputRef}
                  className="currency-menu-search"
                  value={currencySearch}
                  onChange={(e) => setCurrencySearch(e.target.value)}
                  placeholder="Search code or name"
                />
              </div>

              {currencySearch.trim() ? (
                filteredCurrencyCodes.length > 0 ? (
                  filteredCurrencyCodes.map((code) => {
                    const isActive = code === currencyCode;
                    return (
                      <button
                        key={code}
                        type="button"
                        className={isActive ? "currency-option active" : "currency-option"}
                        onClick={() => {
                          setCurrencyCode(code);
                          setIsCurrencyMenuOpen(false);
                          setCurrencySearch("");
                        }}
                        role="option"
                        aria-selected={isActive}
                      >
                        <span>{formatCurrencyChip(code)}</span>
                        <span className="currency-option-label">{getCurrencyName(code)}</span>
                      </button>
                    );
                  })
                ) : (
                  <div className="currency-option-empty">No currency found</div>
                )
              ) : (
                <>
                  {availableCurrencyCodes.map((code) => {
                    const isActive = code === currencyCode;
                    return (
                      <button
                        key={code}
                        type="button"
                        className={isActive ? "currency-option active" : "currency-option"}
                        onClick={() => {
                          setCurrencyCode(code);
                          setIsCurrencyMenuOpen(false);
                        }}
                        role="option"
                        aria-selected={isActive}
                      >
                        <span>{formatCurrencyChip(code)}</span>
                        <span className="currency-option-label">{getCurrencyName(code)}</span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ Section: Overview KPIs ═══ */}
      <div className="ana-section-header">
        <div className="ana-section-icon">{Icons.trendUp}</div>
        <div>
          <div className="ana-section-title">Financial Overview</div>
          <div className="ana-section-sub">{format(now, "MMMM yyyy")} — Insights at a glance</div>
        </div>
      </div>

      <div className="ana-kpi-grid">
        <div className="ana-kpi">
          <div className="ana-kpi-icon" style={{ background: "linear-gradient(135deg, #7C5CFC, #a78bfa)" }}>{Icons.dollar}</div>
          <div className="ana-kpi-body">
            <div className="ana-kpi-label">This Month</div>
            <div className="ana-kpi-value" style={{ color: "var(--accent)" }}>{currencySymbol}{currentMonthTotal.toFixed(2)}</div>
            {momChange !== null && (
              <div className={`ana-kpi-badge ${momChange >= 0 ? "negative" : "positive"}`}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  {momChange >= 0 ? <><polyline points="18 15 12 9 6 15" /></> : <><polyline points="6 9 12 15 18 9" /></>}
                </svg>
                {Math.abs(momChange).toFixed(1)}% vs last month
              </div>
            )}
          </div>
        </div>

        <div className="ana-kpi">
          <div className="ana-kpi-icon" style={{ background: "linear-gradient(135deg, #3B82F6, #60a5fa)" }}>{Icons.calendar}</div>
          <div className="ana-kpi-body">
            <div className="ana-kpi-label">Daily Average</div>
            <div className="ana-kpi-value" style={{ color: "var(--blue)" }}>{currencySymbol}{dailyAvgStats.avgDaily.toFixed(2)}</div>
            <div className="ana-kpi-hint">All-time: {currencySymbol}{dailyAvgStats.avgAllTime.toFixed(2)}/day</div>
          </div>
        </div>

        <div className="ana-kpi">
          <div className="ana-kpi-icon" style={{ background: "linear-gradient(135deg, #EF4444, #f87171)" }}>{Icons.pulse}</div>
          <div className="ana-kpi-body">
            <div className="ana-kpi-label">Peak Day</div>
            {biggestDay ? (<>
              <div className="ana-kpi-value" style={{ color: "var(--red)" }}>{currencySymbol}{biggestDay.total.toFixed(2)}</div>
              <div className="ana-kpi-hint">{biggestDay.label} ({biggestDay.dayName})</div>
            </>) : <div className="ana-kpi-value" style={{ color: "var(--text-muted)" }}>—</div>}
          </div>
        </div>

        <div className="ana-kpi">
          <div className="ana-kpi-icon" style={{ background: "linear-gradient(135deg, #22C55E, #4ade80)" }}>{Icons.layers}</div>
          <div className="ana-kpi-body">
            <div className="ana-kpi-label">Peak Week</div>
            {biggestWeek ? (<>
              <div className="ana-kpi-value" style={{ color: "var(--green)" }}>{currencySymbol}{biggestWeek.total.toFixed(2)}</div>
              <div className="ana-kpi-hint">{biggestWeek.start} – {biggestWeek.end}</div>
            </>) : <div className="ana-kpi-value" style={{ color: "var(--text-muted)" }}>—</div>}
          </div>
        </div>
      </div>

      {/* ═══ Metrics Bar ═══ */}
      <div className="ana-metrics-bar">
        <div className="ana-metric">
          <div className="ana-metric-icon purple">{Icons.streak}</div>
          <div className="ana-metric-val">{streaks.currentStreak}</div>
          <div className="ana-metric-label">Day Streak</div>
        </div>
        <div className="ana-metrics-divider" />
        <div className="ana-metric">
          <div className="ana-metric-icon amber">{Icons.trophy}</div>
          <div className="ana-metric-val">{streaks.longestStreak}</div>
          <div className="ana-metric-label">Best Streak</div>
        </div>
        <div className="ana-metrics-divider" />
        <div className="ana-metric">
          <div className="ana-metric-icon blue">{Icons.pause}</div>
          <div className="ana-metric-val">{streaks.expenseFreeStreak}</div>
          <div className="ana-metric-label">{streaks.expenseFreeStreak > 0 ? "Idle Days" : "Active"}</div>
        </div>
        <div className="ana-metrics-divider" />
        <div className="ana-metric">
          <div className="ana-metric-icon green">{Icons.hash}</div>
          <div className="ana-metric-val">{expenses.length}</div>
          <div className="ana-metric-label">Total Entries</div>
        </div>
        <div className="ana-metrics-divider" />
        <div className="ana-metric ana-metric--annual">
          <div className="ana-metric-icon red">{Icons.trendUp}</div>
          <div className="ana-metric-val ana-metric-val--annual">{fmtCompact(annualStats.projectedAnnual, currencySymbol)}</div>
          <div className="ana-metric-label">Projected Annual</div>
        </div>
      </div>

      {/* ═══ Section: Monthly Trends ═══ */}
      <div className="ana-section-header">
        <div className="ana-section-icon">{Icons.trendUp}</div>
        <div>
          <div className="ana-section-title">Monthly Trends</div>
          <div className="ana-section-sub">Spending patterns over time</div>
        </div>
      </div>

      {/* Month-over-Month */}
      <div className="ana-row">
        <div className="card ana-chart-card">
          <div className="card-head">
            <div>
              <div className="card-title">Month-over-Month</div>
              <div className="card-sub">Total spending per month</div>
            </div>
            <div className="filter-pills">
              {[3, 6, 12].map((n) => (
                <button key={n} className={momMonths === n ? "pill active" : "pill"} onClick={() => setMomMonths(n)}>{n}M</button>
              ))}
            </div>
          </div>
          <div className="chart-area chart-area--bar">
            {monthlyComparison.every((m) => m.total === 0) ? emptyMsg("No data for this period") : (
              <div className="chart-scroll-wrapper">
                <div className="chart-inner-container chart-inner--bar">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyComparison} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                      <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7C5CFC" stopOpacity={1} />
                          <stop offset="100%" stopColor="#7C5CFC" stopOpacity={0.6} />
                        </linearGradient>
                        <linearGradient id="barGradMuted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7C5CFC" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#7C5CFC" stopOpacity={0.15} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                      <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} tickFormatter={(v: number) => `${currencySymbol}${Math.round(v)}`} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [`${currencySymbol}${Number(value).toFixed(2)}`, "Total"]} cursor={{ fill: "rgba(124, 92, 252, 0.06)" }} />
                      <Bar dataKey="total" name="Spending" radius={[6, 6, 0, 0]} maxBarSize={52}>
                        {monthlyComparison.map((_, i) => (
                          <Cell key={i} fill={i === monthlyComparison.length - 1 ? "url(#barGrad)" : "url(#barGradMuted)"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Spending Pace + Month Progress */}
      <div className="ana-two-col ana-pace-progress-row">
        {/* Spending Pace */}
        <div className="card ana-chart-card ana-pace-card">
          <div className="card-head">
            <div>
              <div className="card-title">Spending Pace</div>
              <div className="card-sub">Cumulative spending: this month vs last</div>
            </div>
          </div>
          <div className="chart-area chart-area--pace">
            {spendingPace.every((d) => d.current === 0 && d.last === 0) ? emptyMsg("No data to compare") : (
              <div className="chart-scroll-wrapper">
                <div className="chart-inner-container chart-inner--pace">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={spendingPace} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                      <defs>
                        <linearGradient id="paceCurrentGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7C5CFC" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#7C5CFC" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="paceLastGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} tickFormatter={(v: number) => `${currencySymbol}${Math.round(v)}`} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [`${currencySymbol}${Number(v).toFixed(2)}`, n === "current" ? "This Month" : "Last Month"]} labelFormatter={(l) => `Day ${l}`} />
                      <Legend
                        layout="horizontal"
                        verticalAlign="bottom"
                        align="center"
                        wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                        formatter={(v) => (v === "current" ? "This Month" : "Last Month")}
                      />
                      <Area type="monotone" dataKey="last" name="last" stroke="#3B82F6" strokeWidth={2} fill="url(#paceLastGrad)" dot={false} strokeDasharray="4 2" />
                      <Area type="monotone" dataKey="current" name="current" stroke="#7C5CFC" strokeWidth={2} fill="url(#paceCurrentGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
          <div className="ana-pace-summary">
            <div className="ana-pace-stat">
              <span className="ana-pace-dot" style={{ background: "#7C5CFC" }} />
              <span className="ana-pace-label">This month:</span>
              <span className="ana-pace-val">{currencySymbol}{(spendingPace[spendingPace.length - 1]?.current ?? 0).toFixed(2)}</span>
            </div>
            <div className="ana-pace-stat">
              <span className="ana-pace-dot" style={{ background: "#3B82F6" }} />
              <span className="ana-pace-label">Last month (same day):</span>
              <span className="ana-pace-val">{currencySymbol}{(spendingPace[now.getDate() - 1]?.last ?? 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Month Progress */}
        <div className="card ana-chart-card ana-progress-card">
          <div className="card-head">
            <div>
              <div className="card-title">Month Progress</div>
              <div className="card-sub">Spending vs projected total</div>
            </div>
          </div>
          <div className="chart-area chart-area--progress">
            <div className="chart-scroll-wrapper">
              <div className="chart-inner-container chart-inner--progress">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" barSize={14} data={radialData} startAngle={180} endAngle={-180}>
                    <RadialBar background={{ fill: "var(--bg-raised)" }} dataKey="value" cornerRadius={8} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="ana-progress-center">
              <div className="ana-progress-pct">{progressPct.toFixed(0)}%</div>
              <div className="ana-progress-label">of projected</div>
            </div>
          </div>
          <div className="ana-progress-details">
            <div className="ana-progress-row">
              <span className="ana-progress-detail-label">Spent so far</span>
              <span className="ana-progress-detail-val">{currencySymbol}{currentMonthTotal.toFixed(2)}</span>
            </div>
            <div className="ana-progress-row">
              <span className="ana-progress-detail-label">Projected total</span>
              <span className="ana-progress-detail-val">{currencySymbol}{dailyAvgStats.projectedMonth.toFixed(2)}</span>
            </div>
            <div className="ana-progress-row">
              <span className="ana-progress-detail-label">Days elapsed</span>
              <span className="ana-progress-detail-val">{now.getDate()} / {endOfMonth(now).getDate()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Section: Deep Analysis ═══ */}
      <div className="ana-section-header">
        <div className="ana-section-icon">{Icons.trendUp}</div>
        <div>
          <div className="ana-section-title">Deep Analysis</div>
          <div className="ana-section-sub">Patterns and distributions</div>
        </div>
      </div>

      {/* Day of Week + Category Donut */}
      <div className="ana-two-col">
        <div className="card ana-chart-card">
          <div className="card-head">
            <div>
              <div className="card-title">Weekly Pattern</div>
              <div className="card-sub">Spending distribution by day of week</div>
            </div>
          </div>
          <div className="chart-area chart-area--sm">
            <div className="chart-scroll-wrapper">
              <div className="chart-inner-container chart-inner--week">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dayOfWeekData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                    <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} tickFormatter={(v: number) => `${currencySymbol}${Math.round(v)}`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${currencySymbol}${Number(v).toFixed(2)}`, "Total"]} cursor={{ fill: "rgba(124, 92, 252, 0.06)" }} />
                    <Bar dataKey="total" name="Total" radius={[6, 6, 0, 0]} maxBarSize={42}>
                      {dayOfWeekData.map((entry) => {
                        const max = Math.max(...dayOfWeekData.map((d) => d.total));
                        return <Cell key={entry.day} fill={entry.total === max && max > 0 ? "#EF4444" : "#3B82F6"} fillOpacity={entry.total === max && max > 0 ? 1 : 0.55} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="card ana-chart-card">
          <div className="card-head">
            <div>
              <div className="card-title">This Month by Category</div>
              <div className="card-sub">Proportional breakdown</div>
            </div>
          </div>
          <div className="chart-area chart-area--donut ana-donut-area">
            {categoryDonut.length === 0 ? emptyMsg("No expenses this month") : (
              <div className="chart-scroll-wrapper">
                <div className="chart-inner-container chart-inner--donut">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryDonut} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3} strokeWidth={0}>
                        {categoryDonut.map((e) => <Cell key={e.name} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: any, _: any, p: any) => [`${currencySymbol}${Number(v).toFixed(2)} (${p.payload.pct}%)`, p.payload.name]} />
                      <Legend
                        className="ana-donut-legend"
                        layout={isMobileViewport ? "horizontal" : "vertical"}
                        verticalAlign={isMobileViewport ? "bottom" : "middle"}
                        align={isMobileViewport ? "center" : "right"}
                        wrapperStyle={isMobileViewport ? { fontSize: 11, paddingTop: 8 } : { fontSize: 12, paddingLeft: 16 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category Trends */}
      <div className="ana-row">
        <div className="card ana-chart-card">
          <div className="card-head">
            <div>
              <div className="card-title">Category Trends</div>
              <div className="card-sub">How each category changes month to month</div>
            </div>
            <div className="filter-pills">
              {[3, 6, 12].map((n) => (
                <button key={n} className={catTrendMonths === n ? "pill active" : "pill"} onClick={() => setCatTrendMonths(n)}>{n}M</button>
              ))}
            </div>
          </div>
          <div className="chart-area chart-area--lg">
            {categoryTrendSeries.length === 0 ? emptyMsg("No category data") : (
              <div className="chart-scroll-wrapper">
                <div className="chart-inner-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={categoryTrendData}
                      margin={{
                        left: 10,
                        right: 10,
                        top: 5,
                        bottom: isMobileViewport ? 28 : 12,
                      }}
                    >
                      <defs>
                        {categoryTrendSeries.map((s) => (
                          <linearGradient key={`tg-${s.key}`} id={`tg-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={s.color} stopOpacity={0.2} />
                            <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                      <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} tickFormatter={(v: number) => `${currencySymbol}${Math.round(v)}`} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [`${currencySymbol}${Number(v).toFixed(2)}`, String(n)]} />
                      <Legend
                        layout="horizontal"
                        verticalAlign="bottom"
                        align="center"
                        height={isMobileViewport ? 56 : 36}
                        wrapperStyle={{
                          fontSize: isMobileViewport ? 11 : 12,
                          paddingTop: 8,
                        }}
                      />
                      {categoryTrendSeries.map((s) => (
                        <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} fill={`url(#tg-${s.key})`} dot={false} />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category Breakdown Table */}
      <div className="card ana-cat-card">
        <div className="card-head">
          <div>
            <div className="card-title">Category Breakdown</div>
            <div className="card-sub">All-time spending distribution</div>
          </div>
        </div>
        <div className="ana-cat-list">
          {topCategories.map((cat) => (
            <div key={cat.name} className="ana-cat-row">
              <div className="ana-cat-left">
                <div className="ana-cat-dot" style={{ background: cat.color }} />
                <div>
                  <div className="ana-cat-name">{cat.name}</div>
                  <div className="ana-cat-meta">{cat.count} expense{cat.count !== 1 ? "s" : ""}</div>
                </div>
              </div>
              <div className="ana-cat-right">
                <div className="ana-cat-amount">{currencySymbol}{cat.total.toFixed(2)}</div>
                <div className="ana-cat-pct">{cat.pct.toFixed(1)}%</div>
              </div>
              <div className="ana-cat-bar-track">
                <div className="ana-cat-bar-fill" style={{ width: `${cat.pct}%`, background: cat.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="ana-section-header">
            <div className="ana-section-icon">{Icons.layers}</div>
            <div>
              <div className="ana-section-title">Splitwise Deep Analytics</div>
              <div className="ana-section-sub">Group health, settlement behavior, and member-level positions</div>
            </div>
          </div>

          {swGroups.length === 0 ? (
            <div className="fade-in analytics-empty">
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>No Splitwise data yet</div>
              <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Create or join groups in Splitwise to see advanced analytics</div>
            </div>
          ) : (
            <>
              <div className="ana-kpi-grid">
                <div className="ana-kpi"><div className="ana-kpi-body"><div className="ana-kpi-label">Groups</div><div className="ana-kpi-value">{splitwiseSummary.groups}</div></div></div>
                <div className="ana-kpi"><div className="ana-kpi-body"><div className="ana-kpi-label">Members</div><div className="ana-kpi-value">{splitwiseSummary.members}</div></div></div>
                <div className="ana-kpi"><div className="ana-kpi-body"><div className="ana-kpi-label">Expense Entries</div><div className="ana-kpi-value">{splitwiseSummary.expenses}</div></div></div>
                <div className="ana-kpi"><div className="ana-kpi-body"><div className="ana-kpi-label">Settlement Coverage</div><div className="ana-kpi-value">{splitwiseSummary.settlementCoverage.toFixed(0)}%</div></div></div>
              </div>

              <div className="ana-two-col">
                <div className="card ana-chart-card">
                  <div className="card-head">
                    <div>
                      <div className="card-title">Monthly Group Activity</div>
                      <div className="card-sub">Expenses vs settlements over last 6 months</div>
                    </div>
                  </div>
                  <div className="chart-area chart-area--lg">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={splitwiseMonthlyTrend} margin={{ left: 10, right: 10, top: 5, bottom: 8 }}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                        <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} tickFormatter={(v: number) => `${currencySymbol}${Math.round(v)}`} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${currencySymbol}${Number(v).toFixed(2)}`} />
                        <Legend />
                        <Area type="monotone" dataKey="total" name="Expenses" stroke="#7C5CFC" fillOpacity={0.2} fill="#7C5CFC" />
                        <Area type="monotone" dataKey="settlements" name="Settlements" stroke="#22C55E" fillOpacity={0.15} fill="#22C55E" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card ana-chart-card">
                  <div className="card-head">
                    <div>
                      <div className="card-title">Spend by Group</div>
                      <div className="card-sub">Which groups drive most shared expenses</div>
                    </div>
                  </div>
                  <div className="chart-area chart-area--donut ana-donut-area">
                    {splitwiseGroupSpend.length === 0 ? emptyMsg("No shared expenses yet") : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={splitwiseGroupSpend} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                            {splitwiseGroupSpend.map((e) => <Cell key={e.name} fill={e.color} />)}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} formatter={(v: any, _: any, p: any) => [`${currencySymbol}${Number(v).toFixed(2)} (${p.payload.pct.toFixed(1)}%)`, p.payload.name]} />
                          <Legend layout={isMobileViewport ? "horizontal" : "vertical"} verticalAlign={isMobileViewport ? "bottom" : "middle"} align={isMobileViewport ? "center" : "right"} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

            </>
          )}
        </>
      )}
    </div>
  );
}
