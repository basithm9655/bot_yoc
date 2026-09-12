import unittest
import os
import json
from app import app
from database import init_db, get_db_connection
from registration_service import (
    register_volunteer,
    get_all_registrations,
    delete_registration,
    generate_formatted_announcement,
    check_existing_registration,
    get_today_date_str
)

class TestManavarIllamBot(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config['TESTING'] = True
        cls.client = app.test_client()

    def setUp(self):
        # Reset DB before each test
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DROP TABLE IF EXISTS registrations")
        conn.commit()
        conn.close()
        init_db()

    def test_demo_data_seeding(self):
        regs = get_all_registrations()
        self.assertEqual(len(regs), 5)
        roll_numbers = [r['roll_number'] for r in regs]
        self.assertIn("24B224", roll_numbers)
        self.assertIn("24B243", roll_numbers)
        self.assertIn("24B249", roll_numbers)
        self.assertIn("24B248", roll_numbers)
        self.assertIn("25D202", roll_numbers)

    def test_duplicate_registration_prevention(self):
        today = get_today_date_str()
        # Try registering same roll number "24B224" again
        success, msg = register_volunteer("New Name", "24B224", "Third Year Hostel Girls", today)
        self.assertFalse(success)
        self.assertIn("already registered", msg)

    def test_valid_new_registration(self):
        today = get_today_date_str()
        success, res = register_volunteer("Ananya V", "24B300", "First Year Hostel Girls", today)
        self.assertTrue(success)
        self.assertEqual(res['roll_number'], "24B300")
        
        regs = get_all_registrations()
        self.assertEqual(len(regs), 6)

    def test_delete_registration(self):
        regs = get_all_registrations()
        first_id = regs[0]['id']
        deleted = delete_registration(first_id)
        self.assertTrue(deleted)
        
        remaining = get_all_registrations()
        self.assertEqual(len(remaining), 4)

    def test_announcement_generator_format(self):
        announcement = generate_formatted_announcement()
        self.assertIn("PSG College of Technology", announcement)
        self.assertIn("Youth Outreach Club - Manavar Illam Class", announcement)
        self.assertIn("📌 First Year Hostel Girls", announcement)
        self.assertIn("📌 Third Year Hostel Girls", announcement)
        self.assertIn("1. Kali Priya Dharshini - 24B224", announcement)
        self.assertIn("2. Rihasini - 24B243", announcement)

    def test_api_chat_flow(self):
        # Step 1: Welcome / Start
        res = self.client.post('/api/chat', json={'session_id': 'test_s1', 'message': ''})
        data = res.get_json()
        self.assertIn("Welcome to Manavar Illam", data['text'])
        
        # Select Option 1 (Register)
        res = self.client.post('/api/chat', json={'session_id': 'test_s1', 'message': '1'})
        data = res.get_json()
        self.assertIn("Step 1/3", data['text'])

        # Input Name
        res = self.client.post('/api/chat', json={'session_id': 'test_s1', 'message': 'Subash R'})
        data = res.get_json()
        self.assertIn("Step 2/3", data['text'])

        # Input Roll Number
        res = self.client.post('/api/chat', json={'session_id': 'test_s1', 'message': '25D999'})
        data = res.get_json()
        self.assertIn("Step 3/3", data['text'])

        # Select Category
        res = self.client.post('/api/chat', json={'session_id': 'test_s1', 'message': 'Boys'})
        data = res.get_json()
        self.assertIn("Confirm registration?", data['text'])

        # Confirm
        res = self.client.post('/api/chat', json={'session_id': 'test_s1', 'message': '✅ Confirm'})
        data = res.get_json()
        self.assertIn("Registration successful!", data['text'])

if __name__ == '__main__':
    unittest.main()
