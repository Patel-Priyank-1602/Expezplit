-- =============================================
-- ExpSplit – Notifications Table
-- Run this in your Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste → Run
-- =============================================

-- NOTIFICATIONS table
-- type: 'pay' = you owe someone, 'receive' = someone owes you
create table if not exists notifications (
  id              uuid primary key default gen_random_uuid(),
  user_email      text not null,                    -- recipient's email
  type            text not null check (type in ('pay', 'receive')),
  group_id        uuid not null references groups(id) on delete cascade,
  expense_id      uuid not null references group_expenses(id) on delete cascade,
  item            text not null,                    -- expense description
  amount          numeric(12,2) not null,           -- amount this person owes/is owed
  paid_by_name    text not null,                    -- name of person who paid
  paid_by_email   text not null,                    -- email of person who paid
  split_members   jsonb not null default '[]',      -- array of { name, email, amount, settled }
  is_settled      boolean not null default false,
  created_at      timestamptz not null default now()
);

-- Enable RLS
alter table notifications enable row level security;

-- Policies (open for now, matching existing pattern)
create policy "Users can read notifications"
  on notifications for select using (true);
create policy "Users can insert notifications"
  on notifications for insert with check (true);
create policy "Users can update notifications"
  on notifications for update using (true);
create policy "Users can delete notifications"
  on notifications for delete using (true);

-- Index for fast lookup by recipient email
create index if not exists idx_notifications_user_email on notifications(user_email);
create index if not exists idx_notifications_expense_id on notifications(expense_id);

-- Enable realtime on the notifications table
alter publication supabase_realtime add table notifications;
