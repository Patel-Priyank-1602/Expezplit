-- Support avatars for group members
alter table group_members add column if not exists avatar_url text;
