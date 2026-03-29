#!/usr/bin/env python3
"""
Fix CASTA_data.csv date format for Supabase import
Converts dates from M/D/YYYY to YYYY-MM-DD format
"""

import csv
from datetime import datetime

input_file = 'src/imports/CASTA_data.csv'
output_file = 'src/imports/CASTA_data_fixed.csv'

# Read and convert
rows = []
with open(input_file, 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        # Convert date from M/D/YYYY to YYYY-MM-DD
        date_str = row['Date']
        try:
            date_obj = datetime.strptime(date_str, '%m/%d/%Y')
            row['Date'] = date_obj.strftime('%Y-%m-%d')
            
            # Convert decimal columns to integers
            row['Year'] = int(float(row['Year']))
            row['Month'] = int(float(row['Month']))
            row['Week'] = int(float(row['Week']))
            row['Attendance'] = int(float(row['Attendance']))
            
            # Convert float fields, keeping decimals
            row['Lag1'] = float(row['Lag1'])
            row['Lag4'] = float(row['Lag4'])
            row['Roll4'] = float(row['Roll4'])
            row['Delta1'] = float(row['Delta1'])
            row['Delta4'] = float(row['Delta4'])
            row['IsSummer'] = int(float(row['IsSummer']))
            row['IsHolidaySeason'] = int(float(row['IsHolidaySeason']))
            row['IsFastSunday'] = int(float(row['IsFastSunday']))
            
            rows.append(row)
        except Exception as e:
            print(f"Error processing row: {row} - {e}")
            continue

# Write fixed file
if rows:
    with open(output_file, 'w', newline='') as f:
        fieldnames = list(rows[0].keys())
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    
    print(f"✅ Success! Fixed file saved to: {output_file}")
    print(f"   Converted {len(rows)} rows")
    print(f"\n📋 Next steps:")
    print(f"   1. In Supabase, go to SQL Editor")
    print(f"   2. Run the table creation SQL from DEPLOYMENT_GUIDE.md")
    print(f"   3. Then import this fixed CSV: {output_file}")
else:
    print("❌ No rows to process")
