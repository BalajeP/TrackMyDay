# Supabase Database Setup Instructions

Your app now uses **Supabase Database** for permanent data storage instead of localStorage. This means your data will:

✅ Persist across page refreshes
✅ Persist across logout/login  
✅ Persist across different browsers
✅ Persist across different devices
✅ Never be cleared by the browser

## Step 1: Run Database Migration

You need to create the `user_data` table in your Supabase database.

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/onokcdrlwhmdqtpfsqyc
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New Query"**
4. Copy the ENTIRE contents of `/supabase/migrations/001_create_user_data_table.sql`
5. Paste it into the SQL editor
6. Click **"Run"** button
7. You should see: "Success. No rows returned"

### Option B: Using Supabase CLI (Advanced)

```bash
# If you have Supabase CLI installed
supabase db push
```

## Step 2: Verify the Table Was Created

1. In Supabase Dashboard, go to **"Table Editor"**
2. You should see a new table called **"user_data"**
3. Click on it to verify these columns exist:
   - `id` (UUID)
   - `user_id` (UUID)
   - `data_key` (TEXT)
   - `data_value` (JSONB)
   - `created_at` (TIMESTAMP)
   - `updated_at` (TIMESTAMP)

## Step 3: Test Your App

1. **Refresh your browser**
2. **Login** to your account
3. **Add some data** (activities, meals, etc.)
4. **Click "Save Activities"** (or respective save button)
5. **Check console** - you should see:
   ```
   ✓ [activities] SAVED to Supabase database
   ✓ [activities] VERIFIED: Data exists in database
   ```
6. **Logout** completely
7. **Login again** - your data should still be there!
8. **Refresh the page** - data persists!

## Step 4: View Your Data in Supabase

1. Go to **Table Editor** → **user_data**
2. You should see rows with your data
3. Each row has:
   - Your user_id
   - data_key (e.g., "activities", "meals_plan")
   - data_value (JSON containing your actual data)

## Security (Row Level Security)

The table has **Row Level Security (RLS)** enabled, which means:
- ✅ Users can ONLY see their own data
- ✅ Users can ONLY modify their own data
- ❌ Users CANNOT see other users' data
- ❌ Users CANNOT modify other users' data

This is enforced at the database level, so it's completely secure!

## Troubleshooting

### "relation 'user_data' does not exist"
- You haven't run the migration SQL yet
- Go back to Step 1

### "permission denied for table user_data"
- RLS policies might not be created
- Re-run the entire migration SQL

### Data not saving
- Open browser console (F12)
- Look for errors in red
- Check if you see "SAVED to Supabase database"

### Data not loading after refresh
- Check console for "Loaded from Supabase database"
- Verify the table has data in Supabase Dashboard
- Make sure you're logged in with the same account

## Migration from localStorage

If you had data in localStorage before, it will NOT automatically migrate to the database. You'll need to:
1. Save new data using the "Save" buttons
2. Old localStorage data will remain in your browser but won't be used

To clear old localStorage data (optional):
```javascript
// Open browser console and run:
localStorage.clear()
```
