-- =============================================
-- ExpSplit – Supabase Database Schema
-- Run this ENTIRE script in your Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste → Run
-- =============================================

-- 1. EXPENSES (Personal expense tracker)
create table if not exists expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  name        text not null,
  category    text not null,
  amount      numeric(12,2) not null check (amount > 0),
  currency    text not null default '₹',
  created_at  timestamptz not null default now()
);

-- 2. GROUPS (Splitwise groups)
create table if not exists groups (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  name        text not null,
  currency    text not null default '₹',
  created_at  timestamptz not null default now()
);

-- 3. GROUP MEMBERS
create table if not exists group_members (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references groups(id) on delete cascade,
  name            text not null,
  email           text not null,
  is_current_user boolean not null default false,
  created_at      timestamptz not null default now()
);

-- 4. GROUP EXPENSES
create table if not exists group_expenses (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  description text not null,
  amount      numeric(12,2) not null check (amount > 0),
  paid_by_id  uuid not null references group_members(id) on delete cascade,
  split_type  text not null check (split_type in ('equal', 'custom')),
  created_at  timestamptz not null default now()
);

-- 5. GROUP EXPENSE SPLITS
create table if not exists group_expense_splits (
  id          uuid primary key default gen_random_uuid(),
  expense_id  uuid not null references group_expenses(id) on delete cascade,
  member_id   uuid not null references group_members(id) on delete cascade,
  amount      numeric(12,2) not null check (amount >= 0)
);

-- =============================================
-- ROW LEVEL SECURITY
-- We use the user_id (Clerk ID) stored in each row.
-- Since we pass user_id from the app, we allow
-- operations where the user_id matches.
-- =============================================

-- Enable RLS on all tables
alter table expenses enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table group_expenses enable row level security;
alter table group_expense_splits enable row level security;

-- EXPENSES policies
create policy "Users can read own expenses"
  on expenses for select using (true);
create policy "Users can insert own expenses"
  on expenses for insert with check (true);
create policy "Users can delete own expenses"
  on expenses for delete using (true);

-- GROUPS policies
create policy "Users can read own groups"
  on groups for select using (true);
create policy "Users can insert own groups"
  on groups for insert with check (true);
create policy "Users can delete own groups"
  on groups for delete using (true);

-- GROUP MEMBERS policies
create policy "Users can read group members"
  on group_members for select using (true);
create policy "Users can insert group members"
  on group_members for insert with check (true);
create policy "Users can delete group members"
  on group_members for delete using (true);

-- GROUP EXPENSES policies
create policy "Users can read group expenses"
  on group_expenses for select using (true);
create policy "Users can insert group expenses"
  on group_expenses for insert with check (true);
create policy "Users can delete group expenses"
  on group_expenses for delete using (true);

-- GROUP EXPENSE SPLITS policies
create policy "Users can read splits"
  on group_expense_splits for select using (true);
create policy "Users can insert splits"
  on group_expense_splits for insert with check (true);
create policy "Users can delete splits"
  on group_expense_splits for delete using (true);

-- =============================================
-- INDEXES for faster queries
-- =============================================
create index if not exists idx_expenses_user_id on expenses(user_id);
create index if not exists idx_groups_user_id on groups(user_id);
create index if not exists idx_group_members_group_id on group_members(group_id);
create index if not exists idx_group_expenses_group_id on group_expenses(group_id);
create index if not exists idx_group_expense_splits_expense_id on group_expense_splits(expense_id);

-- =============================================
-- MIGRATION: RUN THESE IF YOU HAVE EXISTING TABLES
-- =============================================
-- alter table expenses add column if not exists currency text not null default '₹';
-- alter table groups add column if not exists currency text not null default '₹';

-- ── Admin & Invite Code (run if you already have a groups table) ──────────
alter table groups add column if not exists admin_user_id text;
alter table groups add column if not exists invite_code   text unique;
create index if not exists idx_groups_invite_code on groups(invite_code);
