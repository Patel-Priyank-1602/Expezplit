import { useState, useEffect } from "react";
import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/react";
import { HomePage } from "./HomePage";
import { ExpenseTracker } from "./ExpenseTracker";
import { Analytics } from "./Analytics";
import { Splitwise } from "./Splitwise";
import { Notifications } from "./Notifications";
import { supabase } from "./lib/supabase";

type TabKey = "expense" | "analytics" | "splitwise";
type Theme = "dark" | "light";

type ExpenseCsvRow = {
  id: string;
  name: string;
  category: string;
  amount: number;
  currency: string | null;
  created_at: string;
};

type GroupCsvRow = {
  id: string;
  name: string;
  currency: string | null;
};

type GroupMemberCsvRow = {
  id: string;
  group_id: string;
  name: string;
};

type GroupExpenseCsvRow = {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  split_type: "equal" | "custom";
  paid_by_id: string;
  created_at: string;
};

type GroupExpenseSplitCsvRow = {
  expense_id: string;
  member_id: string;
  amount: number;
};

const csvEscape = (value: unknown) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  const escaped = text.replace(/"/g, '""');
  if (/[,\n\r"]/.test(escaped)) return `"${escaped}"`;
  return escaped;
};

const rowsToCsv = (headers: string[], rows: Record<string, unknown>[]) => {
  const headerLine = headers.join(",");
  const dataLines = rows.map((row) => headers.map((key) => csvEscape(row[key])).join(","));
  return [headerLine, ...dataLines].join("\n");
};

const triggerCsvDownload = (filename: string, csvContent: string) => {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const getDateStamp = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

const isMissingCurrencyColumnError = (message: string | undefined) =>
  /column\s+.*currency.*does not exist/i.test(message ?? "");

function App() {
  const [tab, setTab] = useState<TabKey>(() => {
    // Auto-switch to Splitwise tab if joining via QR code scan (Google Lens etc.)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.has("join")) return "splitwise";
    }
    return "expense";
  });
  const { isLoaded, isSignedIn, user } = useUser();
  const [isExporting, setIsExporting] = useState(false);
  const [activeNav, setActiveNav] = useState("features");
  const [isBubbleOpen, setIsBubbleOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as Theme) || "dark";
    }
    return "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Scroll listener for morphing navbar & ScrollSpy navigation
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsScrolled(scrollY > 25);

      if (!isSignedIn) {
        const sectionIds = ["demo", "features", "calculator", "workflow", "matrix", "testimonials", "pricing", "faq"];
        const scrollPosition = scrollY + 120;
        
        for (let i = sectionIds.length - 1; i >= 0; i--) {
          const section = document.getElementById(sectionIds[i]);
          if (section) {
            const top = section.offsetTop;
            if (scrollPosition >= top) {
              setActiveNav(sectionIds[i]);
              break;
            }
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isSignedIn]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setActiveNav(id);
    setIsBubbleOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const navbarHeight = 84;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - navbarHeight;
      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: "smooth"
      });
    }
  };

  const themeToggleButton = (
    <button
      type="button"
      className="theme-toggle-btn"
      onClick={toggleTheme}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? (
        <svg
          className="theme-btn-icon theme-btn-icon--sun"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg
          className="theme-btn-icon theme-btn-icon--moon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );

  const downloadCsvIcon = isExporting ? (
    <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );

  const downloadExpensesCsv = async (userId: string, stamp: string) => {
    const { data, error } = await supabase
      .from("expenses")
      .select("id,name,category,amount,currency,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    let expensesData = data as ExpenseCsvRow[] | null;

    if (error) {
      if (!isMissingCurrencyColumnError(error.message)) {
        throw new Error(`Failed to export expenses: ${error.message}`);
      }

      const retry = await supabase
        .from("expenses")
        .select("id,name,category,amount,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (retry.error) {
        throw new Error(`Failed to export expenses: ${retry.error.message}`);
      }

      expensesData = (retry.data ?? []) as ExpenseCsvRow[];
    }

    const rows = ((expensesData ?? []) as ExpenseCsvRow[]).map((expense) => ({
      date: expense.created_at,
      name: expense.name,
      category: expense.category,
      amount: Number(expense.amount).toFixed(2),
      currency: expense.currency ?? "INR",
    }));

    const csv = rowsToCsv(["date", "name", "category", "amount", "currency"], rows);
    triggerCsvDownload(`expenses_${stamp}.csv`, csv);
  };

  const downloadSplitwiseCsv = async (userId: string, stamp: string) => {
    // 1. Fetch groups owned by this user
    const { data: ownedGroupsData, error: ownedGroupsError } = await supabase
      .from("groups")
      .select("id,name,currency")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    let resolvedOwnedGroups = ownedGroupsData as GroupCsvRow[] | null;
    if (ownedGroupsError) {
      if (!isMissingCurrencyColumnError(ownedGroupsError.message)) {
        throw new Error(`Failed to export splitwise groups: ${ownedGroupsError.message}`);
      }

      const retry = await supabase
        .from("groups")
        .select("id,name")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (retry.error) {
        throw new Error(`Failed to export splitwise groups: ${retry.error.message}`);
      }

      resolvedOwnedGroups = (retry.data ?? []) as GroupCsvRow[];
    }

    const ownedGroups = (resolvedOwnedGroups ?? []) as GroupCsvRow[];

    // 2. Fetch groups the user has joined via invite code (by email match in group_members)
    let joinedGroups: GroupCsvRow[] = [];
    const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";
    if (userEmail) {
      const { data: membershipRows } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("email", userEmail);

      const ownedIds = new Set(ownedGroups.map((g) => g.id));
      const joinedIds = (membershipRows ?? [])
        .map((m: { group_id: string }) => m.group_id)
        .filter((id: string) => !ownedIds.has(id));

      if (joinedIds.length > 0) {
        const { data: jData, error: jError } = await supabase
          .from("groups")
          .select("id,name,currency")
          .in("id", joinedIds)
          .order("created_at", { ascending: true });

        let resolvedJoined = jData as GroupCsvRow[] | null;
        if (jError) {
          if (!isMissingCurrencyColumnError(jError.message)) {
            throw new Error(`Failed to export joined splitwise groups: ${jError.message}`);
          }

          const retryJ = await supabase
            .from("groups")
            .select("id,name")
            .in("id", joinedIds)
            .order("created_at", { ascending: true });

          if (retryJ.error) {
            throw new Error(`Failed to export joined splitwise groups: ${retryJ.error.message}`);
          }

          resolvedJoined = (retryJ.data ?? []) as GroupCsvRow[];
        }

        joinedGroups = (resolvedJoined ?? []) as GroupCsvRow[];
      }
    }

    // 3. Merge owned + joined groups
    const groups = [...ownedGroups, ...joinedGroups];
    if (groups.length === 0) {
      const emptyCsv = rowsToCsv(
        [
          "group",
          "type",
          "description",
          "total_amount",
          "paid_by",
          "split_with",
          "split_amount",
          "split_type",
          "currency",
          "date",
        ],
        [],
      );
      triggerCsvDownload(`splitwise_transactions_${stamp}.csv`, emptyCsv);
      return;
    }

    const groupIds = groups.map((group) => group.id);

    const [{ data: membersData, error: membersError }, { data: expensesData, error: expensesError }] = await Promise.all([
      supabase.from("group_members").select("id,group_id,name").in("group_id", groupIds),
      supabase
        .from("group_expenses")
        .select("id,group_id,description,amount,split_type,paid_by_id,created_at")
        .in("group_id", groupIds)
        .order("created_at", { ascending: false }),
    ]);

    if (membersError) throw new Error(`Failed to export splitwise members: ${membersError.message}`);
    if (expensesError) throw new Error(`Failed to export splitwise expenses: ${expensesError.message}`);

    const members = (membersData ?? []) as GroupMemberCsvRow[];
    const expenses = (expensesData ?? []) as GroupExpenseCsvRow[];

    const expenseIds = expenses.map((expense) => expense.id);
    let splits: GroupExpenseSplitCsvRow[] = [];

    if (expenseIds.length > 0) {
      const { data: splitData, error: splitError } = await supabase
        .from("group_expense_splits")
        .select("expense_id,member_id,amount")
        .in("expense_id", expenseIds);

      if (splitError) throw new Error(`Failed to export splitwise splits: ${splitError.message}`);
      splits = (splitData ?? []) as GroupExpenseSplitCsvRow[];
    }

    const groupById = new Map(groups.map((group) => [group.id, group]));
    const memberById = new Map(members.map((member) => [member.id, member]));
    const splitsByExpenseId = new Map<string, GroupExpenseSplitCsvRow[]>();

    splits.forEach((split) => {
      const list = splitsByExpenseId.get(split.expense_id) ?? [];
      list.push(split);
      splitsByExpenseId.set(split.expense_id, list);
    });

    const rows: Record<string, unknown>[] = [];

    expenses.forEach((expense) => {
      const group = groupById.get(expense.group_id);
      const paidBy = memberById.get(expense.paid_by_id);
      const expenseSplits = splitsByExpenseId.get(expense.id) ?? [];

      const currency = group?.currency ?? "INR";
      const type = expense.description === "Payment" ? "settlement" : "expense";

      if (expenseSplits.length === 0) {
        rows.push({
          group: group?.name ?? "",
          type,
          description: expense.description,
          total_amount: Number(expense.amount).toFixed(2),
          paid_by: paidBy?.name ?? "",
          split_with: "",
          split_amount: "",
          split_type: expense.split_type,
          currency,
          date: expense.created_at,
        });
        return;
      }

      expenseSplits.forEach((split) => {
        const splitMember = memberById.get(split.member_id);
        rows.push({
          group: group?.name ?? "",
          type,
          description: expense.description,
          total_amount: Number(expense.amount).toFixed(2),
          paid_by: paidBy?.name ?? "",
          split_with: splitMember?.name ?? "",
          split_amount: Number(split.amount).toFixed(2),
          split_type: expense.split_type,
          currency,
          date: expense.created_at,
        });
      });
    });

    const csv = rowsToCsv(
      [
        "group",
        "type",
        "description",
        "total_amount",
        "paid_by",
        "split_with",
        "split_amount",
        "split_type",
        "currency",
        "date",
      ],
      rows,
    );

    triggerCsvDownload(`splitwise_transactions_${stamp}.csv`, csv);
  };

  const handleDownloadAllCsv = async () => {
    const userId = user?.id;
    if (!userId || isExporting) return;

    setIsExporting(true);
    try {
      const stamp = getDateStamp();
      await Promise.all([downloadExpensesCsv(userId, stamp), downloadSplitwiseCsv(userId, stamp)]);
    } catch (error) {
      console.error(error);
      window.alert("Unable to download CSV files right now. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="app-shell">
      {/* Signed-In: Smooth Morphing Dashboard Navbar | Signed-Out: Landing Page Morphing Floating Header */}
      {isSignedIn ? (
        <header className={`navbar dashboard-navbar ${isScrolled ? "is-scrolled" : ""}`}>
          <div className="navbar-brand">
            <div className="logo-mark">
              <img src="/logo.png" alt="Expezplit logo" className="logo-mark-img" />
            </div>
            <div className="logo-text">
              Expe<span className="logo-accent">Z</span>plit
            </div>
          </div>

          {/* Desktop-Only Center Navigation Tabs (Expenses / Analytics / Splitwise) */}
          <nav className="dashboard-navbar-nav" aria-label="Dashboard Navigation">
            <div className="dashboard-nav-pills">
              <button
                type="button"
                className={`nav-pill-btn ${tab === "expense" ? "active" : ""}`}
                onClick={() => setTab("expense")}
                aria-current={tab === "expense" ? "page" : undefined}
              >
                <svg className="nav-pill-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
                <span className="nav-pill-text">Expenses</span>
              </button>

              <button
                type="button"
                className={`nav-pill-btn ${tab === "analytics" ? "active" : ""}`}
                onClick={() => setTab("analytics")}
                aria-current={tab === "analytics" ? "page" : undefined}
              >
                <svg className="nav-pill-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18" />
                  <path d="m19 9-5 5-4-4-3 3" />
                </svg>
                <span className="nav-pill-text">Analytics</span>
              </button>

              <button
                type="button"
                className={`nav-pill-btn ${tab === "splitwise" ? "active" : ""}`}
                onClick={() => setTab("splitwise")}
                aria-current={tab === "splitwise" ? "page" : undefined}
              >
                <svg className="nav-pill-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span className="nav-pill-text">Splitwise</span>
              </button>
            </div>
          </nav>

          <div className="navbar-actions">
            <button
              type="button"
              className="navbar-tool-btn download-csv-btn"
              onClick={handleDownloadAllCsv}
              disabled={isExporting}
              title="Download CSV exports"
            >
              {downloadCsvIcon}
              <span className="navbar-tool-label">{isExporting ? "Preparing..." : "CSV"}</span>
            </button>
            {themeToggleButton}
            <Notifications />
            <UserButton
              appearance={{
                elements: { avatarBox: { width: 40, height: 40 } },
              }}
            />
          </div>
        </header>
      ) : (
        <header className={`navbar-wrapper ${isScrolled ? "is-scrolled" : ""}`}>
          <div className={`navbar-island ${isScrolled ? "is-scrolled" : ""}`}>
            <a href="#" className="navbar-brand" onClick={(e) => scrollToSection(e, "hero")}>
              <div className="logo-mark">
                <img src="/logo.png" alt="Expezplit logo" className="logo-mark-img" />
              </div>
              <div className="logo-text">
                Expe<span className="logo-accent">Z</span>plit
              </div>
            </a>

            <div className="navbar-actions">
              {themeToggleButton}

              <SignInButton mode="modal">
                <button className="btn-login-pill">Login</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="btn-gradient-glow-cta">
                  <span className="btn-cta-inner">
                    <span>Get Started</span>
                    <svg className="cta-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </span>
                </button>
              </SignUpButton>
            </div>
          </div>
        </header>
      )}

      {/* Main */}
      <main style={{ flex: 1 }}>
        {!isLoaded && (
          <div className="skeleton-app-loading">
            {/* Skeleton tab bar */}
            <div className="skeleton-tab-bar">
              <div className="skeleton skeleton-tab-btn" />
              <div className="skeleton skeleton-tab-btn" />
              <div className="skeleton skeleton-tab-btn" />
            </div>

            {/* Skeleton stats row */}
            <div className="skeleton-stats-row">
              {[1, 2, 3].map((i) => (
                <div className="skeleton-stat" key={i}>
                  <div className="skeleton skeleton-line sm" style={{ width: "60%" }} />
                  <div className="skeleton skeleton-line xl" style={{ width: "80%" }} />
                </div>
              ))}
            </div>

            {/* Skeleton chart cards */}
            <div className="skeleton-charts-row">
              <div className="skeleton-chart-card">
                <div className="skeleton skeleton-line lg" style={{ width: "50%" }} />
                <div className="skeleton skeleton-line sm" style={{ width: "35%" }} />
                <div className="skeleton-chart-area">
                  {[65, 40, 80, 55, 70, 45, 60].map((h, i) => (
                    <div key={i} className="skeleton skeleton-bar" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
              <div className="skeleton-chart-card">
                <div className="skeleton skeleton-line lg" style={{ width: "55%" }} />
                <div className="skeleton skeleton-line sm" style={{ width: "40%" }} />
                <div className="skeleton-chart-area">
                  {[45, 70, 50, 85, 60, 75, 90].map((h, i) => (
                    <div key={i} className="skeleton skeleton-bar" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>

            {/* Skeleton recent transactions table */}
            <div className="skeleton-table-card">
              <div className="skeleton skeleton-line lg" style={{ width: "30%", marginBottom: 16 }} />
              {[1, 2, 3, 4].map((i) => (
                <div className="skeleton-row" key={i}>
                  <div className="skeleton skeleton-avatar" />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton skeleton-line md" style={{ width: "40%" }} />
                    <div className="skeleton skeleton-line sm" style={{ width: "25%" }} />
                  </div>
                  <div className="skeleton skeleton-line md" style={{ width: "15%" }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoaded && !isSignedIn && <HomePage />}

        {isLoaded && isSignedIn && (
          <div className="dashboard-wrap">
            <div className="dashboard">
              {tab === "expense" && <ExpenseTracker />}
              {tab === "analytics" && <Analytics />}
              {tab === "splitwise" && <Splitwise />}
            </div>
          </div>
        )}
      </main>

      {/* ── Fixed Bottom-Right Floating Action Navigation Menu (FAB) for Landing Page ── */}
      {isLoaded && !isSignedIn && (
        <div className="fab-nav-wrapper">
          {isBubbleOpen && (
            <>
              {/* Dimmed backdrop to close on outside click */}
              <div className="fab-backdrop" onClick={() => setIsBubbleOpen(false)} />

              {/* Vertical Stack Menu Items (Aligned Bottom-Right) */}
              <div className="fab-menu-stack">
                <a
                  href="#faq"
                  className={`fab-pill-item ${activeNav === "faq" ? "active" : ""}`}
                  style={{ animationDelay: "280ms" }}
                  onClick={(e) => {
                    scrollToSection(e, "faq");
                    setIsBubbleOpen(false);
                  }}
                >
                  <span className="fab-pill-label">FAQ</span>
                </a>

                <a
                  href="#pricing"
                  className={`fab-pill-item ${activeNav === "pricing" ? "active" : ""}`}
                  style={{ animationDelay: "240ms" }}
                  onClick={(e) => {
                    scrollToSection(e, "pricing");
                    setIsBubbleOpen(false);
                  }}
                >
                  <span className="fab-pill-label">Pricing</span>
                </a>

                <a
                  href="#testimonials"
                  className={`fab-pill-item ${activeNav === "testimonials" ? "active" : ""}`}
                  style={{ animationDelay: "200ms" }}
                  onClick={(e) => {
                    scrollToSection(e, "testimonials");
                    setIsBubbleOpen(false);
                  }}
                >
                  <span className="fab-pill-label">User Reviews</span>
                </a>

                <a
                  href="#matrix"
                  className={`fab-pill-item ${activeNav === "matrix" ? "active" : ""}`}
                  style={{ animationDelay: "160ms" }}
                  onClick={(e) => {
                    scrollToSection(e, "matrix");
                    setIsBubbleOpen(false);
                  }}
                >
                  <span className="fab-pill-label">System Matrix</span>
                </a>

                <a
                  href="#workflow"
                  className={`fab-pill-item ${activeNav === "workflow" ? "active" : ""}`}
                  style={{ animationDelay: "120ms" }}
                  onClick={(e) => {
                    scrollToSection(e, "workflow");
                    setIsBubbleOpen(false);
                  }}
                >
                  <span className="fab-pill-label">Workflow</span>
                </a>

                <a
                  href="#calculator"
                  className={`fab-pill-item ${activeNav === "calculator" ? "active" : ""}`}
                  style={{ animationDelay: "80ms" }}
                  onClick={(e) => {
                    scrollToSection(e, "calculator");
                    setIsBubbleOpen(false);
                  }}
                >
                  <span className="fab-pill-label">Live Split Calc</span>
                </a>

                <a
                  href="#demo"
                  className={`fab-pill-item ${activeNav === "demo" ? "active" : ""}`}
                  style={{ animationDelay: "40ms" }}
                  onClick={(e) => {
                    scrollToSection(e, "demo");
                    setIsBubbleOpen(false);
                  }}
                >
                  <span className="fab-pill-label">Simulator</span>
                </a>

                <a
                  href="#features"
                  className={`fab-pill-item ${activeNav === "features" ? "active" : ""}`}
                  style={{ animationDelay: "0ms" }}
                  onClick={(e) => {
                    scrollToSection(e, "features");
                    setIsBubbleOpen(false);
                  }}
                >
                  <span className="fab-pill-label">Features</span>
                </a>
              </div>
            </>
          )}

          {/* Bottom-Right Floating Trigger Button */}
          <button
            className={`fab-trigger-btn ${isBubbleOpen ? "open" : ""}`}
            onClick={() => setIsBubbleOpen(!isBubbleOpen)}
            title="Navigation Menu"
            aria-label="Toggle navigation menu"
          >
            {isBubbleOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* ── Fixed Bottom-Right Floating Action Navigation Menu (FAB) for Dashboard (Mobile Responsive Only) ── */}
      {isLoaded && isSignedIn && (
        <div className="fab-nav-wrapper fab-nav-wrapper--dashboard">
          {isBubbleOpen && (
            <>
              {/* Dimmed backdrop to close on outside click */}
              <div className="fab-backdrop" onClick={() => setIsBubbleOpen(false)} />

              {/* Vertical Stack Menu Items for Dashboard Tabs */}
              <div className="fab-menu-stack">
                <button
                  type="button"
                  className={`fab-pill-item ${tab === "splitwise" ? "active" : ""}`}
                  style={{ animationDelay: "80ms" }}
                  onClick={() => {
                    setTab("splitwise");
                    setIsBubbleOpen(false);
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span className="fab-pill-label">Splitwise</span>
                </button>

                <button
                  type="button"
                  className={`fab-pill-item ${tab === "analytics" ? "active" : ""}`}
                  style={{ animationDelay: "40ms" }}
                  onClick={() => {
                    setTab("analytics");
                    setIsBubbleOpen(false);
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3v18h18" />
                    <path d="m19 9-5 5-4-4-3 3" />
                  </svg>
                  <span className="fab-pill-label">Analytics</span>
                </button>

                <button
                  type="button"
                  className={`fab-pill-item ${tab === "expense" ? "active" : ""}`}
                  style={{ animationDelay: "0ms" }}
                  onClick={() => {
                    setTab("expense");
                    setIsBubbleOpen(false);
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                  <span className="fab-pill-label">Expenses</span>
                </button>
              </div>
            </>
          )}

          {/* Bottom-Right Floating Trigger Button */}
          <button
            className={`fab-trigger-btn ${isBubbleOpen ? "open" : ""}`}
            onClick={() => setIsBubbleOpen(!isBubbleOpen)}
            title="Navigation Menu"
            aria-label="Toggle tab navigation menu"
          >
            {isBubbleOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            )}
          </button>
        </div>
      )}

    </div>
  );
}

export default App;
