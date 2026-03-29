# 🚀 Deployment Guide - Attendance Prediction Dashboard

Your app is now connected to **Supabase** with real-time sync and authentication. Here's how to deploy it:

---

## **Part 1: Create Database Tables** ✅

Go to Supabase Dashboard → **SQL Editor** → Run this:

```sql
-- Drop table if exists (start fresh)
DROP TABLE IF EXISTS attendance_entries CASCADE;

-- Create attendance_entries table
CREATE TABLE attendance_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date TEXT NOT NULL,
  attendance INTEGER NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  week INTEGER NOT NULL,
  lag1 FLOAT NOT NULL DEFAULT 0,
  lag4 FLOAT NOT NULL DEFAULT 0,
  roll4 FLOAT NOT NULL DEFAULT 0,
  delta1 FLOAT NOT NULL DEFAULT 0,
  delta4 FLOAT NOT NULL DEFAULT 0,
  is_summer INTEGER NOT NULL DEFAULT 0,
  is_holiday_season INTEGER NOT NULL DEFAULT 0,
  church_event TEXT NOT NULL DEFAULT 'None',
  is_fast_sunday INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_attendance_date ON attendance_entries(date);

-- Verify tables
SELECT * FROM attendance_entries LIMIT 1;
```

**Important**: Make sure your CSV dates are in **YYYY-MM-DD** format (e.g., `2024-01-07` not `2024/01/07`)

---

## **Fix Your CSV Date Format** 📅

If your CSV has dates like `2024/01/07`, convert them to `2024-01-07`:

### Option A: Quick Fix (Recommended)
1. Open CSV in Excel
2. Create new column with formula: `=TEXT(A2,"YYYY-MM-DD")` 
3. Replace old date column
4. Save as CSV

### Option B: Use Find & Replace (Google Sheets)
1. Open in Google Sheets
2. **Edit** → **Find and replace**
3. Find: `/` Replace with: `-`
4. Click **Replace all**
5. Download as CSV

Then import the corrected CSV to Supabase.

---

Go to Supabase Dashboard → **Authentication** → **Policies**

### Create policy for `attendance_entries`:
```sql
-- Enable RLS
ALTER TABLE attendance_entries ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see all entries (shared data)
CREATE POLICY "Enable read access for authenticated users" ON attendance_entries
FOR SELECT USING (auth.role() = 'authenticated_user');

-- Policy: Users can insert their own entries
CREATE POLICY "Enable insert for authenticated users" ON attendance_entries
FOR INSERT WITH CHECK (auth.role() = 'authenticated_user');
```

---

## **Part 3: Deploy to Vercel (Free)** 🌐

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit - Supabase integration"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/attendance-dashboard.git
git push -u origin main
```

### Step 2: Deploy on Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click **New Project**
3. Import your GitHub repo
4. Add environment variables:
   - `VITE_SUPABASE_URL` → Your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` → Your Supabase anon key
5. Click **Deploy**

✨ Your app is now live! Share the URL with your team.

---

## **Part 4: How Users Access It** 👥

### First Time User:
1. Visit your Vercel URL
2. Click **Sign Up**
3. Enter email & password
4. Confirm email in inbox
5. Sign in
6. Add attendance data → All users see it in real-time

### Key Features:
- ✅ All data syncs instantly across all users
- ✅ Login required (private & secure)
- ✅ AI model retrains with each new entry
- ✅ 24/7 availability

---

## **Part 5: Local Development** 💻

To continue developing locally:

```bash
npm run dev
```

Your `.env.local` is already set up with Supabase credentials.

---

## **Troubleshooting**

### "Connection refused" error?
- Check `.env.local` has correct Supabase credentials
- Verify Supabase project is active

### Data not syncing?
- Check browser console for errors
- Verify RLS policies are enabled
- Refresh the page

### Can't sign up?
- Make sure email is confirmed in Supabase
- Check spam folder

---

## **Need Help?**
1. Check Supabase logs: Dashboard → **Logs** → **API**
2. Check browser console: F12 → **Console** tab
3. Vercel logs: Project → **Deployments** → Click latest → **View logs**

---

**You're all set! The app is ready for your team.** 🎉
