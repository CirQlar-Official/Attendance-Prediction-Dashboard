#!/usr/bin/env python3
"""
Fix CASTA_data_fixed.csv headers to match Supabase table columns
"""

import csv

input_file = 'src/imports/CASTA_data_fixed.csv'
output_file = 'src/imports/CASTA_data_fixed.csv'

# Read and convert
rows = []
with open(input_file, 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        # Skip empty first column, map to correct column names
        new_row = {
            'date': row['Date'],
            'attendance': int(float(row['Attendance'])),
            'year': int(float(row['Year'])),
            'month': int(float(row['Month'])),
            'week': int(float(row['Week'])),
            'lag1': float(row['Lag1']),
            'lag4': float(row['Lag4']),
            'roll4': float(row['Roll4']),
            'delta1': float(row['Delta1']),
            'delta4': float(row['Delta4']),
            'is_summer': int(float(row['IsSummer'])),
            'is_holiday_season': int(float(row['IsHolidaySeason'])),
            'church_event': row['ChurchEvent'],
            'is_fast_sunday': int(float(row['IsFastSunday'])),
        }
        rows.append(new_row)

# Write fixed file with correct headers
if rows:
    with open(output_file, 'w', newline='') as f:
        fieldnames = ['date', 'attendance', 'year', 'month', 'week', 'lag1', 'lag4', 'roll4', 'delta1', 'delta4', 'is_summer', 'is_holiday_season', 'church_event', 'is_fast_sunday']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    
    print(f"✅ Fixed! Column headers now match Supabase table")
    print(f"   Converted {len(rows)} rows")
    print(f"\n📋 Next steps:")
    print(f"   1. In Supabase Table Editor → attendance_entries")
    print(f"   2. Click Insert → Import CSV")
    print(f"   3. Select: {output_file}")
else:
    print("❌ No rows to process")
