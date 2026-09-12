import csv
import io
from flask import Flask, render_template, request, jsonify, Response
from database import init_db
from registration_service import (
    bot_engine,
    get_all_registrations,
    delete_registration,
    generate_formatted_announcement,
    get_today_date_str,
    CATEGORIES
)

app = Flask(__name__)

# Initialize DB on startup
with app.app_context():
    init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def api_chat():
    data = request.get_json() or {}
    session_id = data.get('session_id', 'default_session')
    message = data.get('message', '')
    
    response = bot_engine.process_message(session_id, message)
    return jsonify(response)

@app.route('/api/registrations', methods=['GET'])
def api_registrations():
    date_str = request.args.get('date', get_today_date_str())
    category = request.args.get('category', 'All')
    
    registrations = get_all_registrations(date_str, category)
    all_today = get_all_registrations(date_str, 'All')
    
    # Calculate category counts
    counts = {cat: 0 for cat in CATEGORIES}
    for r in all_today:
        if r['category'] in counts:
            counts[r['category']] += 1
            
    return jsonify({
        'date': date_str,
        'total': len(all_today),
        'registrations': registrations,
        'category_counts': counts,
        'categories': CATEGORIES
    })

@app.route('/api/registrations/<int:reg_id>', methods=['DELETE'])
def api_delete_registration(reg_id):
    success = delete_registration(reg_id)
    if success:
        return jsonify({'status': 'success', 'message': f'Registration {reg_id} removed successfully.'})
    return jsonify({'status': 'error', 'message': 'Registration not found.'}), 440

@app.route('/api/announcement', methods=['GET'])
def api_announcement():
    date_str = request.args.get('date', get_today_date_str())
    text = generate_formatted_announcement(date_str)
    return jsonify({'date': date_str, 'announcement': text})

@app.route('/api/export-csv', methods=['GET'])
def api_export_csv():
    date_str = request.args.get('date', get_today_date_str())
    registrations = get_all_registrations(date_str, 'All')
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'S.No', 'Name', 'Roll Number', 'Category', 'Date', 'Registered At'])
    
    for idx, reg in enumerate(registrations, start=1):
        writer.writerow([
            reg['id'],
            idx,
            reg['name'],
            reg['roll_number'],
            reg['category'],
            reg['date'],
            reg['registered_at']
        ])
    
    output.seek(0)
    filename = f"manavar_illam_volunteers_{date_str}.csv"
    
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-disposition": f"attachment; filename={filename}"}
    )

@app.route('/api/reset-demo', methods=['POST'])
def api_reset_demo():
    import sqlite3
    from database import get_db_connection
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DROP TABLE IF EXISTS registrations")
    conn.commit()
    conn.close()
    
    init_db()
    return jsonify({'status': 'success', 'message': 'Demo data reset successfully.'})

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
