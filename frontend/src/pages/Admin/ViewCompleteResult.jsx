import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function AdminViewCompleteResult() {
  useAuth();
  const [divisions, setDivisions] = useState([]);
  const [division, setDivision] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rollInput, setRollInput] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    async function loadDivs() {
      try {
        const res = await api.get('/admin/divisions');
        setDivisions(res.data || []);
        if ((res.data || []).length > 0) setDivision(res.data[0]);
      } catch (err) {
        console.error(err);
      }
    }
    loadDivs();
  }, []);

  useEffect(() => {
    if (!division) return;
    loadDivisionResults({ division });
  }, [division]);

  async function loadDivisionResults({ division: d, roll_no } = {}) {
    setLoading(true);
    try {
      const params = {};
      if (d) params.division = d;
      if (roll_no) params.roll_no = roll_no;
      const res = await api.get('/admin/results', { params });
      const data = res.data || [];
      if (Array.isArray(data)) {
        setRows(data);
        setSelectedStudent(data[0] || null);
      } else if (data && typeof data === 'object') {
        setRows([data]);
        setSelectedStudent(data);
      } else {
        setRows([]);
        setSelectedStudent(null);
      }
    } catch (err) {
      console.error(err);
      setRows([]);
      setSelectedStudent(null);
    } finally {
      setLoading(false);
    }
  }

  const selectedRow = rows.find(r => r.roll_no === selectedStudent?.roll_no) || rows[0] || null;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, color: '#2c3e50' }}>School Results</h2>
          <div style={{ fontSize: 12, color: '#666' }}>Official Marksheet</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, color: '#2c3e50' }}>View Complete Result (Admin)</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 20, marginBottom: 20, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontWeight: 600 }}>Division</label>
          <select value={division} onChange={e => setDivision(e.target.value)} style={{ minWidth: 180 }}>
            <option value="">-- Select division --</option>
            {divisions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontWeight: 200 }}>Roll No</label>
          <div style={{ display: 'flex', gap: 12 }}>
            <input value={rollInput} onChange={e => setRollInput(e.target.value)} placeholder="Enter roll number" style={{ minWidth: 180, padding: '8px', height: 5 }} />
            <button onClick={() => {
              if (!division) return alert('Please select a Division before searching');
              if (!rollInput) return alert('Please enter a Roll Number');
              loadDivisionResults({ division, roll_no: rollInput });
            }} 
            style={{ padding: '6px 10px', height: 30 }}>Search</button>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 8, color: '#444' }}>
        <div style={{ marginBottom: 6, fontWeight: 600 }}>Admin Excel export</div>
        <div style={{ fontSize: 13, color: '#555' }}>
          The admin Excel aggregates marks from all teachers into the shared format: Roll, Student Name, Subject, Division, Unit1, Term, Unit2, Annual, Grace. Downloading the Excel will generate a snapshot for the selected division or individual student.
        </div>
      </div>

      {loading && <div>Loading...</div>}

      {!loading && rows.length === 0 && (
        <div style={{ color: '#666' }}>No results available for selected query.</div>
      )}

      {!loading && selectedRow && (
        <div style={{ marginTop: 16, border: '1px solid #e6e9ee', padding: 16, borderRadius: 6, background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: 0 }}>{selectedRow.name}</h3>
              <div style={{ color: '#666' }}>Roll: <strong>{selectedRow.roll_no}</strong> &nbsp;|&nbsp; Division: <strong>{selectedRow.division}</strong></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#2c3e50' }}>Final Total</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#d35400' }}>{selectedRow.final_total ?? '-'}</div>
              <div style={{ marginTop: 6, fontSize: 14 }}>Percentage: <span style={{ fontWeight: 800, color: '#2980b9' }}>{selectedRow.percentage ?? '-'}</span></div>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
            <thead>
              <tr style={{ background: '#f2f6fb' }}>
                <th style={{ textAlign: 'left', padding: 10, color: '#2c3e50' }}>Subject</th>
                <th style={{ textAlign: 'right', padding: 10, color: '#2c3e50' }}>Marks (Annual)</th>
                <th style={{ textAlign: 'right', padding: 10, color: '#2c3e50' }}>Grace</th>
                <th style={{ textAlign: 'right', padding: 10, color: '#2c3e50' }}>Final</th>
              </tr>
            </thead>
            <tbody>
              {selectedRow.subjects.map(s => (
                <tr key={s.code} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: 10 }}>{s.code}</td>
                  {/* Grade-only subjects will have a `grade` field */}
                    <td style={{ padding: 10, textAlign: 'right' }}>{s.grade ? s.grade : (s.avg ?? '-')}</td>
                    <td style={{ padding: 10, textAlign: 'right', color: s.grace ? '#c0392b' : '#666', fontWeight: s.grace ? 700 : 400 }}>{s.grade ? '-' : s.grace}</td>
                    <td style={{ padding: 10, textAlign: 'right', fontWeight: 800 }}>{s.grade ? '-' : (s.final ?? '-')}</td>
                </tr>
              ))}
            </tbody>
          </table>

            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button onClick={() => setShowDetails(d => !d)} style={{ padding: '8px 10px' }}>{showDetails ? 'Hide' : 'Show'} Detailed Marks</button>
              <button onClick={async () => {
                if (!division && !selectedRow) return alert('No student or division selected');
                try {
                  const params = {};
                  if (division) params.division = division;
                  if (selectedRow && rows.length === 1) params.roll_no = selectedRow.roll_no;
                  const res = await api.get('/admin/excel/marksheet', { params, responseType: 'blob' });
                  const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  let filename = 'complete_results';
                  if (division) filename += `_${division}`;
                  if (selectedRow && rows.length === 1) filename += `_roll_${selectedRow.roll_no}`;
                  filename += '.xlsx';
                  a.download = filename;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  window.URL.revokeObjectURL(url);
                } catch (err) {
                  console.error(err);
                  alert(err.response?.data?.error || err.message || 'Failed to download Excel');
                }
              }} style={{ padding: '8px 10px' }}>Link to Excel</button>
            </div>

            {showDetails && (
              <div style={{ marginTop: 12 }}>
                <h4>Detailed Marks</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={{ padding: 8, textAlign: 'left' }}>Subject</th>
                      <th style={{ padding: 8, textAlign: 'right' }}>Unit1</th>
                      <th style={{ padding: 8, textAlign: 'right' }}>Unit2</th>
                      <th style={{ padding: 8, textAlign: 'right' }}>Terminal</th>
                      <th style={{ padding: 8, textAlign: 'right' }}>Annual</th>
                      <th style={{ padding: 8, textAlign: 'right' }}>Grace</th>
                      <th style={{ padding: 8, textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRow.subjects.map(s => (
                      <tr key={`detail-${s.code}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: 8 }}>{s.code}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{s.mark?.unit1 ?? '-'}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{s.mark?.unit2 ?? '-'}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{s.mark?.term ?? '-'}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{s.mark?.annual ?? '-'}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{s.mark?.grace ?? '-'}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{s.mark?.tot ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800 }}>Grade: <span style={{ color: '#27ae60' }}>{gradeFor(selectedRow.percentage)}</span></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {selectedRow.percentage == null ? (
                <div style={{ fontWeight: 700, color: '#9ca3af' }}>INCOMPLETE</div>
              ) : (
                <div style={{ fontWeight: 900, color: selectedRow.percentage >= 35 ? '#27ae60' : '#c0392b' }}>{selectedRow.percentage >= 35 ? 'PASS' : 'FAIL'}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && rows.length > 1 && (
        <div style={{ marginTop: 12 }}>
          <h4>Division Students</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                <th style={{ padding: 8, textAlign: 'left' }}>Roll</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Name</th>
                <th style={{ padding: 8, textAlign: 'right' }}>Final Total</th>
                <th style={{ padding: 8, textAlign: 'right' }}>Percentage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.roll_no} onClick={() => setSelectedStudent(r)} style={{ cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: 8 }}>{r.roll_no}</td>
                  <td style={{ padding: 8 }}>{r.name}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{r.final_total ?? '-'}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{r.percentage ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function gradeFor(p) {
  if (p == null) return '-';
  const n = Number(p);
  if (Number.isNaN(n)) return '-';
  if (n >= 75) return 'A+';
  if (n >= 60) return 'A';
  if (n >= 50) return 'B';
  if (n >= 35) return 'C';
  return 'F';
}
