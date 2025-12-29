from app import create_app
from werkzeug.security import generate_password_hash
import json

app = create_app()
with app.app_context():
    client = app.test_client()
    from models import Admin
    from app import db

    admin = Admin.query.filter_by(username='admin').first()
    if not admin:
        admin = Admin()
        admin.username = 'admin'
        admin.password_hash = generate_password_hash('admin123')
        admin.active = True
        db.session.add(admin)
        db.session.commit()
        print('Created default admin')

    res = client.post('/admin/login', json={'userid': 'admin', 'password': 'admin123'})
    print('admin login status', res.status_code, res.get_data(as_text=True))
    if res.status_code != 200:
        raise SystemExit('admin login failed')
    token = res.get_json().get('token')
    headers = {'Authorization': f'Bearer {token}'}

    # Fetch divisions
    resd = client.get('/admin/divisions', headers=headers)
    print('divisions status', resd.status_code, resd.get_data(as_text=True))
    # Fetch results for division A (if present)
    res2 = client.get('/admin/results', headers=headers, query_string={'division': 'A'})
    print('results (division A) status', res2.status_code)
    data = res2.get_json()
    print(json.dumps(data, indent=2))
