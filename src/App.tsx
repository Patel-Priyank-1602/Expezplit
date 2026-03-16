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
import { Splitwise } from "./Splitwise";
import { Notifications } from "./Notifications";
import { supabase } from "./lib/supabase";

type TabKey = "expense" | "splitwise";
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
  const [tab, setTab] = useState<TabKey>("expense");
  const { isLoaded, isSignedIn, user } = useUser();
  const [isExporting, setIsExporting] = useState(false);

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

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const themeToggleButton = (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
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
      id: expense.id,
      name: expense.name,
      category: expense.category,
      amount: Number(expense.amount).toFixed(2),
      currency: expense.currency ?? "INR",
      created_at: expense.created_at,
    }));

    const csv = rowsToCsv(["id", "name", "category", "amount", "currency", "created_at"], rows);
    triggerCsvDownload(`expenses_${stamp}.csv`, csv);
  };

  const downloadSplitwiseCsv = async (userId: string, stamp: string) => {
    const { data: groupsData, error: groupsError } = await supabase
      .from("groups")
      .select("id,name,currency")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    let resolvedGroupsData = groupsData as GroupCsvRow[] | null;
    if (groupsError) {
      if (!isMissingCurrencyColumnError(groupsError.message)) {
        throw new Error(`Failed to export splitwise groups: ${groupsError.message}`);
      }

      const retry = await supabase
        .from("groups")
        .select("id,name")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (retry.error) {
        throw new Error(`Failed to export splitwise groups: ${retry.error.message}`);
      }

      resolvedGroupsData = (retry.data ?? []) as GroupCsvRow[];
    }

    const groups = (resolvedGroupsData ?? []) as GroupCsvRow[];
    if (groups.length === 0) {
      const emptyCsv = rowsToCsv(
        [
          "group_id",
          "group_name",
          "group_currency",
          "expense_id",
          "description",
          "expense_amount",
          "split_type",
          "paid_by_member_id",
          "paid_by_name",
          "split_member_id",
          "split_member_name",
          "split_amount",
          "created_at",
        ],
        [],
      );
      triggerCsvDownload(`splitwise_${stamp}.csv`, emptyCsv);
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

      if (expenseSplits.length === 0) {
        rows.push({
          group_id: expense.group_id,
          group_name: group?.name ?? "",
          group_currency: group?.currency ?? "INR",
          expense_id: expense.id,
          description: expense.description,
          expense_amount: Number(expense.amount).toFixed(2),
          split_type: expense.split_type,
          paid_by_member_id: expense.paid_by_id,
          paid_by_name: paidBy?.name ?? "",
          split_member_id: "",
          split_member_name: "",
          split_amount: "",
          created_at: expense.created_at,
        });
        return;
      }

      expenseSplits.forEach((split) => {
        const splitMember = memberById.get(split.member_id);
        rows.push({
          group_id: expense.group_id,
          group_name: group?.name ?? "",
          group_currency: group?.currency ?? "INR",
          expense_id: expense.id,
          description: expense.description,
          expense_amount: Number(expense.amount).toFixed(2),
          split_type: expense.split_type,
          paid_by_member_id: expense.paid_by_id,
          paid_by_name: paidBy?.name ?? "",
          split_member_id: split.member_id,
          split_member_name: splitMember?.name ?? "",
          split_amount: Number(split.amount).toFixed(2),
          created_at: expense.created_at,
        });
      });
    });

    const csv = rowsToCsv(
      [
        "group_id",
        "group_name",
        "group_currency",
        "expense_id",
        "description",
        "expense_amount",
        "split_type",
        "paid_by_member_id",
        "paid_by_name",
        "split_member_id",
        "split_member_name",
        "split_amount",
        "created_at",
      ],
      rows,
    );

    triggerCsvDownload(`splitwise_${stamp}.csv`, csv);
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
      {/* Navbar */}
      <header className="navbar">
        <div className="navbar-brand">
          <div className="logo-mark">
            <img src="/favicon.svg" alt="Expezplit logo" className="logo-mark-img" />
          </div>
          <div className="logo-text">ExpeZplit</div>
          <Show when="signed-in">
            <button className="btn btn-secondary btn-sm" onClick={handleDownloadAllCsv} disabled={isExporting} style={{ marginLeft: 12 }}>
              {isExporting ? "Preparing..." : "Download CSV"}
            </button>
          </Show>
        </div>

        <div className="navbar-actions">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="btn btn-ghost">Login</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="btn btn-primary btn-sm">Register</button>
            </SignUpButton>
            {themeToggleButton}
          </Show>

          <Show when="signed-in">
            {themeToggleButton}
            <Notifications />
            <UserButton
              appearance={{
                elements: { avatarBox: { width: 34, height: 34 } },
              }}
            />
          </Show>
        </div>
      </header>

      {/* Main */}
      <main style={{ flex: 1 }}>
        {!isLoaded && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 300,
              color: "var(--text-muted)",
            }}
          >
            Loading...
          </div>
        )}

        {isLoaded && !isSignedIn && <HomePage />}

        {isLoaded && isSignedIn && (
          <div className="dashboard">
            <div className="tab-bar">
              <button
                className={tab === "expense" ? "tab-btn active" : "tab-btn"}
                onClick={() => setTab("expense")}
              >
                Expense Tracker
              </button>
              <button
                className={tab === "splitwise" ? "tab-btn active" : "tab-btn"}
                onClick={() => setTab("splitwise")}
              >
                Splitwise
              </button>
            </div>

            {tab === "expense" && <ExpenseTracker />}
            {tab === "splitwise" && <Splitwise />}
          </div>
        )}
      </main>

      <footer className="app-footer">
        Expezplit &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

export default App;
