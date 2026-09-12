import sqlite3
import os
from datetime import datetime

DB_FILE = os.path.join(os.path.dirname(__file__), "manavar_illam.db")

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create registrations table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS registrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            roll_number TEXT NOT NULL,
            category TEXT NOT NULL,
            date TEXT NOT NULL,
            registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    
    # Seed demo data if table is currently empty
    cursor.execute('SELECT COUNT(*) FROM registrations')
    count = cursor.fetchone()[0]
    
    if count == 0:
        today = datetime.now().strftime("%Y-%m-%d")
        demo_data = [
            ("Kali Priya Dharshini", "24B224", "Third Year Hostel Girls", today),
            ("Rihasini", "24B243", "Third Year Hostel Girls", today),
            ("Sakira Anjum S", "24B249", "Day Scholar Girls", today),
            ("Sahana S", "24B248", "Day Scholar Girls", today),
            ("AKHEL M S", "25D202", "Boys", today),
        ]
        
        cursor.executemany('''
            INSERT INTO registrations (name, roll_number, category, date)
            VALUES (?, ?, ?, ?)
        ''', demo_data)
        
        conn.commit()
        print(f"Database initialized with {len(demo_data)} demo registrations for {today}.")
    
    conn.close()

if __name__ == "__main__":
    init_db()
