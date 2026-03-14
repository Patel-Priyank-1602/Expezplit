import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useUser } from "@clerk/react";
import { format, parseISO } from "date-fns";
import { supabase } from "./lib/supabase";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = ["#7C5CFC", "#22C55E", "#F59E0B", "#EF4444", "#3B82F6", "#8B5CF6"];

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

/* Types (matching Supabase schema) */
type Member = { id: string; name: string; email: string; is_current_user: boolean };
type SplitDetail = { id?: string; member_id: string; amount: number };
type GroupExpense = {
  id: string;
  description: string;
  amount: number;
  paid_by_id: string;
  split_type: "equal" | "custom";
  splits: SplitDetail[];
  created_at: string;
};
type Group = {
  id: string;
  name: string;
  members: Member[];
  expenses: GroupExpense[];
  admin_user_id: string | null;
  invite_code: string | null;
  owner_user_id: string;
};

/* ─── Invite code generator ───
   Format: 3 digits + 3 letters + 3 special chars, shuffled together */
const generateInviteCode = (): string => {
  const nums = "0123456789";
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const specials = "@#$!*&%+~?";
  const pick = (s: string, n: number) =>
    Array.from({ length: n }, () => s[Math.floor(Math.random() * s.length)]);
  const parts = [...pick(nums, 3), ...pick(chars, 3), ...pick(specials, 3)];
  for (let i = parts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }
  return parts.join("");
};

export function Splitwise() {
  const { user } = useUser();
  const userId = user?.id;

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [isDeletingGroups, setIsDeletingGroups] = useState(false);
  const [loading, setLoading] = useState(true);

  const [groupName, setGroupName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");

  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [splitType, setSplitType] = useState<"equal" | "custom">("equal");
  const [paidById, setPaidById] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [settleState, setSettleState] = useState<Record<string, { toId: string; amount: string }>>({});
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
  const [isCurrencyMenuOpen, setIsCurrencyMenuOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");
  const [isAllTransactionsOpen, setIsAllTransactionsOpen] = useState(false);
  const currencyMenuRef = useRef<HTMLDivElement | null>(null);
  const currencySearchInputRef = useRef<HTMLInputElement | null>(null);

  // Join-group & invite-code state
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const hasSelectedRate = currencyCode === BASE_CURRENCY || (conversionRates[currencyCode] ?? 0) > 0;
  const activeCurrencyCode: CurrencyCode = hasSelectedRate ? currencyCode : BASE_CURRENCY;
  const currencySymbol = getCurrencySymbol(activeCurrencyCode);
  const selectedRate = activeCurrencyCode === BASE_CURRENCY ? 1 : (conversionRates[activeCurrencyCode] ?? 1);

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

  const currentGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  const applyActiveGroup = useCallback((group: Group | null) => {
    setSelectedGroupId(group?.id ?? null);

    if (group && group.members.length) {
      setPaidById(group.members[0].id);
      setSelectedIds(new Set(group.members.map((m) => m.id)));
      return;
    }

    setPaidById("");
    setSelectedIds(new Set());
  }, []);

  /** Returns true if the current user is the admin of the given group.
   *  Falls back to checking owner_user_id for groups created before admin system. */
  const isAdmin = useCallback((group: Group) => {
    if (group.admin_user_id) return group.admin_user_id === userId;
    return group.owner_user_id === userId;
  }, [userId]);

  /** Returns true if the member is the currently logged-in user (by email). */
  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? "";
  const isMe = (m: Member) => !!userEmail && m.email.toLowerCase() === userEmail;

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

  /* ─── Fetch all groups with members & expenses ─── */
  const fetchGroups = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";

    // 1. Fetch groups owned by this user
    const { data: ownedGroupRows, error: gErr } = await supabase
      .from("groups")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (gErr) { console.error("Error fetching groups:", gErr.message); setLoading(false); return; }

    // 2. Fetch groups the user has joined via invite code (by email match in group_members)
    let joinedGroupRows: any[] = [];
    if (userEmail) {
      const { data: membershipRows } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("email", userEmail);

      const ownedIds = new Set((ownedGroupRows ?? []).map((g: any) => g.id));
      const joinedIds = (membershipRows ?? [])
        .map((m: any) => m.group_id as string)
        .filter((id) => !ownedIds.has(id));

      if (joinedIds.length > 0) {
        const { data: jRows } = await supabase
          .from("groups")
          .select("*")
          .in("id", joinedIds)
          .order("created_at", { ascending: true });
        joinedGroupRows = jRows ?? [];
      }
    }

    const groupRows = [...(ownedGroupRows ?? []), ...joinedGroupRows];

    if (groupRows.length === 0) { setGroups([]); setLoading(false); return; }

    const groupIds = groupRows.map((g: any) => g.id);

    // 2. Fetch all members for these groups
    const { data: memberRows } = await supabase
      .from("group_members")
      .select("*")
      .in("group_id", groupIds)
      .order("created_at", { ascending: true });

    // 3. Fetch all expenses for these groups
    const { data: expenseRows } = await supabase
      .from("group_expenses")
      .select("*")
      .in("group_id", groupIds)
      .order("created_at", { ascending: true });

    // 4. Fetch all splits
    const expenseIds = (expenseRows ?? []).map((e: any) => e.id);
    let splitRows: any[] = [];
    if (expenseIds.length > 0) {
      const { data } = await supabase
        .from("group_expense_splits")
        .select("*")
        .in("expense_id", expenseIds);
      splitRows = data ?? [];
    }

    // 5. Assemble
    const assembled: Group[] = groupRows.map((g: any) => {
      const members: Member[] = (memberRows ?? [])
        .filter((m: any) => m.group_id === g.id)
        .map((m: any) => ({ id: m.id, name: m.name, email: m.email, is_current_user: m.is_current_user }));

      const expenses: GroupExpense[] = (expenseRows ?? [])
        .filter((e: any) => e.group_id === g.id)
        .map((e: any) => ({
          id: e.id,
          description: e.description,
          amount: Number(e.amount),
          paid_by_id: e.paid_by_id,
          split_type: e.split_type,
          created_at: e.created_at,
          splits: splitRows
            .filter((s: any) => s.expense_id === e.id)
            .map((s: any) => ({ id: s.id, member_id: s.member_id, amount: Number(s.amount) })),
        }));

      return {
        id: g.id,
        name: g.name,
        members,
        expenses,
        admin_user_id: g.admin_user_id ?? null,
        invite_code: g.invite_code ?? null,
        owner_user_id: g.user_id,
      };
    });

    setGroups(assembled);
    setLoading(false);
  }, [userId, user]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  /* ─── Create group ─── */
  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || !userId) return;

    // Generate a unique invite code (retry once on collision)
    let inviteCode = generateInviteCode();
    let grp: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data, error: gErr } = await supabase
        .from("groups")
        .insert({ user_id: userId, name: groupName.trim(), admin_user_id: userId, invite_code: inviteCode })
        .select()
        .single();
      if (!gErr) { grp = data; break; }
      if (gErr.code === "23505") { inviteCode = generateInviteCode(); continue; } // unique collision
      console.error("Error creating group:", gErr.message);
      return;
    }
    if (!grp) return;

    // Add current user as first member
    let selfMember: Member | null = null;
    if (user) {
      const { data: mem } = await supabase
        .from("group_members")
        .insert({
          group_id: grp.id,
          name: user.fullName || user.firstName || "You",
          email: user.primaryEmailAddress?.emailAddress || "",
          is_current_user: true,
        })
        .select()
        .single();
      if (mem) selfMember = { id: mem.id, name: mem.name, email: mem.email, is_current_user: true };
    }

    const newGroup: Group = {
      id: grp.id,
      name: grp.name,
      members: selfMember ? [selfMember] : [],
      expenses: [],
      admin_user_id: grp.admin_user_id ?? userId ?? null,
      invite_code: grp.invite_code ?? null,
      owner_user_id: grp.user_id ?? userId ?? "",
    };

    setGroups((p) => [...p, newGroup]);
    applyActiveGroup(newGroup);
    setGroupName("");
  };

  /* ─── Select group ─── */
  const selectGroup = (gid: string) => {
    const g = groups.find((x) => x.id === gid) ?? null;
    applyActiveGroup(g);
  };

  const toggleGroupSelection = (gid: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid);
      else next.add(gid);
      return next;
    });
  };

  const deleteSelectedGroups = async () => {
    if (!userId || selectedGroupIds.size === 0 || isDeletingGroups) return;

    const idsToDelete = Array.from(selectedGroupIds);

    // Only allow deleting groups the current user is admin/owner of
    const adminIds = idsToDelete.filter((id) => {
      const g = groups.find((x) => x.id === id);
      return g ? isAdmin(g) : false;
    });
    const skipped = idsToDelete.length - adminIds.length;

    if (adminIds.length === 0) {
      window.alert("You can only delete groups you created. None of the selected groups belong to you.");
      return;
    }

    const confirmMsg = skipped > 0
      ? `Delete ${adminIds.length} group${adminIds.length > 1 ? "s" : ""} you own? (${skipped} joined group${skipped > 1 ? "s" : ""} will be skipped.) This removes all members and expenses.`
      : `Delete ${adminIds.length} selected group${adminIds.length > 1 ? "s" : ""}? This will also delete all members and expenses in those groups.`;

    if (!window.confirm(confirmMsg)) return;

    setIsDeletingGroups(true);

    const { error } = await supabase
      .from("groups")
      .delete()
      .eq("user_id", userId)
      .in("id", adminIds);

    if (error) {
      console.error("Error deleting groups:", error.message);
      window.alert("Unable to delete selected groups right now. Please try again.");
      setIsDeletingGroups(false);
      return;
    }

    const remainingGroups = groups.filter((group) => !adminIds.includes(group.id));
    const shouldResetActive = !!selectedGroupId && adminIds.includes(selectedGroupId);

    setGroups(remainingGroups);
    setSelectedGroupIds(new Set());

    if (shouldResetActive) {
      applyActiveGroup(remainingGroups[0] ?? null);
    }

    setIsDeletingGroups(false);
  };

  useEffect(() => {
    setSelectedGroupIds((prev) => {
      const ids = new Set(groups.map((group) => group.id));
      return new Set(Array.from(prev).filter((id) => ids.has(id)));
    });
  }, [groups]);

  /* ─── Join group by invite code ─── */
  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || !userId || !user) return;
    setJoinLoading(true);
    setJoinError(null);

    const { data: groupData, error: lookupErr } = await supabase
      .from("groups")
      .select("id, name, user_id")
      .eq("invite_code", joinCode.trim())
      .maybeSingle();

    if (lookupErr || !groupData) {
      setJoinError("Invalid invite code. Please check and try again.");
      setJoinLoading(false);
      return;
    }

    const userEmail = user.primaryEmailAddress?.emailAddress ?? "";
    const { data: existing } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", groupData.id)
      .eq("email", userEmail)
      .maybeSingle();

    if (existing) {
      setJoinError("You are already a member of this group.");
      setJoinLoading(false);
      return;
    }

    const { error: insertErr } = await supabase
      .from("group_members")
      .insert({
        group_id: groupData.id,
        name: user.fullName || user.firstName || "User",
        email: userEmail,
        is_current_user: true,
      });

    if (insertErr) {
      setJoinError("Failed to join group. Please try again.");
      setJoinLoading(false);
      return;
    }

    await fetchGroups();
    setJoinCode("");
    setJoinError(null);
    setJoinLoading(false);
    setSelectedGroupId(groupData.id);
  };

  /* ─── Generate invite code for existing groups without one ─── */
  const handleGenerateInviteCode = async (group: Group) => {
    if (!isAdmin(group)) return;
    const code = generateInviteCode();
    const { error } = await supabase
      .from("groups")
      .update({ invite_code: code })
      .eq("id", group.id);
    if (error) { window.alert("Failed to generate invite code. Please try again."); return; }
    setGroups((prev) => prev.map((g) => g.id === group.id ? { ...g, invite_code: code } : g));
  };
  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup || !memberName.trim() || !memberEmail.trim()) return;

    const isSelf = !!user && memberEmail.toLowerCase() === user.primaryEmailAddress?.emailAddress?.toLowerCase();

    const { data: mem, error } = await supabase
      .from("group_members")
      .insert({
        group_id: currentGroup.id,
        name: memberName.trim(),
        email: memberEmail.trim(),
        is_current_user: isSelf,
      })
      .select()
      .single();

    if (error || !mem) { console.error("Error adding member:", error?.message); return; }

    const m: Member = { id: mem.id, name: mem.name, email: mem.email, is_current_user: mem.is_current_user };
    const updated = { ...currentGroup, members: [...currentGroup.members, m] };
    setGroups((p) => p.map((g) => (g.id === updated.id ? updated : g)));
    setSelectedIds((p) => new Set([...p, m.id]));
    setMemberName("");
    setMemberEmail("");
  };

  /* ─── Toggle split member ─── */
  const toggle = (mid: string) => {
    setSelectedIds((p) => { const n = new Set(p); n.has(mid) ? n.delete(mid) : n.add(mid); return n; });
  };

  /* ─── Add expense ─── */
  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup) return;
    const valDisplay = parseFloat(expAmount);
    if (!expDesc.trim() || isNaN(valDisplay) || valDisplay <= 0) return;
    const valBase = convertToBase(valDisplay);

    let splits: SplitDetail[];
    if (splitType === "equal") {
      const sel = currentGroup.members.filter((m) => selectedIds.has(m.id));
      if (!sel.length) return;
      const per = valBase / sel.length;
      splits = sel.map((m) => ({ member_id: m.id, amount: per }));
    } else {
      splits = currentGroup.members
        .filter((m) => selectedIds.has(m.id))
        .map((m) => ({ member_id: m.id, amount: convertToBase(parseFloat(customAmounts[m.id] || "0")) }))
        .filter((s) => s.amount > 0);
      if (!splits.length) return;
    }

    // Insert expense
    const { data: exp, error: eErr } = await supabase
      .from("group_expenses")
      .insert({
        group_id: currentGroup.id,
        description: expDesc.trim(),
        amount: valBase,
        paid_by_id: paidById || currentGroup.members[0]?.id || "",
        split_type: splitType,
      })
      .select()
      .single();

    if (eErr || !exp) { console.error("Error adding expense:", eErr?.message); return; }

    // Insert splits
    const splitInserts = splits.map((s) => ({
      expense_id: exp.id,
      member_id: s.member_id,
      amount: s.amount,
    }));

    const { data: splitData, error: sErr } = await supabase
      .from("group_expense_splits")
      .insert(splitInserts)
      .select();

    if (sErr) { console.error("Error adding splits:", sErr.message); return; }

    const newExp: GroupExpense = {
      id: exp.id,
      description: exp.description,
      amount: Number(exp.amount),
      paid_by_id: exp.paid_by_id,
      split_type: exp.split_type,
      created_at: exp.created_at,
      splits: (splitData ?? []).map((s: any) => ({ id: s.id, member_id: s.member_id, amount: Number(s.amount) })),
    };

    const updated = { ...currentGroup, expenses: [...currentGroup.expenses, newExp] };
    setGroups((p) => p.map((g) => (g.id === updated.id ? updated : g)));
    setExpDesc(""); setExpAmount(""); setCustomAmounts({});
  };

  /* ─── Delete expense ─── */
  const deleteExp = async (eid: string) => {
    if (!currentGroup) return;

    // Splits are cascade deleted by the FK constraint
    const { error } = await supabase.from("group_expenses").delete().eq("id", eid);
    if (error) { console.error("Error deleting expense:", error.message); return; }

    const updated = { ...currentGroup, expenses: currentGroup.expenses.filter((e) => e.id !== eid) };
    setGroups((p) => p.map((g) => (g.id === updated.id ? updated : g)));
  };

  /* ─── Settle Debt ─── */
  const handleSettle = async (fromId: string) => {
    if (!currentGroup) return;
    const state = settleState[fromId];
    if (!state || !state.toId) return;
    const valDisplay = parseFloat(state.amount);
    if (isNaN(valDisplay) || valDisplay <= 0) return;
    const valBase = convertToBase(valDisplay);

    const { data: exp, error: eErr } = await supabase
      .from("group_expenses")
      .insert({
        group_id: currentGroup.id,
        description: "Payment",
        amount: valBase,
        paid_by_id: fromId,
        split_type: "custom",
      })
      .select()
      .single();

    if (eErr || !exp) { console.error("Error adding settlement:", eErr?.message); return; }

    const { data: splitData, error: sErr } = await supabase
      .from("group_expense_splits")
      .insert([{
        expense_id: exp.id,
        member_id: state.toId,
        amount: valBase,
      }])
      .select();

    if (sErr) { console.error("Error adding settlement splits:", sErr.message); return; }

    const newExp: GroupExpense = {
      id: exp.id,
      description: exp.description,
      amount: Number(exp.amount),
      paid_by_id: exp.paid_by_id,
      split_type: exp.split_type,
      created_at: exp.created_at,
      splits: (splitData ?? []).map((s: any) => ({ id: s.id, member_id: s.member_id, amount: Number(s.amount) })),
    };

    const updated = { ...currentGroup, expenses: [...currentGroup.expenses, newExp] };
    setGroups((p) => p.map((g) => (g.id === updated.id ? updated : g)));
    setSettleState((p) => { const n = { ...p }; delete n[fromId]; return n; });
  };

  /* ─── Remove Member ─── */
  const removeMember = async (mid: string, name: string) => {
    if (!currentGroup) return;
    if (!window.confirm(`Are you sure you want to remove ${name} from the group?`)) return;

    const { error } = await supabase.from("group_members").delete().eq("id", mid);
    if (error) {
      alert("Cannot remove member. They might be involved in expenses.");
      console.error("Error removing member:", error.message);
      return;
    }

    const updated = { ...currentGroup, members: currentGroup.members.filter((m) => m.id !== mid) };
    setGroups((p) => p.map((g) => (g.id === updated.id ? updated : g)));
  };

  /* ─── Balances ─── */
  const { balances, optimizedDebts } = useMemo(() => {
    if (!currentGroup) return { balances: new Map<string, number>(), optimizedDebts: [] };
    
    // 1. Calculate net balance for each member
    const bal = new Map<string, number>();
    currentGroup.members.forEach((m) => bal.set(m.id, 0));
    currentGroup.expenses.forEach((exp) => {
      bal.set(exp.paid_by_id, (bal.get(exp.paid_by_id) ?? 0) + exp.amount);
      exp.splits.forEach((s) => bal.set(s.member_id, (bal.get(s.member_id) ?? 0) - s.amount));
    });

    // 2. Simplify Debts (Greedy approach)
    type Person = { id: string; amount: number };
    const debtors: Person[] = [];
    const creditors: Person[] = [];

    bal.forEach((amount, id) => {
      // Precision margin to avoid float math bugs
      if (amount < -0.01) debtors.push({ id, amount: Math.abs(amount) });
      else if (amount > 0.01) creditors.push({ id, amount });
    });

    // Sort by largest amount first
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    type Debt = { from: string; to: string; amount: number };
    const optimized: Debt[] = [];

    let i = 0; // debtors index
    let j = 0; // creditors index

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      const settleAmount = Math.min(debtor.amount, creditor.amount);

      optimized.push({
        from: debtor.id,
        to: creditor.id,
        amount: settleAmount,
      });

      debtor.amount -= settleAmount;
      creditor.amount -= settleAmount;

      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    return { balances: bal, optimizedDebts: optimized };
  }, [currentGroup]);

  const transactionsSorted = useMemo(() => {
    if (!currentGroup) return [];
    return [...currentGroup.expenses].sort((a, b) => parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime());
  }, [currentGroup]);

  const topTransactions = useMemo(
    () => transactionsSorted.slice(0, 3),
    [transactionsSorted],
  );

  /* ─── Pie Data ─── */
  const pieData = useMemo(() => {
    if (!currentGroup) return [];
    const map = new Map<string, number>();
    currentGroup.expenses.forEach((exp) => {
      map.set(exp.paid_by_id, (map.get(exp.paid_by_id) ?? 0) + exp.amount);
      if (exp.description === "Payment" && exp.splits.length > 0) {
        const receiverId = exp.splits[0].member_id;
        map.set(receiverId, (map.get(receiverId) ?? 0) - exp.amount);
      }
    });
    return Array.from(map.entries())
      .map(([id, amount]) => {
        const m = currentGroup.members.find((x) => x.id === id);
        return { name: m ? (isMe(m) ? "You" : m.name) : "Unknown", amount };
      })
      .filter((d) => d.amount > 0.01);
  }, [currentGroup]);

  const initial = (n: string) => n.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  if (loading) {
    return (
      <div className="fade-in" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: "var(--text-muted)" }}>
        Loading groups...
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Create group + Join group — side by side */}
      <div className="group-top-row">
        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}>Create a new group</div>
          <form onSubmit={createGroup}>
            <div className="form-row">
              <div className="field">
                <label className="field-label">Group name</label>
                <input className="field-input" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Trip, Roommates, Office lunch..." />
              </div>
              <div className="field" style={{ flex: "0 0 auto" }}>
                <label className="field-label hidden-mobile">&nbsp;</label>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}>Join a group</div>
          <form onSubmit={handleJoinGroup}>
            <div className="form-row">
              <div className="field">
                <label className="field-label">Invite code</label>
                <input
                  className="field-input"
                  value={joinCode}
                  onChange={(e) => { setJoinCode(e.target.value); setJoinError(null); }}
                  placeholder="Enter 9-character invite code..."
                  maxLength={12}
                  autoComplete="off"
                />
              </div>
              <div className="field" style={{ flex: "0 0 auto" }}>
                <label className="field-label hidden-mobile">&nbsp;</label>
                <button type="submit" className="btn btn-secondary" disabled={joinLoading || !joinCode.trim()}>
                  {joinLoading ? "Joining..." : "Join"}
                </button>
              </div>
            </div>
            {joinError && <div style={{ marginTop: 8, fontSize: 13, color: "var(--red, #ef4444)" }}>{joinError}</div>}
          </form>
        </div>
      </div>

      {/* Group pills */}
      {groups.length > 0 && (
        <>
          <div className="group-pills-toolbar">
            <div className="group-pills-note">Select groups and click delete to remove them.</div>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={deleteSelectedGroups}
              disabled={selectedGroupIds.size === 0 || isDeletingGroups}
            >
              {isDeletingGroups ? "Deleting..." : `Delete selected (${selectedGroupIds.size})`}
            </button>
          </div>

          <div className="group-pills">
            {groups.map((g) => (
              <div key={g.id} className="group-pill-wrap">
                <input
                  className="group-pill-inline-check"
                  type="checkbox"
                  checked={selectedGroupIds.has(g.id)}
                  onChange={() => toggleGroupSelection(g.id)}
                  aria-label={`Select group ${g.name}`}
                  title={`Select ${g.name}`}
                />

                <button
                  type="button"
                  className={
                    g.id === selectedGroupId
                      ? selectedGroupIds.has(g.id)
                        ? "group-pill active selected-for-delete"
                        : "group-pill active"
                      : selectedGroupIds.has(g.id)
                      ? "group-pill selected-for-delete"
                      : "group-pill"
                  }
                  onClick={() => selectGroup(g.id)}
                >
                  {g.name}
                  <span className="pill-count">{g.members.length}</span>
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Group detail */}
      {currentGroup && (
        <>
          {/* Invite code bar */}
          <div className="invite-code-bar">
            <span className="invite-code-label">Invite Code</span>
            {currentGroup.invite_code ? (
              <>
                <code className="invite-code-value">{currentGroup.invite_code}</code>
                <button
                  type="button"
                  className="btn-copy"
                  onClick={() => {
                    navigator.clipboard.writeText(currentGroup.invite_code!);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                >
                  {copiedCode ? "✓ Copied" : "Copy"}
                </button>
              </>
            ) : isAdmin(currentGroup) ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleGenerateInviteCode(currentGroup)}>
                Generate code
              </button>
            ) : (
              <span className="invite-code-empty">No code yet — ask the group admin</span>
            )}
            <button
              type="button"
              className="btn-refresh"
              disabled={refreshing}
              title="Refresh group data"
              onClick={async () => {
                setRefreshing(true);
                await fetchGroups();
                setRefreshing(false);
              }}
            >
              <span className={refreshing ? "refresh-icon spinning" : "refresh-icon"}>↻</span>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            {isAdmin(currentGroup) && (
              <span className="admin-badge">Admin</span>
            )}
          </div>

          <div className="splitwise-currency-row">
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

          <div className="split-cols">
          {/* Left: Members */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>Members</div>
            <form onSubmit={addMember}>
              <div className="form-row">
                <div className="field">
                  <label className="field-label">Name</label>
                  <input className="field-input" value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="Friend name" />
                </div>
                <div className="field">
                  <label className="field-label">Email</label>
                  <input className="field-input" type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="friend@example.com" />
                </div>
                <div className="field" style={{ flex: "0 0 auto" }}>
                  <label className="field-label hidden-mobile">&nbsp;</label>
                  <button type="submit" className="btn btn-secondary btn-sm">Add</button>
                </div>
              </div>
            </form>

            <ul className="member-list">
              {currentGroup.members.length === 0 ? (
                <li style={{ textAlign: "center", padding: 20, color: "var(--text-muted)", fontSize: 14 }}>
                  No members yet. Add yourself and friends.
                </li>
              ) : (
                currentGroup.members.map((m) => {
                  const b = balances.get(m.id) ?? 0;
                  return (
                    <li key={m.id} className="member-item" style={{ flexWrap: "wrap", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 auto", minWidth: 200 }}>
                        <div className="avatar">{initial(m.name)}</div>
                        <div className="member-info">
                          <div className="member-name">
                            {m.name}
                            {isMe(m) && <span className="you-tag">You</span>}
                          </div>
                          <div className="member-email">{m.email}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
                        <div className={`balance-text ${b > 0.01 ? "gets" : b < -0.01 ? "owes" : "even"}`}>
                          {b > 0.01 ? `gets ${currencySymbol}${convertFromBase(b).toFixed(2)}` : b < -0.01 ? `owes ${currencySymbol}${convertFromBase(Math.abs(b)).toFixed(2)}` : "settled"}
                        </div>
                        {b < -0.01 && !settleState[m.id] && (
                          <button className="btn btn-secondary btn-sm" onClick={() => setSettleState({ ...settleState, [m.id]: { toId: "", amount: convertFromBase(Math.abs(b)).toFixed(2) } })}>Pay</button>
                        )}
                        {isAdmin(currentGroup) && (
                          <button className="btn-danger btn-sm" style={{ padding: "5px 10px" }} onClick={() => removeMember(m.id, m.name)} title="Remove Member">✕</button>
                        )}
                      </div>

                      {settleState[m.id] && (
                        <div style={{ display: "flex", width: "100%", gap: "8px", alignItems: "center", background: "var(--bg-raised)", padding: "12px", borderRadius: "10px", flexWrap: "wrap", border: "1px solid var(--border)" }}>
                          <select className="field-select" style={{ flex: "1 1 120px", padding: "8px 12px", fontSize: "14px", height: "auto" }} value={settleState[m.id].toId} onChange={(e) => setSettleState({ ...settleState, [m.id]: { ...settleState[m.id], toId: e.target.value } })}>
                            <option value="">Pay to...</option>
                            {currentGroup.members.filter(x => x.id !== m.id).map(x => (
                               <option key={x.id} value={x.id}>{x.name}</option>
                            ))}
                          </select>
                          <input type="number" min="0" step="0.01" className="field-input" style={{ flex: "1 1 100px", padding: "8px 12px", fontSize: "14px", height: "auto" }} value={settleState[m.id].amount} onChange={(e) => setSettleState({ ...settleState, [m.id]: { ...settleState[m.id], amount: e.target.value } })} />
                          <div style={{ display: "flex", gap: "8px", flex: "1 1 auto" }}>
                            <button className="btn btn-primary btn-sm" style={{ padding: "8px 16px" }} onClick={() => handleSettle(m.id)}>Submit</button>
                            <button className="btn btn-secondary btn-sm" style={{ padding: "8px 16px" }} onClick={() => setSettleState((p) => { const n = { ...p }; delete n[m.id]; return n; })}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })
              )}
            </ul>

            {/* Smart Debt Graph */}
            {optimizedDebts.length > 0 && (
              <div className="smart-debts">
                <div className="smart-debts-header">
                  <div className="smart-debts-title">Optimized Settlements</div>
                  <div className="smart-debts-sub">Fewest possible transactions</div>
                </div>
                <div className="debt-list">
                  {optimizedDebts.map((debt, idx) => {
                    const fromMem = currentGroup.members.find((m) => m.id === debt.from);
                    const toMem = currentGroup.members.find((m) => m.id === debt.to);
                    if (!fromMem || !toMem) return null;
                    
                    return (
                      <div key={idx} className="debt-card">
                        <div className="debt-person debtor">
                          <div className="debt-avatar">{initial(fromMem.name)}</div>
                          <div className="debt-name">{isMe(fromMem) ? "You" : fromMem.name}</div>
                        </div>
                        
                        <div className="debt-arrow">
                          <div className="debt-line"></div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="debt-arrow-icon"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                          <div className="debt-amount">{currencySymbol}{convertFromBase(debt.amount).toFixed(2)}</div>
                        </div>

                        <div className="debt-person creditor">
                          <div className="debt-avatar">{initial(toMem.name)}</div>
                          <div className="debt-name">{isMe(toMem) ? "You" : toMem.name}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pie Chart: Who paid how much */}
            {pieData.length > 0 && (
              <div className="card" style={{ marginTop: 24, padding: "24px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
                  <div>
                    <div className="card-title" style={{ fontSize: "16px", marginBottom: "4px" }}>Spending by member</div>
                    <div className="card-sub" style={{ fontSize: "13px" }}>Member-wise breakdown</div>
                  </div>
                </div>
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="amount" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} stroke="none">
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => `${currencySymbol}${convertFromBase(Number(value)).toFixed(2)}`} />
                      <Legend verticalAlign="bottom" height={36} iconType="square" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Right: Expenses */}
          <div className="card">
            <div className="card-head" style={{ marginBottom: 14 }}>
              <div>
                <div className="card-title">Group expenses</div>
                <div className="card-sub">Showing top 3 latest transactions</div>
              </div>
            </div>
            <form onSubmit={addExpense}>
              <div className="form-row" style={{ marginBottom: 10 }}>
                <div className="field">
                  <label className="field-label">What for?</label>
                  <input className="field-input" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} placeholder="Hotel, Taxi, Dinner..." />
                </div>
                <div className="field">
                  <label className="field-label">Amount ({activeCurrencyCode})</label>
                  <input className="field-input" type="number" min="0" step="0.01" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div className="form-row" style={{ marginBottom: 10 }}>
                <div className="field">
                  <label className="field-label">Paid by</label>
                  <select className="field-select" value={paidById} onChange={(e) => setPaidById(e.target.value)}>
                    {currentGroup.members.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}{isMe(m) ? " (You)" : ""}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Split type</label>
                  <select className="field-select" value={splitType} onChange={(e) => setSplitType(e.target.value as "equal" | "custom")}>
                    <option value="equal">Equal split</option>
                    <option value="custom">Custom amounts</option>
                  </select>
                </div>
              </div>

              <label className="field-label" style={{ display: "block", marginBottom: 6 }}>Split between</label>
              {splitType === "equal" ? (
                <div className="split-checks">
                  {currentGroup.members.map((m) => (
                    <label key={m.id} className="split-check">
                      <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggle(m.id)} />
                      <div>
                        <div className="split-check-label">{m.name}{isMe(m) ? " (You)" : ""}</div>
                        <div className="split-check-email">{m.email}</div>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="split-checks">
                  {currentGroup.members.map((m) => (
                    <div key={m.id} className="custom-row">
                      <div className="split-check-label">{m.name}{isMe(m) ? " (You)" : ""}</div>
                      <input type="number" min="0" step="0.01" placeholder="0.00" value={customAmounts[m.id] || ""} onChange={(e) => setCustomAmounts((p) => ({ ...p, [m.id]: e.target.value }))} />
                    </div>
                  ))}
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>Add expense</button>
            </form>

            <ul className="exp-list" style={{ marginTop: 18 }}>
              {topTransactions.length === 0 ? (
                <li style={{ textAlign: "center", padding: 20, color: "var(--text-muted)", fontSize: 14 }}>
                  No expenses yet. Add one above.
                </li>
              ) : (
                topTransactions.map((exp) => {
                  const payer = currentGroup.members.find((m) => m.id === exp.paid_by_id);
                  return (
                    <li key={exp.id} className="exp-item">
                      <div>
                        <div className="exp-desc">{exp.description}</div>
                        <div className="exp-meta">
                          Paid by {payer?.name ?? "Unknown"} &middot;{" "}
                          <span className={`split-tag ${exp.split_type}`}>{exp.split_type === "equal" ? "Equal" : "Custom"}</span> &middot;{" "}
                          {exp.splits.length} {exp.splits.length === 1 ? "person" : "people"} &middot;{" "}
                          {format(parseISO(exp.created_at), "dd MMM yyyy, HH:mm")}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className="exp-amount">{currencySymbol}{convertFromBase(exp.amount).toFixed(2)}</span>
                        <button className="btn-danger" onClick={() => deleteExp(exp.id)} title="Delete">✕</button>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>

            {transactionsSorted.length > 3 && (
              <div className="exp-more-row">
                <button className="btn btn-secondary btn-sm" onClick={() => setIsAllTransactionsOpen(true)}>
                  View all
                </button>
                <span className="exp-more-hint">More than 3 transactions available ↓</span>
              </div>
            )}

            {isAllTransactionsOpen && (
              <div className="modal-backdrop" onClick={() => setIsAllTransactionsOpen(false)}>
                <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                  <div className="card-head" style={{ marginBottom: 10 }}>
                    <div>
                      <div className="card-title">All transactions</div>
                      <div className="card-sub">Complete Splitwise transaction history</div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => setIsAllTransactionsOpen(false)}>Close</button>
                  </div>

                  <div className="exp-list modal-table-wrap" style={{ marginTop: 0 }}>
                    {transactionsSorted.length === 0 ? (
                      <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)", fontSize: 14 }}>
                        No expenses yet. Add one above.
                      </div>
                    ) : (
                      transactionsSorted.map((exp) => {
                        const payer = currentGroup.members.find((m) => m.id === exp.paid_by_id);
                        return (
                          <li key={exp.id} className="exp-item">
                            <div>
                              <div className="exp-desc">{exp.description}</div>
                              <div className="exp-meta">
                                Paid by {payer?.name ?? "Unknown"} &middot;{" "}
                                <span className={`split-tag ${exp.split_type}`}>{exp.split_type === "equal" ? "Equal" : "Custom"}</span> &middot;{" "}
                                {exp.splits.length} {exp.splits.length === 1 ? "person" : "people"} &middot;{" "}
                                {format(parseISO(exp.created_at), "dd MMM yyyy, HH:mm")}
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span className="exp-amount">{currencySymbol}{convertFromBase(exp.amount).toFixed(2)}</span>
                              <button className="btn-danger" onClick={() => deleteExp(exp.id)} title="Delete">✕</button>
                            </div>
                          </li>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>
        </>
      )}
    </div>
  );
}
