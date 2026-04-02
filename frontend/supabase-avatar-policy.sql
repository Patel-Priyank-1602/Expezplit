-- Allow members to update their own avatar entries
create policy "Users can update group members"
  on group_members for update using (true);
