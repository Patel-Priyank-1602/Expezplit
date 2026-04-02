import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useUser } from "@clerk/react";
import { supabase } from "./lib/supabase";
import { format, parseISO } from "date-fns";

/* ─── Types ─── */
type SplitMemberEntry = {
  name: string;
  email: string;
  amount: number;
  settled: boolean;
};

type Notification = {
  id: string;
  user_email: string;
  type: "pay" | "receive";
  group_id: string;
  expense_id: string;
  item: string;
  amount: number;
  paid_by_name: string;
  paid_by_email: string;
  split_members: SplitMemberEntry[];
  is_settled: boolean;
  created_at: string;
};

/* ─── Helper: create notifications after an expense is added ─── */
export async function createExpenseNotifications(opts: {
  expenseId: string;
  groupId: string;
  description: string;
  amount: number;
  paidByName: string;
  paidByEmail: string;
  splits: { memberName: string; memberEmail: string; amount: number }[];
}) {
  const { expenseId, groupId, description, paidByName, paidByEmail, splits } = opts;

  // Skip notification creation for "Payment" (settlement) expenses –
  // settlements are handled separately via settleNotification()
  if (description === "Payment") return;

  const notifications: {
    user_email: string;
    type: "pay" | "receive";
    group_id: string;
    expense_id: string;
    item: string;
    amount: number;
    paid_by_name: string;
    paid_by_email: string;
    split_members: SplitMemberEntry[];
    is_settled: boolean;
  }[] = [];

  // Build list of members who owe (everyone in splits except the payer)
  const owingMembers = splits.filter(
    (s) => s.memberEmail.toLowerCase() !== paidByEmail.toLowerCase()
  );

  // 1. Notification for each person who OWES money (type='pay')
  owingMembers.forEach((s) => {
    notifications.push({
      user_email: s.memberEmail.toLowerCase(),
      type: "pay",
      group_id: groupId,
      expense_id: expenseId,
      item: description,
      amount: s.amount,
      paid_by_name: paidByName,
      paid_by_email: paidByEmail.toLowerCase(),
      split_members: [],
      is_settled: false,
    });
  });

  // 2. Notification for the person who PAID (type='receive')
  if (owingMembers.length > 0) {
    notifications.push({
      user_email: paidByEmail.toLowerCase(),
      type: "receive",
      group_id: groupId,
      expense_id: expenseId,
      item: description,
      amount: 0, // total owed to them is sum of owing members
      paid_by_name: paidByName,
      paid_by_email: paidByEmail.toLowerCase(),
      split_members: owingMembers.map((s) => ({
        name: s.memberName,
        email: s.memberEmail.toLowerCase(),
        amount: s.amount,
        settled: false,
      })),
      is_settled: false,
    });
  }

  if (notifications.length === 0) return;

  const { error } = await supabase.from("notifications").insert(notifications);
  if (error) {
    console.error("Error creating notifications:", error.message);
  }
}

/* ─── Helper: settle a notification when payment is made ─── */
export async function settleNotification(opts: {
  payerEmail: string;
  receiverEmail: string;
  groupId: string;
}) {
  const { payerEmail, receiverEmail, groupId } = opts;
  const payerLower = payerEmail.toLowerCase();
  const receiverLower = receiverEmail.toLowerCase();

  // 1. Mark the payer's 'pay' notifications as settled for this group+receiver
  const { data: payNotifs } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_email", payerLower)
    .eq("type", "pay")
    .eq("group_id", groupId)
    .eq("is_settled", false)
    .eq("paid_by_email", receiverLower);

  if (payNotifs && payNotifs.length > 0) {
    // Settle the oldest unsettled notification first
    const oldest = payNotifs[0];
    await supabase
      .from("notifications")
      .update({ is_settled: true })
      .eq("id", oldest.id);
  }

  // 2. Update the receiver's 'receive' notifications – remove the payer from split_members
  const { data: recvNotifs } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_email", receiverLower)
    .eq("type", "receive")
    .eq("group_id", groupId)
    .eq("is_settled", false);

  if (recvNotifs) {
    for (const notif of recvNotifs) {
      const members: SplitMemberEntry[] = notif.split_members ?? [];
      const updated = members.map((m: SplitMemberEntry) =>
        m.email.toLowerCase() === payerLower ? { ...m, settled: true } : m
      );
      const allSettled = updated.every((m: SplitMemberEntry) => m.settled);

      await supabase
        .from("notifications")
        .update({
          split_members: updated,
          is_settled: allSettled,
        })
        .eq("id", notif.id);

      // If we found a matching member, only settle one at a time
      if (members.some((m: SplitMemberEntry) => m.email.toLowerCase() === payerLower && !m.settled)) {
        break;
      }
    }
  }
}

/* ─── Notifications Component ─── */
export function Notifications() {
  const { user } = useUser();
  const userEmail =
    user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? "";

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement | null>(null);

  /* ─── Fetch notifications ─── */
  const fetchNotifications = useCallback(async () => {
    if (!userEmail) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_email", userEmail)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching notifications:", error.message);
    } else {
      setNotifications((data ?? []) as Notification[]);
    }
    setLoading(false);
  }, [userEmail]);

  /* ─── Initial fetch ─── */
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  /* ─── Real-time subscription via Supabase Realtime ─── */
  useEffect(() => {
    if (!userEmail) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_email=eq.${userEmail}`,
        },
        (_payload) => {
          // Re-fetch all notifications on any change
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userEmail, fetchNotifications]);

  /* ─── Click outside to close ─── */
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  /* ─── Freeze body scroll when open ─── */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  /* ─── Unsettled count ─── */
  const unsettledCount = useMemo(
    () => notifications.filter((n) => !n.is_settled).length,
    [notifications]
  );

  /* ─── Dismiss (mark as settled) ─── */
  const dismissNotification = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ is_settled: true })
      .eq("id", id);

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_settled: true } : n))
    );
  };

  /* ─── Mark a specific member as paid (from the receiver's 'receive' notification) ─── */
  const markMemberSettled = async (notifId: string, memberEmail: string) => {
    const notif = notifications.find((n) => n.id === notifId);
    if (!notif) return;

    const memberLower = memberEmail.toLowerCase();
    const memberEntry = (notif.split_members ?? []).find(
      (m) => m.email.toLowerCase() === memberLower
    );
    if (!memberEntry) return;

    // 1. Look up the actual member IDs from group_members to create a real settlement
    const { data: memberRows } = await supabase
      .from("group_members")
      .select("id, email")
      .eq("group_id", notif.group_id);

    const payerRow = (memberRows ?? []).find(
      (r: any) => r.email.toLowerCase() === memberLower
    );
    const receiverRow = (memberRows ?? []).find(
      (r: any) => r.email.toLowerCase() === notif.paid_by_email.toLowerCase()
    );

    // 2. Create a real settlement expense in group_expenses (same as the Pay button does)
    if (payerRow && receiverRow) {
      const { data: exp, error: eErr } = await supabase
        .from("group_expenses")
        .insert({
          group_id: notif.group_id,
          description: "Payment",
          amount: memberEntry.amount,
          paid_by_id: payerRow.id,
          split_type: "custom",
        })
        .select()
        .single();

      if (!eErr && exp) {
        await supabase
          .from("group_expense_splits")
          .insert([{
            expense_id: exp.id,
            member_id: receiverRow.id,
            amount: memberEntry.amount,
          }]);
      }
    }

    // 3. Update this 'receive' notification – mark the member as settled
    const updatedMembers = (notif.split_members ?? []).map((m) =>
      m.email.toLowerCase() === memberLower ? { ...m, settled: true } : m
    );
    const allSettled = updatedMembers.every((m) => m.settled);

    await supabase
      .from("notifications")
      .update({
        split_members: updatedMembers,
        is_settled: allSettled,
      })
      .eq("id", notifId);

    // 4. Also settle the member's corresponding 'pay' notification
    const { data: payNotifs } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_email", memberLower)
      .eq("type", "pay")
      .eq("group_id", notif.group_id)
      .eq("expense_id", notif.expense_id)
      .eq("is_settled", false);

    if (payNotifs && payNotifs.length > 0) {
      await supabase
        .from("notifications")
        .update({ is_settled: true })
        .eq("id", payNotifs[0].id);
    }

    // 5. Update local state
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id === notifId) {
          return { ...n, split_members: updatedMembers, is_settled: allSettled };
        }
        return n;
      })
    );

    // 6. Notify Splitwise to refresh its group data
    window.dispatchEvent(new Event("expense-settled"));
  };

  /* ─── Clear all settled ─── */
  const clearAllSettled = async () => {
    const settledIds = notifications
      .filter((n) => n.is_settled)
      .map((n) => n.id);

    if (settledIds.length === 0) return;

    await supabase.from("notifications").delete().in("id", settledIds);

    setNotifications((prev) => prev.filter((n) => !n.is_settled));
  };

  const activeNotifs = notifications.filter((n) => !n.is_settled);
  const settledNotifs = notifications.filter((n) => n.is_settled);

  return (
    <div className="notif-wrapper" ref={panelRef}>
      {/* Bell button */}
      <button
        className="notif-bell-btn"
        onClick={() => setIsOpen((o) => !o)}
        title="Notifications"
        aria-label="Notifications"
        id="notification-bell"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unsettledCount > 0 && (
          <span className="notif-badge">{unsettledCount > 99 ? "99+" : unsettledCount}</span>
        )}
      </button>

      {/* Full-screen backdrop when open */}
      {isOpen && (
        <div className="notif-backdrop" onClick={() => setIsOpen(false)} />
      )}

      {/* Dropdown panel */}
      {isOpen && (
        <div className="notif-panel">
          <div className="notif-panel-header">
            <div className="notif-panel-title">Notifications</div>
            {settledNotifs.length > 0 && (
              <button
                className="notif-clear-btn"
                onClick={clearAllSettled}
              >
                Clear resolved
              </button>
            )}
          </div>

          <div className="notif-panel-body">
            {loading && (
              <div className="notif-empty">Loading...</div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="notif-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-muted)", marginBottom: 8 }}>
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                <div>No notifications yet</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Notifications will appear here when expenses are split
                </div>
              </div>
            )}

            {/* Active (unsettled) notifications */}
            {activeNotifs.length > 0 && (
              <>
                <div className="notif-section-label">Active</div>
                {activeNotifs.map((n) => (
                  <NotificationCard
                    key={n.id}
                    notification={n}
                    onDismiss={dismissNotification}
                    onMarkMemberSettled={markMemberSettled}
                  />
                ))}
              </>
            )}

            {/* Settled notifications */}
            {settledNotifs.length > 0 && (
              <>
                <div className="notif-section-label" style={{ marginTop: activeNotifs.length > 0 ? 8 : 0 }}>Resolved</div>
                {settledNotifs.map((n) => (
                  <NotificationCard
                    key={n.id}
                    notification={n}
                    onDismiss={dismissNotification}
                    onMarkMemberSettled={markMemberSettled}
                    isSettled
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Individual notification card ─── */
function NotificationCard({
  notification: n,
  onDismiss,
  onMarkMemberSettled,
  isSettled = false,
}: {
  notification: Notification;
  onDismiss: (id: string) => void;
  onMarkMemberSettled: (notifId: string, memberEmail: string) => void;
  isSettled?: boolean;
}) {
  const createdAt = (() => {
    try {
      return format(parseISO(n.created_at), "dd MMM yyyy, HH:mm");
    } catch {
      return "";
    }
  })();

  if (n.type === "pay") {
    // Person who needs to pay
    return (
      <div className={`notif-card ${isSettled ? "settled" : "pay"}`}>
        <div className="notif-card-icon pay">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14" />
            <path d="m19 12-7 7-7-7" />
          </svg>
        </div>
        <div className="notif-card-content">
          <div className="notif-card-title">
            {isSettled ? (
              <span className="notif-settled-label">Settled</span>
            ) : (
              "You need to pay"
            )}
          </div>
          <div className="notif-card-desc">
            {isSettled ? (
              <>
                You paid for <strong>{n.item}</strong>
              </>
            ) : (
              <>
                You need to pay for <strong>{n.item}</strong> which was split on{" "}
                <strong>{createdAt}</strong>. Money was paid by{" "}
                <strong>{n.paid_by_name}</strong>. So pay{" "}
                <strong className="notif-amount">
                  ₹{Number(n.amount).toFixed(2)}
                </strong>{" "}
                to <strong>{n.paid_by_name}</strong>.
              </>
            )}
          </div>
          <div className="notif-card-time">{createdAt}</div>
        </div>
        {!isSettled && (
          <button
            className="notif-dismiss-btn"
            onClick={() => onDismiss(n.id)}
            title="Mark as settled"
          >
            ✓
          </button>
        )}
      </div>
    );
  }

  // Person who paid (type === 'receive')
  const unsettledMembers = (n.split_members ?? []).filter(
    (m) => !m.settled
  );
  const settledMembers = (n.split_members ?? []).filter(
    (m) => m.settled
  );

  return (
    <div className={`notif-card ${isSettled ? "settled" : "receive"}`}>
      <div className="notif-card-icon receive">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V5" />
          <path d="m5 12 7-7 7 7" />
        </svg>
      </div>
      <div className="notif-card-content">
        <div className="notif-card-title">
          {isSettled ? (
            <span className="notif-settled-label">All settled</span>
          ) : (
            "People owe you"
          )}
        </div>
        <div className="notif-card-desc">
          You paid for <strong>{n.item}</strong>. This was split between{" "}
          {(n.split_members ?? []).map((m) => m.name).join(", ")}.
          {!isSettled && unsettledMembers.length > 0 && (
            <>
              {" "}
              So{" "}
              <strong>
                {unsettledMembers.map((m) => `${m.name} (₹${Number(m.amount).toFixed(2)})`).join(", ")}
              </strong>{" "}
              need to pay you.
            </>
          )}
        </div>

        {/* Members status chips */}
        {(n.split_members ?? []).length > 0 && (
          <div className="notif-member-chips">
            {unsettledMembers.map((m, i) => (
              <span key={`u-${i}`} className="notif-chip pending">
                {m.name} — ₹{Number(m.amount).toFixed(2)}
                {!isSettled && (
                  <button
                    className="notif-chip-btn"
                    onClick={() => onMarkMemberSettled(n.id, m.email)}
                    title={`Mark ${m.name} as paid`}
                  >
                    Mark paid
                  </button>
                )}
              </span>
            ))}
            {settledMembers.map((m, i) => (
              <span key={`s-${i}`} className="notif-chip done">
                {m.name} — Paid ✓
              </span>
            ))}
          </div>
        )}

        <div className="notif-card-time">{createdAt}</div>
      </div>
    </div>
  );
}
