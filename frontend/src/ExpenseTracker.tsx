import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/react";
import {
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  BarChart,
  Bar,
} from "recharts";
import { format, isSameMonth, isSameYear, parseISO, subDays, addDays, differenceInDays } from "date-fns";
import { supabase } from "./lib/supabase";

type Expense = {
  id: string;
  name: string;
  category: string;
  amount: number;
  created_at: string;
};

type CurrencyCode = string;

type ExchangeRatesApiResponse = {
  result: string;
  time_last_update_utc?: string;
  conversion_rates?: Record<string, number>;
};

const BASE_CURRENCY: CurrencyCode = "INR";
const EXCHANGE_RATE_API_KEY = import.meta.env.VITE_EXCHANGE_RATE_API_KEY;
const RATE_REFRESH_MS = 5 * 60 * 1000;

const DEFAULT_CURRENCY_META: Record<string, { symbol: string; label: string }> = {
  INR: { symbol: "₹", label: "Indian Rupee" },
  USD: { symbol: "$", label: "US Dollar" },
  EUR: { symbol: "€", label: "Euro" },
  GBP: { symbol: "£", label: "British Pound" },
  JPY: { symbol: "¥", label: "Japanese Yen" },
  AUD: { symbol: "A$", label: "Australian Dollar" },
  CAD: { symbol: "C$", label: "Canadian Dollar" },
};

const DEFAULT_CURRENCY_CODES = Object.keys(DEFAULT_CURRENCY_META);

const LEGACY_SYMBOL_TO_CODE: Record<string, string> = {
  "₹": "INR",
  "$": "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
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
      style: "currency",
      currency: upper,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    const currencyPart = parts.find((part) => part.type === "currency")?.value;
    return currencyPart && currencyPart.trim() ? currencyPart : upper;
  } catch {
    return upper;
  }
};

const formatCurrencyChip = (code: string) => {
  const symbol = getCurrencySymbol(code);
  if (symbol.toUpperCase() === code.toUpperCase()) return code;
  return `${code} (${symbol})`;
};

const PIE_COLORS = [
  "#7C5CFC", // purple
  "#3B82F6", // blue
  "#22C55E", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#EC4899", // pink
  "#14B8A6", // teal
  "#8B5CF6", // violet
];

export function ExpenseTracker() {
  const { user } = useUser();
  const userId = user?.id;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [lineRange, setLineRange] = useState<number | "all">(7);
  const [lineType, setLineType] = useState<"daily" | "cumulative">("daily");
  const [lineView, setLineView] = useState<"all" | "category">("all");
  const [selectedPieMonth, setSelectedPieMonth] = useState<string>("month");
  const [selectedStatsMonth, setSelectedStatsMonth] = useState<string>("month");
  const [barRange, setBarRange] = useState<number | "all">(7);
  const [barType, setBarType] = useState<"daily" | "cumulative">("daily");
  const [barView, setBarView] = useState<"all" | "category">("all");
  const [loading, setLoading] = useState(true);
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>(() => {
    const savedCode = localStorage.getItem("app_currency_code")?.toUpperCase();
    if (savedCode && /^[A-Z]{3}$/.test(savedCode)) return savedCode;

    const legacySymbol = localStorage.getItem("app_currency");
    if (legacySymbol && legacySymbol in LEGACY_SYMBOL_TO_CODE) {
      return LEGACY_SYMBOL_TO_CODE[legacySymbol];
    }

    return BASE_CURRENCY;
  });
  const [conversionRates, setConversionRates] = useState<Record<string, number>>({ [BASE_CURRENCY]: 1 });
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [lastRateUpdate, setLastRateUpdate] = useState<string | null>(null);
  const [tooltipData, setTooltipData] = useState<{ x: number; y: number; text: string } | null>(null);
  const [isTopExpensesOpen, setIsTopExpensesOpen] = useState(false);
  const [isRecentExpensesOpen, setIsRecentExpensesOpen] = useState(false);
  const [isCurrencyMenuOpen, setIsCurrencyMenuOpen] = useState(false);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [isStatsMonthDropdownOpen, setIsStatsMonthDropdownOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");
  const currencyMenuRef = useRef<HTMLDivElement | null>(null);
  const currencySearchInputRef = useRef<HTMLInputElement | null>(null);
  const monthDropdownRef = useRef<HTMLDivElement | null>(null);
  const statsMonthDropdownRef = useRef<HTMLDivElement | null>(null);

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

  const defaultVisibleCurrencies = useMemo(
    () => DEFAULT_CURRENCY_CODES.filter((code) => availableCurrencyCodes.includes(code)),
    [availableCurrencyCodes],
  );

  const filteredCurrencyCodes = useMemo(() => {
    const query = currencySearch.trim().toLowerCase();
    if (!query) return availableCurrencyCodes;

    return availableCurrencyCodes.filter((code) => {
      const label = getCurrencyName(code).toLowerCase();
      return code.toLowerCase().includes(query) || label.includes(query);
    });
  }, [availableCurrencyCodes, currencySearch]);

  const nonDefaultCurrencyCodes = useMemo(
    () => availableCurrencyCodes.filter((code) => !DEFAULT_CURRENCY_CODES.includes(code)),
    [availableCurrencyCodes],
  );

  const convertFromBase = useCallback(
    (baseAmount: number) => baseAmount * selectedRate,
    [selectedRate],
  );

  const convertToBase = useCallback(
    (displayAmount: number) => displayAmount / selectedRate,
    [selectedRate],
  );

  const lastRateUpdateText = useMemo(() => {
    if (!lastRateUpdate) return "";
    const parsed = new Date(lastRateUpdate);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleString();
  }, [lastRateUpdate]);

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
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) {
        setIsMonthDropdownOpen(false);
      }
      if (statsMonthDropdownRef.current && !statsMonthDropdownRef.current.contains(event.target as Node)) {
        setIsStatsMonthDropdownOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsCurrencyMenuOpen(false);
        setIsMonthDropdownOpen(false);
        setIsStatsMonthDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  useEffect(() => {
    const isModalOpen = isTopExpensesOpen || isRecentExpensesOpen;
    if (!isModalOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isTopExpensesOpen, isRecentExpensesOpen]);

  useEffect(() => {
    if (!EXCHANGE_RATE_API_KEY) {
      setRatesError("Exchange-rate API key missing. Set VITE_EXCHANGE_RATE_API_KEY.");
      return;
    }

    const controller = new AbortController();

    const fetchRates = async () => {
      setRatesLoading(true);
      try {
        const response = await fetch(
          `https://v6.exchangerate-api.com/v6/${EXCHANGE_RATE_API_KEY}/latest/${BASE_CURRENCY}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error(`Rate API request failed (${response.status})`);
        }

        const payload = (await response.json()) as ExchangeRatesApiResponse;
        if (payload.result !== "success" || !payload.conversion_rates) {
          throw new Error("Rate API returned an invalid response");
        }

        setConversionRates({ ...payload.conversion_rates, [BASE_CURRENCY]: 1 });
        setLastRateUpdate(payload.time_last_update_utc ?? new Date().toISOString());
        setRatesError(null);
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
    const interval = window.setInterval(fetchRates, RATE_REFRESH_MS);

    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  /* Fetch expenses from Supabase */
  const fetchExpenses = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching expenses:", error.message);
    } else {
      setExpenses(data ?? []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  /* Add */
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    const val = parseFloat(amount);
    if (!name.trim() || !category.trim() || isNaN(val) || val <= 0) return;
    const baseAmount = convertToBase(val);

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        user_id: userId,
        name: name.trim(),
        category: category.trim(),
        amount: baseAmount,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding expense:", error.message);
      return;
    }

    setExpenses((p) => [data, ...p]);
    setName("");
    setCategory("");
    setAmount("");
  };

  /* Delete */
  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      console.error("Error deleting expense:", error.message);
      return;
    }
    setExpenses((p) => p.filter((e) => e.id !== id));
  };

  /* Available months for pie chart selector */
  const availableMonths = useMemo(() => {
    const monthSet = new Map<string, { label: string; year: number; month: number }>();
    expenses.forEach((e) => {
      const d = parseISO(e.created_at);
      const key = format(d, "yyyy-MM");
      if (!monthSet.has(key)) {
        monthSet.set(key, {
          label: format(d, "MMMM yyyy"),
          year: d.getFullYear(),
          month: d.getMonth(),
        });
      }
    });
    return Array.from(monthSet.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, meta]) => ({ key, ...meta }));
  }, [expenses]);

  /* Filter for pie chart based on selected mode */
  const filtered = useMemo(() => {
    const now = new Date();
    if (selectedPieMonth === "month") {
      return expenses.filter((e) => {
        const d = parseISO(e.created_at);
        return isSameMonth(d, now) && isSameYear(d, now);
      });
    }
    if (selectedPieMonth === "year") {
      return expenses.filter((e) => {
        const d = parseISO(e.created_at);
        return isSameYear(d, now);
      });
    }
    if (selectedPieMonth === "all") {
      return expenses;
    }
    // Specific month key like "2026-03"
    return expenses.filter((e) => {
      const d = parseISO(e.created_at);
      return format(d, "yyyy-MM") === selectedPieMonth;
    });
  }, [expenses, selectedPieMonth]);

  const convertedFiltered = useMemo(
    () => filtered.map((entry) => ({ ...entry, amount: convertFromBase(entry.amount) })),
    [filtered, convertFromBase],
  );

  /* Filter for stats based on selected mode */
  const statsFiltered = useMemo(() => {
    const now = new Date();
    if (selectedStatsMonth === "month") {
      return expenses.filter((e) => {
        const d = parseISO(e.created_at);
        return isSameMonth(d, now) && isSameYear(d, now);
      });
    }
    if (selectedStatsMonth === "year") {
      return expenses.filter((e) => {
        const d = parseISO(e.created_at);
        return isSameYear(d, now);
      });
    }
    if (selectedStatsMonth === "all") {
      return expenses;
    }
    // Specific month key like "2026-03"
    return expenses.filter((e) => {
      const d = parseISO(e.created_at);
      return format(d, "yyyy-MM") === selectedStatsMonth;
    });
  }, [expenses, selectedStatsMonth]);

  const convertedStatsFiltered = useMemo(
    () => statsFiltered.map((entry) => ({ ...entry, amount: convertFromBase(entry.amount) })),
    [statsFiltered, convertFromBase],
  );

  const allExpensesByAmount = useMemo(
    () => [...expenses].sort((a, b) => b.amount - a.amount),
    [expenses],
  );

  const topExpenses = useMemo(
    () => allExpensesByAmount.slice(0, 5),
    [allExpensesByAmount],
  );

  const allExpensesByRecent = useMemo(
    () => [...expenses].sort((a, b) => parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime()),
    [expenses],
  );

  const maxAmountAcrossAllExpenses = useMemo(
    () => allExpensesByAmount[0]?.amount ?? 0,
    [allExpensesByAmount],
  );

  const recentExpenses = useMemo(
    () => allExpensesByRecent.slice(0, 5),
    [allExpensesByRecent],
  );

  const maxAmountInRecentExpenses = useMemo(
    () => recentExpenses.reduce((max, exp) => Math.max(max, exp.amount), 0),
    [recentExpenses],
  );

  const totalSpent = useMemo(() => convertedStatsFiltered.reduce((s, e) => s + e.amount, 0), [convertedStatsFiltered]);
  const catCount = useMemo(() => new Set(convertedStatsFiltered.map((e) => e.category)).size, [convertedStatsFiltered]);

  const categoryColorMap = useMemo(() => {
    const uniqueCategories = Array.from(new Set(expenses.map((e) => e.category.trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    );

    return Object.fromEntries(
      uniqueCategories.map((cat, index) => [cat, PIE_COLORS[index % PIE_COLORS.length]]),
    ) as Record<string, string>;
  }, [expenses]);

  const getCategoryColor = useCallback(
    (categoryName: string) => categoryColorMap[categoryName.trim()] ?? PIE_COLORS[0],
    [categoryColorMap],
  );

  const getCategoryTagStyle = useCallback(
    (categoryName: string) => {
      const color = getCategoryColor(categoryName);
      return {
        color,
        backgroundColor: `${color}22`,
      };
    },
    [getCategoryColor],
  );

  /* Pie data */
  const pieData = useMemo(() => {
    const m = new Map<string, number>();
    convertedFiltered.forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amount));
    const total = Array.from(m.values()).reduce((s, v) => s + v, 0);
    return Array.from(m.entries()).map(([cat, val]) => ({
      name: cat,
      value: val,
      pct: total ? ((val / total) * 100).toFixed(1) : "0",
      color: getCategoryColor(cat),
    }));
  }, [convertedFiltered, getCategoryColor]);

  /* Bar chart data — time-series like the line chart but for bar chart */
  const { barChartData, barCategoryData, barCategorySeries } = useMemo(() => {
    const now = new Date();
    const map = new Map<string, { total: number; categories: Record<string, number> }>();

    if (barRange !== "all") {
      for (let i = (barRange as number) - 1; i >= 0; i--) {
        map.set(format(subDays(now, i), "yyyy-MM-dd"), { total: 0, categories: {} });
      }
    }

    const start = barRange === "all"
      ? (expenses.length ? new Date(Math.min(...expenses.map(e => parseISO(e.created_at).getTime()))) : now)
      : subDays(now, (barRange as number) - 1);

    expenses.forEach((e) => {
      const d = parseISO(e.created_at);
      const k = format(d, "yyyy-MM-dd");
      const convertedAmount = convertFromBase(e.amount);

      if (barRange !== "all") {
        if (d >= start && map.has(k)) {
          const current = map.get(k)!;
          current.total += convertedAmount;
          current.categories[e.category] = (current.categories[e.category] ?? 0) + convertedAmount;
          map.set(k, current);
        }
      } else {
        const current = map.get(k) ?? { total: 0, categories: {} };
        current.total += convertedAmount;
        current.categories[e.category] = (current.categories[e.category] ?? 0) + convertedAmount;
        map.set(k, current);
      }
    });

    const sorted = Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, values]) => ({ date, total: values.total, categories: values.categories }));

    const catNames = Array.from(new Set(sorted.flatMap((entry) => Object.keys(entry.categories))));
    const catSeriesMeta = catNames.map((name, index) => ({
      key: `bcat_${index}`,
      name,
      color: getCategoryColor(name),
    }));

    const createRow = (entry: { date: string; total: number; categories: Record<string, number> }) => {
      const row: Record<string, number | string> = { date: entry.date, total: entry.total };
      catSeriesMeta.forEach((s) => { row[s.key] = entry.categories[s.name] ?? 0; });
      return row;
    };

    if (barType === "cumulative") {
      let acc = 0;
      const accByCat: Record<string, number> = {};
      catSeriesMeta.forEach((s) => { accByCat[s.key] = 0; });

      const cumRows: Record<string, number | string>[] = sorted.map((entry) => {
        acc += entry.total;
        const baseRow = createRow(entry);
        catSeriesMeta.forEach((s) => {
          accByCat[s.key] += Number(baseRow[s.key] ?? 0);
          baseRow[s.key] = accByCat[s.key];
        });
        return { ...baseRow, total: acc };
      });

      return {
        barChartData: cumRows.map((row) => ({ date: String(row["date"]), total: Number(row["total"]) })),
        barCategoryData: cumRows,
        barCategorySeries: catSeriesMeta,
      };
    }

    return {
      barChartData: sorted.map((entry) => ({ date: entry.date, total: entry.total })),
      barCategoryData: sorted.map((entry) => createRow(entry)),
      barCategorySeries: catSeriesMeta,
    };
  }, [expenses, barRange, barType, convertFromBase, getCategoryColor]);

  /* Line data */
  const { lineData, categoryLineData, categorySeries } = useMemo(() => {
    const now = new Date();
    const map = new Map<string, { total: number; categories: Record<string, number> }>();

    // Backfill empty days if range is bounded
    if (lineRange !== "all") {
      for (let i = lineRange - 1; i >= 0; i--) {
        map.set(format(subDays(now, i), "yyyy-MM-dd"), { total: 0, categories: {} });
      }
    }

    const start = lineRange === "all" ? 
      (expenses.length ? new Date(Math.min(...expenses.map(e => parseISO(e.created_at).getTime()))) : now) 
      : subDays(now, lineRange - 1);

    expenses.forEach((e) => {
      const d = parseISO(e.created_at);
      const k = format(d, "yyyy-MM-dd");
      const convertedAmount = convertFromBase(e.amount);

      if (lineRange !== "all") {
        if (d >= start && map.has(k)) {
          const current = map.get(k)!;
          current.total += convertedAmount;
          current.categories[e.category] = (current.categories[e.category] ?? 0) + convertedAmount;
          map.set(k, current);
        }
      } else {
        const current = map.get(k) ?? { total: 0, categories: {} };
        current.total += convertedAmount;
        current.categories[e.category] = (current.categories[e.category] ?? 0) + convertedAmount;
        map.set(k, current);
      }
    });

    const sorted = Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, values]) => ({ date, total: values.total, categories: values.categories }));

    const categoryNames = Array.from(
      new Set(sorted.flatMap((entry) => Object.keys(entry.categories))),
    );

    const categorySeriesMeta = categoryNames.map((name, index) => ({
      key: `cat_${index}`,
      name,
      color: PIE_COLORS[index % PIE_COLORS.length],
    }));

    const createCategoryRow = (entry: { date: string; total: number; categories: Record<string, number> }) => {
      const row: Record<string, number | string> = {
        date: entry.date,
        total: entry.total,
      };

      categorySeriesMeta.forEach((series) => {
        row[series.key] = entry.categories[series.name] ?? 0;
      });

      return row;
    };

    if (lineType === "cumulative") {
      let acc = 0;
      const accByCategory: Record<string, number> = {};
      categorySeriesMeta.forEach((series) => {
        accByCategory[series.key] = 0;
      });

      const cumulativeRows: Record<string, number | string>[] = sorted.map((entry) => {
        acc += entry.total;
        const baseRow = createCategoryRow(entry);

        categorySeriesMeta.forEach((series) => {
          accByCategory[series.key] += Number(baseRow[series.key] ?? 0);
          baseRow[series.key] = accByCategory[series.key];
        });

        return {
          ...baseRow,
          total: acc,
        };
      });

      return {
        lineData: cumulativeRows.map((row) => ({ date: String(row["date"]), total: Number(row["total"]) })),
        categoryLineData: cumulativeRows,
        categorySeries: categorySeriesMeta,
      };
    }

    return {
      lineData: sorted.map((entry) => ({ date: entry.date, total: entry.total })),
      categoryLineData: sorted.map((entry) => createCategoryRow(entry)),
      categorySeries: categorySeriesMeta,
    };
  }, [expenses, lineRange, lineType, convertFromBase]);

  const lineRanges: { key: number | "all"; label: string }[] = [
    { key: 7, label: "7D" },
    { key: 14, label: "14D" },
    { key: 28, label: "28D" },
    { key: 90, label: "90D" },
    { key: 365, label: "365D" },
    { key: "all", label: "All" },
  ];

  /* Heatmap data */
  const { heatmapWeeks, monthLabels } = useMemo(() => {
     const now = new Date();
     const year = now.getFullYear();
     const start = new Date(year, 0, 1);
     const end = new Date(year, 11, 31);
     
     const days = differenceInDays(end, start);
     const map = new Map<string, number>();
     
     expenses.forEach(e => {
        const d = parseISO(e.created_at);
        if (d >= start && d <= end) {
           const k = format(d, "yyyy-MM-dd");
          map.set(k, (map.get(k) ?? 0) + convertFromBase(e.amount));
        }
     });
     
     const startDoW = start.getDay(); 
     
     const flatGrid = [];
     for (let i = 0; i < startDoW; i++) {
        flatGrid.push({ date: `pad-start-${i}`, amount: -1, month: -1 }); 
     }
     for (let i = 0; i <= days; i++) {
        const d = addDays(start, i);
        const k = format(d, "yyyy-MM-dd");
        flatGrid.push({ date: k, amount: d > now ? -2 : (map.get(k) ?? 0), real: true, month: d.getMonth() });
     }
     const endDoW = end.getDay();
     for (let i = endDoW + 1; i <= 6; i++) {
        flatGrid.push({ date: `pad-end-${i}`, amount: -1, month: -1 });
     }

     const weeks = [];
     const labels = [];
     let currentMonth = -1;

     for (let i = 0; i < flatGrid.length; i += 7) {
        const week = flatGrid.slice(i, i + 7);
        weeks.push(week);
        
        // Find if this week starts a new month
        const firstRealDay = week.find(d => d.real);
        if (firstRealDay && firstRealDay.month !== currentMonth) {
           labels.push({ label: format(parseISO(firstRealDay.date), "MMM"), weekIndex: weeks.length - 1 });
           currentMonth = firstRealDay.month;
        }
     }

     return { heatmapWeeks: weeks, monthLabels: labels };
  }, [expenses, convertFromBase]);

  const getHeatmapColor = (amount: number) => {
    if (amount === -1) return "transparent"; // Padding
    if (amount === -2) return "var(--bg-body)"; // Future dates
    if (amount === 0) return "var(--bg-raised)"; // Empty
    if (amount < 200) return "rgba(124, 92, 252, 0.3)";
    if (amount < 800) return "rgba(124, 92, 252, 0.5)";
    if (amount < 2000) return "rgba(124, 92, 252, 0.7)";
    if (amount < 5000) return "rgba(124, 92, 252, 0.9)";
    return "rgba(124, 92, 252, 1)";
  };

  const barRanges: { key: number | "all"; label: string }[] = [
    { key: 7, label: "7D" },
    { key: 14, label: "14D" },
    { key: 28, label: "28D" },
    { key: 90, label: "90D" },
    { key: 365, label: "365D" },
    { key: "all", label: "All" },
  ];

  const empty = (msg: string) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: 14 }}>
      {msg}
    </div>
  );

  if (loading) {
    return (
      <div className="fade-in" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: "var(--text-muted)" }}>
        Loading expenses...
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: "14px", flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: ratesError ? "var(--red)" : "var(--text-muted)" }}>
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
                  <div className="currency-menu-empty">No currency match found.</div>
                )
              ) : (
                <>
                  <div className="currency-menu-section">Popular</div>
                  {defaultVisibleCurrencies.map((code) => {
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

                  <div className="currency-menu-section">All currencies</div>
                  {nonDefaultCurrencyCodes.map((code) => {
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

      {/* Stats Filter Row */}
      <div className="pie-filter-row" style={{ marginTop: 20, marginBottom: 8 }}>
        <div className="filter-pills">
          <button className={selectedStatsMonth === "month" ? "pill active" : "pill"} onClick={() => { setSelectedStatsMonth("month"); setSelectedPieMonth("month"); }}>This month</button>
          <button className={selectedStatsMonth === "year" ? "pill active" : "pill"} onClick={() => { setSelectedStatsMonth("year"); setSelectedPieMonth("year"); }}>This year</button>
          <button className={selectedStatsMonth === "all" ? "pill active" : "pill"} onClick={() => { setSelectedStatsMonth("all"); setSelectedPieMonth("all"); }}>All time</button>
        </div>
        {/* Custom month dropdown for stats */}
        {availableMonths.length > 0 && (
          <div className="month-dropdown" style={{ flex: 'none' }} ref={statsMonthDropdownRef}>
            <button
              type="button"
              className={`month-dropdown-trigger ${!["month", "year", "all"].includes(selectedStatsMonth) ? "has-value" : ""}`}
              onClick={() => setIsStatsMonthDropdownOpen((p) => !p)}
            >
              <span className="month-dropdown-text">
                {!["month", "year", "all"].includes(selectedStatsMonth)
                  ? availableMonths.find((m) => m.key === selectedStatsMonth)?.label ?? "Select month"
                  : "Select month"}
              </span>
              <span className="month-dropdown-arrow">{isStatsMonthDropdownOpen ? "▴" : "▾"}</span>
            </button>
            {isStatsMonthDropdownOpen && (
              <div className="month-dropdown-menu">
                {availableMonths.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    className={`month-dropdown-option ${selectedStatsMonth === m.key ? "active" : ""}`}
                    onClick={() => {
                      setSelectedStatsMonth(m.key);
                      setSelectedPieMonth(m.key);
                      setIsStatsMonthDropdownOpen(false);
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat">
          <div className="stat-label">Total spent</div>
          <div className="stat-val purple">{currencySymbol}{totalSpent.toFixed(2)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Expenses</div>
          <div className="stat-val green">{statsFiltered.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Categories</div>
          <div className="stat-val amber">{catCount}</div>
        </div>
      </div>

      {/* Top Row: Add Form (LEFT) + Pie Chart (RIGHT) */}
      <div className="charts-top-row">
        {/* Add expense form */}
        <div className="card add-expense-card">
          <div className="add-expense-header">
            <span className="add-expense-icon">＋</span>
            <div className="card-title">Add new expense</div>
          </div>
          <form onSubmit={handleAdd} className="add-expense-form">
            <div className="field">
              <label className="field-label">Name</label>
              <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dinner, Uber, Groceries..." />
            </div>
            <div className="field">
              <label className="field-label">Category</label>
              <input className="field-input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Food, Travel, Rent..." />
            </div>
            <div className="field">
              <label className="field-label">Amount ({activeCurrencyCode})</label>
              <input className="field-input" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <button type="submit" className="btn btn-primary add-expense-btn">Add Expense</button>
          </form>
        </div>

        {/* Pie Chart with 4-mode filter */}
        <div className="card charts-pie-card">
          <div className="card-head">
            <div>
              <div className="card-title">Spending by category</div>
              <div className="card-sub">Category-wise breakdown</div>
            </div>
          </div>
          {/* Pie filter: 4 modes */}
          <div className="pie-filter-row">
            <div className="filter-pills">
              <button className={selectedPieMonth === "month" ? "pill active" : "pill"} onClick={() => setSelectedPieMonth("month")}>This month</button>
              <button className={selectedPieMonth === "year" ? "pill active" : "pill"} onClick={() => setSelectedPieMonth("year")}>This year</button>
              <button className={selectedPieMonth === "all" ? "pill active" : "pill"} onClick={() => setSelectedPieMonth("all")}>All time</button>
            </div>
            {/* Custom month dropdown */}
            {availableMonths.length > 0 && (
              <div className="month-dropdown" ref={monthDropdownRef}>
                <button
                  type="button"
                  className={`month-dropdown-trigger ${!["month", "year", "all"].includes(selectedPieMonth) ? "has-value" : ""}`}
                  onClick={() => setIsMonthDropdownOpen((p) => !p)}
                >
                  <span className="month-dropdown-text">
                    {!["month", "year", "all"].includes(selectedPieMonth)
                      ? availableMonths.find((m) => m.key === selectedPieMonth)?.label ?? "Select month"
                      : "Select month"}
                  </span>
                  <span className="month-dropdown-arrow">{isMonthDropdownOpen ? "▴" : "▾"}</span>
                </button>
                {isMonthDropdownOpen && (
                  <div className="month-dropdown-menu">
                    {availableMonths.map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        className={`month-dropdown-option ${selectedPieMonth === m.key ? "active" : ""}`}
                        onClick={() => {
                          setSelectedPieMonth(m.key);
                          setIsMonthDropdownOpen(false);
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="chart-area pie-chart-area">
            {pieData.length === 0
              ? empty("No expenses for this period")
              : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie dataKey="value" data={pieData} nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2} strokeWidth={0}>
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)" }}
                      formatter={(value: any, _: any, props: any) => [`${currencySymbol}${Number(value).toFixed(2)} (${props.payload.pct}%)`, props.payload.name]}
                    />
                    <Legend
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                      wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
          </div>
        </div>
      </div>

      {/* Bar Chart — Full Width */}
      <div className="charts-bottom-row">
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-head time-card-head">
            <div>
              <div className="card-title">Spending bar chart</div>
              <div className="card-sub">
                {barView === "all" ? "Totals for selected range" : "Category breakdown for selected range"}
              </div>
            </div>
            <div className="time-controls">
              <div className="time-first-row">
                <div className="time-pills-row">
                  <div className="filter-pills">
                    <button className={barView === "all" ? "pill active" : "pill"} onClick={() => setBarView("all")}>All</button>
                    <button className={barView === "category" ? "pill active" : "pill"} onClick={() => setBarView("category")}>Category</button>
                  </div>
                </div>
                <div className="time-pills-row">
                  <div className="filter-pills">
                    <button className={barType === "daily" ? "pill active" : "pill"} onClick={() => setBarType("daily")}>Daily</button>
                    <button className={barType === "cumulative" ? "pill active" : "pill"} onClick={() => setBarType("cumulative")}>Cumulative</button>
                  </div>
                </div>
              </div>
              <div className="time-pills-row">
                <div className="filter-pills">
                  {barRanges.map((r) => (
                    <button key={r.key} className={barRange === r.key ? "pill active" : "pill"} onClick={() => setBarRange(r.key)}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="chart-area" style={{ height: 320 }}>
            {barChartData.length === 0
              ? empty("Add expenses to see the chart")
              : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barView === "all" ? barChartData : barCategoryData}
                    margin={{ left: 10, right: 10, top: 5, bottom: 5 }}
                    barGap={0}
                    barCategoryGap={0}
                  >
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                      axisLine={{ stroke: "var(--border)" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                      axisLine={{ stroke: "var(--border)" }}
                      tickLine={false}
                      tickFormatter={(value: number) => `${currencySymbol}${Math.round(value)}`}
                    />
                    <Tooltip
                      contentStyle={{ background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)" }}
                      formatter={(value: any, name: any) => [`${currencySymbol}${Number(value).toFixed(2)}`, String(name)]}
                      cursor={{ fill: "rgba(124, 92, 252, 0.08)" }}
                    />
                    <Legend />

                    {barView === "all" ? (
                      <Bar dataKey="total" name="Total" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    ) : (
                      barCategorySeries.map((series) => (
                        <Bar
                          key={series.key}
                          dataKey={series.key}
                          name={series.name}
                          fill={series.color}
                          radius={[2, 2, 0, 0]}
                        />
                      ))
                    )}
                  </BarChart>
                </ResponsiveContainer>
              )}
          </div>
        </div>
      </div>

      {/* Line Chart — Full Width */}
      <div className="charts-bottom-row">
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-head time-card-head">
            <div>
              <div className="card-title">Spending over time</div>
              <div className="card-sub">
                {lineView === "all" ? "Totals for selected range" : "Category trends for selected range"}
              </div>
            </div>
            <div className="time-controls">
              <div className="time-first-row">
                <div className="time-pills-row">
                  <div className="filter-pills">
                    <button className={lineView === "all" ? "pill active" : "pill"} onClick={() => setLineView("all")}>All</button>
                    <button className={lineView === "category" ? "pill active" : "pill"} onClick={() => setLineView("category")}>Category</button>
                  </div>
                </div>

                <div className="time-pills-row">
                  <div className="filter-pills">
                    <button className={lineType === "daily" ? "pill active" : "pill"} onClick={() => setLineType("daily")}>Daily</button>
                    <button className={lineType === "cumulative" ? "pill active" : "pill"} onClick={() => setLineType("cumulative")}>Cumulative</button>
                  </div>
                </div>
              </div>

              <div className="time-pills-row">
                <div className="filter-pills">
                  {lineRanges.map((r) => (
                    <button key={r.key} className={lineRange === r.key ? "pill active" : "pill"} onClick={() => setLineRange(r.key)}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="chart-area" style={{ height: 320 }}>
            {lineData.length === 0
              ? empty("Add expenses to see trends")
              : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineView === "all" ? lineData : categoryLineData}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                    <YAxis tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} tickFormatter={(value: number) => `${currencySymbol}${Math.round(value)}`} />
                    <Tooltip
                      contentStyle={{ background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)" }}
                      formatter={(value: any, name: any) => [`${currencySymbol}${Number(value).toFixed(2)}`, String(name)]}
                    />
                    <Legend />

                    {lineView === "all" ? (
                      <Line
                        type="monotone"
                        dataKey="total"
                        name="Total"
                        stroke="#3B82F6"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "#3B82F6", stroke: "var(--bg-surface)", strokeWidth: 2 }}
                        activeDot={{ r: 5, fill: "#60A5FA" }}
                      />
                    ) : (
                      categorySeries.map((series) => (
                        <Line
                          key={series.key}
                          type="monotone"
                          dataKey={series.key}
                          name={series.name}
                          stroke={series.color}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      ))
                    )}
                  </LineChart>
                </ResponsiveContainer>
              )}
          </div>
        </div>
      </div>

      {/* Activity Heatmap */}
      <div className="card" style={{ marginBottom: 20, position: "relative" }}>
        <div className="card-title" style={{ marginBottom: 4 }}>Daily Expense Activity</div>
        <div className="card-sub" style={{ marginBottom: 16 }}>Your spending footprint for the current year</div>
        
        <div style={{ display: "flex", overflowX: "auto", paddingBottom: "16px", paddingTop: "8px" }}>
          <div style={{ display: "flex", flexDirection: "column", width: "100%", minWidth: "750px" }}>
            {/* Month Labels */}
            <div style={{ display: "flex", position: "relative", height: "20px", marginBottom: "4px", width: "100%" }}>
               {monthLabels.map((m, i) => (
                 <div key={i} style={{ position: "absolute", left: `${(m.weekIndex / heatmapWeeks.length) * 100}%`, fontSize: "11px", color: "var(--text-muted)" }}>
                   {m.label}
                 </div>
               ))}
            </div>
            
            {/* Days Grid */}
            <div style={{ display: "flex", width: "100%" }}>
              {heatmapWeeks.map((week, wIdx) => (
                <div key={wIdx} style={{ display: "flex", flexDirection: "column", flex: 1, padding: "0 1.5px" }}>
                  {week.map((d, dIdx) => (
                    <div 
                      key={`${d.date}-${dIdx}`} 
                      onMouseEnter={(e) => {
                         if (d.amount >= 0) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltipData({ 
                               x: rect.left + window.scrollX + (rect.width / 2), 
                               y: rect.top + window.scrollY - 30, 
                               text: `${currencySymbol}${d.amount.toFixed(2)} spent on ${format(parseISO(d.date), "MMM d, yyyy")}` 
                            });
                         }
                      }}
                      onMouseLeave={() => setTooltipData(null)}
                      style={{ 
                        width: "100%", 
                        aspectRatio: "1", 
                        borderRadius: 2, 
                        background: getHeatmapColor(d.amount),
                        cursor: d.amount >= 0 ? "pointer" : "default",
                        marginBottom: dIdx < 6 ? "3px" : "0"
                      }} 
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {tooltipData && (
           <div style={{
              position: "absolute",
              left: tooltipData.x,
              top: tooltipData.y,
              transform: "translateX(-50%)",
              background: "var(--bg-raised)",
              color: "var(--text)",
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "12px",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow)",
              zIndex: 100
           }}>
              {tooltipData.text}
           </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
          <span>Less</span>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: "var(--bg-raised)" }}></div>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(124, 92, 252, 0.3)" }}></div>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(124, 92, 252, 0.5)" }}></div>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(124, 92, 252, 0.7)" }}></div>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(124, 92, 252, 0.9)" }}></div>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(124, 92, 252, 1)" }}></div>
          <span>More</span>
        </div>
      </div>



      <div className="expenses-overview-grid">
        {/* Top Expenses */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-head" style={{ marginBottom: 10 }}>
            <div>
              <div className="card-title">Top expenses</div>
              <div className="card-sub">Top 5 highest expenses by amount</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setIsTopExpensesOpen(true)} disabled={expenses.length === 0}>
              View all
            </button>
          </div>

          <ul className="top-expenses-list">
            {topExpenses.length === 0 ? (
              <li className="top-expense-empty">No expenses yet. Add your first one above.</li>
            ) : (
              topExpenses.map((exp, index) => (
                <li key={exp.id} className="top-expense-ranked-row">
                  <span className="top-expense-bg-rank">{index + 1}</span>
                  <div className="top-expense-item top-expense-item-ranked">
                    <div className="top-expense-left">
                      <div>
                        <div className="top-expense-name">{exp.name}</div>
                        <div className="top-expense-meta">
                          <span className="cat-tag" style={getCategoryTagStyle(exp.category)}>{exp.category}</span>
                          <span>{format(parseISO(exp.created_at), "dd MMM yyyy, HH:mm")}</span>
                        </div>
                      </div>
                    </div>
                    <div className="top-expense-amount">{currencySymbol}{convertFromBase(exp.amount).toFixed(2)}</div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Recently Added */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-head" style={{ marginBottom: 10 }}>
            <div>
              <div className="card-title">Recently added</div>
              <div className="card-sub">Latest 5 expenses</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setIsRecentExpensesOpen(true)} disabled={expenses.length === 0}>
              View all
            </button>
          </div>

          <ul className="top-expenses-list">
            {recentExpenses.length === 0 ? (
              <li className="top-expense-empty">No expenses yet. Add your first one above.</li>
            ) : (
              recentExpenses.map((exp, index) => (
                <li key={exp.id} className="top-expense-ranked-row">
                  <span className="top-expense-bg-rank">{index + 1}</span>
                  <div className="top-expense-item top-expense-item-ranked">
                    <div className="top-expense-left">
                      <div>
                        <div className="top-expense-name">{exp.name}</div>
                        <div className="top-expense-meta">
                          <span className="cat-tag" style={getCategoryTagStyle(exp.category)}>{exp.category}</span>
                          <span>{format(parseISO(exp.created_at), "dd MMM yyyy, HH:mm")}</span>
                        </div>
                      </div>
                    </div>
                    <div className="top-expense-amount">{currencySymbol}{convertFromBase(exp.amount).toFixed(2)}</div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {isTopExpensesOpen && (
        <div className="modal-backdrop" onClick={() => setIsTopExpensesOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="card-head" style={{ marginBottom: 10 }}>
              <div>
                <div className="card-title">Top expenses</div>
                <div className="card-sub">All expenses sorted by amount</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsTopExpensesOpen(false)}>Close</button>
            </div>

            <div className="table-wrap modal-table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Spend bar</th>
                    <th style={{ width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {allExpensesByAmount.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="td-empty">No expenses yet. Add your first one above.</td>
                    </tr>
                  ) : (
                    allExpensesByAmount.map((exp) => (
                      <tr key={exp.id}>
                        <td className="td-date">{format(parseISO(exp.created_at), "dd MMM yyyy, HH:mm")}</td>
                        <td>{exp.name}</td>
                        <td><span className="cat-tag" style={getCategoryTagStyle(exp.category)}>{exp.category}</span></td>
                        <td className="td-amount">{currencySymbol}{convertFromBase(exp.amount).toFixed(2)}</td>
                        <td>
                          <div className="expense-progress-track">
                            <div
                              className="expense-progress-fill"
                              style={{
                                width:
                                  maxAmountAcrossAllExpenses > 0
                                    ? `${Math.max((exp.amount / maxAmountAcrossAllExpenses) * 100, 4)}%`
                                    : "0%",
                              }}
                            />
                          </div>
                        </td>
                        <td>
                          <button className="btn-danger" onClick={() => handleDelete(exp.id)} title="Delete">✕</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isRecentExpensesOpen && (
        <div className="modal-backdrop" onClick={() => setIsRecentExpensesOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="card-head" style={{ marginBottom: 10 }}>
              <div>
                <div className="card-title">Recently added expenses</div>
                <div className="card-sub">All expenses sorted by latest added</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsRecentExpensesOpen(false)}>Close</button>
            </div>

            <div className="table-wrap modal-table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Spend bar</th>
                    <th style={{ width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {allExpensesByRecent.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="td-empty">No expenses yet. Add your first one above.</td>
                    </tr>
                  ) : (
                    allExpensesByRecent.map((exp) => (
                      <tr key={exp.id}>
                        <td className="td-date">{format(parseISO(exp.created_at), "dd MMM yyyy, HH:mm")}</td>
                        <td>{exp.name}</td>
                        <td><span className="cat-tag" style={getCategoryTagStyle(exp.category)}>{exp.category}</span></td>
                        <td className="td-amount">{currencySymbol}{convertFromBase(exp.amount).toFixed(2)}</td>
                        <td>
                          <div className="expense-progress-track">
                            <div
                              className="expense-progress-fill"
                              style={{
                                width:
                                  maxAmountInRecentExpenses > 0
                                    ? `${Math.max((exp.amount / maxAmountInRecentExpenses) * 100, 4)}%`
                                    : "0%",
                              }}
                            />
                          </div>
                        </td>
                        <td>
                          <button className="btn-danger" onClick={() => handleDelete(exp.id)} title="Delete">✕</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
