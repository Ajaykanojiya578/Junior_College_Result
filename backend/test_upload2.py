import time
import requests  # type: ignore[import]
from openpyxl import Workbook  # type: ignore[import]
from openpyxl.worksheet.worksheet import Worksheet  # type: ignore[import]
import os

base = os.environ.get('TEST_BASE_URL', 'http://127.0.0.1:5000')

# wait for server to be available
def wait_for_server(url, timeout=10):
    start = time.time()
    while time.time() - start < timeout:
        try:
            r = requests.get(url)
            return True
        except Exception:
            time.sleep(0.5)
    return False

if not wait_for_server(base + '/'): 
    print('Server not responding at', base)
    raise SystemExit('server unavailable')

# login as teacher1 (with small retry on connection errors)
session = requests.Session()
for attempt in range(3):
    try:
        resp = session.post(base + '/auth/login', json={'userid': 'teacher1', 'password': 'pass1234'}, timeout=5)
        break
    except requests.exceptions.RequestException as ex:
        print('login attempt failed', attempt+1, ex)
        time.sleep(1)
else:
    raise SystemExit('login failed: cannot reach server')

print('login status', resp.status_code, resp.text)
if resp.status_code != 200:
    raise SystemExit('login failed')

token = resp.json().get('token')
session.headers.update({'Authorization': f'Bearer {token}'})

# create excel file
wb = Workbook()
# ensure ws is definitely a Worksheet for type checkers
ws = wb.active or wb.create_sheet()  # type: ignore[assignment]
ws.append(['roll_no', 'division'])
ws.append(['A-01', 'A'])
ws.append(['A-02', 'A'])
ws.append(['A-99', 'A'])  # non-existing row to test missing

fname = 'test_upload.xlsx'
wb.save(fname)

# upload using context manager to ensure file closed
with open(fname, 'rb') as fh:
    files = {'file': fh}
    r = session.post(base + '/teacher/marks/from-excel', files=files, timeout=30)
    print('upload status', r.status_code)
    print(r.text)

# cleanup
try:
    os.remove(fname)
except Exception:
    pass
