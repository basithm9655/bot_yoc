from datetime import datetime
from database import get_db_connection

CATEGORIES = [
    "First Year Hostel Girls",
    "Second Year Hostel Girls",
    "Third Year Hostel Girls",
    "Fourth Year Hostel Girls",
    "Day Scholar Girls",
    "Boys"
]

def get_today_date_str():
    return datetime.now().strftime("%Y-%m-%d")

def check_existing_registration(roll_number, date_str=None):
    if not date_str:
        date_str = get_today_date_str()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM registrations 
        WHERE LOWER(roll_number) = LOWER(?) AND date = ?
    ''', (roll_number.strip(), date_str))
    record = cursor.fetchone()
    conn.close()
    return record

def register_volunteer(name, roll_number, category, date_str=None):
    if not date_str:
        date_str = get_today_date_str()
    
    name = name.strip()
    roll_number = roll_number.strip().upper()
    category = category.strip()
    
    if not name:
        return False, "Name cannot be empty."
    if not roll_number:
        return False, "Roll number cannot be empty."
    if category not in CATEGORIES:
        return False, f"Invalid category. Must be one of: {', '.join(CATEGORIES)}"
    
    # Check duplicate for today
    existing = check_existing_registration(roll_number, date_str)
    if existing:
        return False, f"Roll number '{roll_number}' is already registered for today's class ({existing['name']})."
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO registrations (name, roll_number, category, date)
        VALUES (?, ?, ?, ?)
    ''', (name, roll_number, category, date_str))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    
    return True, {
        "id": new_id,
        "name": name,
        "roll_number": roll_number,
        "category": category,
        "date": date_str
    }

def get_all_registrations(date_str=None, category_filter=None):
    if not date_str:
        date_str = get_today_date_str()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM registrations WHERE date = ?"
    params = [date_str]
    
    if category_filter and category_filter != "All":
        query += " AND category = ?"
        params.append(category_filter)
        
    query += " ORDER BY category ASC, id ASC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def delete_registration(registration_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM registrations WHERE id = ?", (registration_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def generate_formatted_announcement(date_str=None):
    if not date_str:
        date_str = get_today_date_str()
        
    # Format date for display: DD/MM/YYYY
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        formatted_date = dt.strftime("%d/%m/%Y")
    except ValueError:
        formatted_date = date_str

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name, roll_number, category FROM registrations WHERE date = ? ORDER BY id ASC", (date_str,))
    rows = cursor.fetchall()
    conn.close()

    # Group by category preserving exact order
    category_map = {cat: [] for cat in CATEGORIES}
    for row in rows:
        cat = row["category"]
        if cat in category_map:
            category_map[cat].append(f"{row['name']} - {row['roll_number']}")

    output_lines = [
        "PSG College of Technology",
        "",
        "Youth Outreach Club - Manavar Illam Class",
        "",
        f"Date: {formatted_date}",
        ""
    ]

    for cat in CATEGORIES:
        output_lines.append(f"📌 {cat}")
        volunteers = category_map[cat]
        if volunteers:
            for idx, vol in enumerate(volunteers, start=1):
                output_lines.append(f"{idx}. {vol}")
        else:
            output_lines.append("1.")
        output_lines.append("")

    return "\n".join(output_lines).strip()


# Chatbot State Machine for session simulation
class ChatbotEngine:
    def __init__(self):
        # Memory storage for active session states
        self.sessions = {}

    def get_session(self, session_id):
        if session_id not in self.sessions:
            self.sessions[session_id] = {
                "state": "INIT",
                "data": {}
            }
        return self.sessions[session_id]

    def reset_session(self, session_id):
        self.sessions[session_id] = {
            "state": "INIT",
            "data": {}
        }

    def process_message(self, session_id, message_text):
        session = self.get_session(session_id)
        state = session["state"]
        data = session["data"]
        text = message_text.strip()

        # Global command: restart / cancel / menu
        if text.lower() in ["restart", "cancel", "menu", "0", "reset"]:
            self.reset_session(session_id)
            return self._build_welcome_response()

        if state == "INIT":
            if text == "1" or "register" in text.lower():
                session["state"] = "AWAITING_NAME"
                return {
                    "text": "Step 1/3:\nPlease enter your name:",
                    "options": [],
                    "show_cancel": True
                }
            elif text == "2" or "view" in text.lower():
                today_regs = get_all_registrations()
                if not today_regs:
                    msg = "📋 Today's Manavar Illam Volunteer List:\n\nNo volunteers registered yet for today."
                else:
                    msg = f"📋 Today's Manavar Illam Volunteer List ({len(today_regs)} Total):\n\n"
                    for idx, reg in enumerate(today_regs, start=1):
                        msg += f"{idx}. {reg['name']} ({reg['roll_number']}) - {reg['category']}\n"
                
                return {
                    "text": msg + "\nWhat would you like to do next?",
                    "options": ["Register for today's class", "View today's volunteers"],
                    "show_cancel": False
                }
            else:
                return self._build_welcome_response()

        elif state == "AWAITING_NAME":
            if not text:
                return {
                    "text": "⚠️ Name cannot be empty.\nPlease enter your name:",
                    "options": [],
                    "show_cancel": True
                }
            data["name"] = text
            session["state"] = "AWAITING_ROLL"
            return {
                "text": f"Hello {text}! 👋\n\nStep 2/3:\nPlease enter your roll number:",
                "options": [],
                "show_cancel": True
            }

        elif state == "AWAITING_ROLL":
            roll = text.upper()
            if not roll:
                return {
                    "text": "⚠️ Roll number cannot be empty.\nPlease enter your roll number:",
                    "options": [],
                    "show_cancel": True
                }
            
            # Check duplicate
            existing = check_existing_registration(roll)
            if existing:
                return {
                    "text": f"⚠️ Roll number '{roll}' is already registered for today's class ({existing['name']}).\n\nYou cannot register twice on the same day.",
                    "options": ["Register with different roll number", "View today's volunteers", "Main Menu"],
                    "show_cancel": True
                }
                
            data["roll_number"] = roll
            session["state"] = "AWAITING_CATEGORY"
            return {
                "text": f"Roll No: {roll}\n\nStep 3/3:\nSelect your category:",
                "options": CATEGORIES,
                "show_cancel": True
            }

        elif state == "AWAITING_CATEGORY":
            if text not in CATEGORIES:
                # Try index matching if user typed a number
                try:
                    idx = int(text) - 1
                    if 0 <= idx < len(CATEGORIES):
                        text = CATEGORIES[idx]
                except ValueError:
                    pass

            if text not in CATEGORIES:
                return {
                    "text": "⚠️ Please select a valid category from the list:",
                    "options": CATEGORIES,
                    "show_cancel": True
                }

            data["category"] = text
            session["state"] = "AWAITING_CONFIRMATION"
            
            summary = (
                "Please confirm your details:\n\n"
                f"👤 Name: {data['name']}\n"
                f"🆔 Roll No: {data['roll_number']}\n"
                f"🏷️ Category: {data['category']}\n"
                "⏰ Time: 5:15 PM - 6:45 PM\n\n"
                "Confirm registration?"
            )
            return {
                "text": summary,
                "options": ["✅ Confirm", "❌ Cancel"],
                "show_cancel": False,
                "is_confirmation": True
            }

        elif state == "AWAITING_CONFIRMATION":
            if "confirm" in text.lower() or "✅" in text or text == "1":
                success, result = register_volunteer(data["name"], data["roll_number"], data["category"])
                self.reset_session(session_id)
                
                if success:
                    return {
                        "text": (
                            "✅ Registration successful!\n"
                            "You have been added to today's Manavar Illam volunteer list.\n\n"
                            "Thank you for serving with PSG Tech Youth Outreach Club! 🙏"
                        ),
                        "options": ["Register another volunteer", "View today's volunteers"],
                        "show_cancel": False
                    }
                else:
                    return {
                        "text": f"❌ Registration failed:\n{result}",
                        "options": ["Main Menu"],
                        "show_cancel": False
                    }
            else:
                self.reset_session(session_id)
                return {
                    "text": "❌ Registration cancelled.",
                    "options": ["1. Register for today's class", "2. View today's volunteers"],
                    "show_cancel": False
                }

    def _build_welcome_response(self):
        return {
            "text": "👋 Welcome to Manavar Illam Volunteer Registration!\n\nPlease select an option:",
            "options": ["1. Register for today's class", "2. View today's volunteers"],
            "show_cancel": False
        }

bot_engine = ChatbotEngine()
