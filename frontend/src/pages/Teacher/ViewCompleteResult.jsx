import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function ViewCompleteResult() {
  useAuth();
  const [divisions] = useState(['A','B','C']);
  const [division, setDivision] = useState('A');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    async function loadStudents() {
      setLoading(true);
      try {
        // reuse teacher complete-table and then extract student list for student dropdown
        const res = await api.get('/teacher/complete-table', { params: { division } });
        setRows(res.data || []);
        setStudents((res.data || []).map(r => ({ roll_no: r.roll_no, name: r.name })));
      } catch (err) {
        console.error(err);
        setStudents([]);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }
    loadStudents();
  }, [division]);

  const selectedRow = rows.find(r => r.roll_no === selectedStudent?.roll_no);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, color: '#2c3e50' }}>Springfield High School</h2>
          <div style={{ fontSize: 12, color: '#666' }}>Official Marksheet</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, color: '#2c3e50' }}>View Complete Result</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ fontWeight: 600 }}>Division</label><br/>
          <select value={division} onChange={e => setDivision(e.target.value)}>
            {divisions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div>
          <label style={{ fontWeight: 600 }}>Student</label><br/>
          <select value={selectedStudent?.roll_no || ''} onChange={e => {
            const rn = e.target.value;
            const s = students.find(x => x.roll_no === rn);
            setSelectedStudent(s || null);
          }}>
            <option value="">-- Select student --</option>
            {students.map(s => (
              <option key={s.roll_no} value={s.roll_no}>{s.roll_no} — {s.name}</option>
            ))}
          </select>
        </div>
      </div>
      {loading && <div style={{ marginTop: 12 }}>Loading...</div>}

      {!selectedRow && <div style={{ color: '#666', marginTop: 12 }}>Select a student to view the complete marksheet.</div>}

      {/* If result generation hasn't produced a final total yet, inform the teacher */}
      {selectedRow && selectedRow.final_total == null && (
        <div style={{ color: '#c0392b', marginTop: 12, fontWeight: 700 }}>
          Complete marks not yet available. Final marksheet appears after all allocated subject teachers submit their marks.
        </div>
      )}

      {selectedRow && selectedRow.final_total != null && (
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
                <th style={{ textAlign: 'right', padding: 10, color: '#2c3e50' }}>Marks (Avg)</th>
                <th style={{ textAlign: 'right', padding: 10, color: '#2c3e50' }}>Grace</th>
                <th style={{ textAlign: 'right', padding: 10, color: '#2c3e50' }}>Final</th>
              </tr>
            </thead>
            <tbody>
              {selectedRow.subjects.map(s => (
                <tr key={s.code} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: 10 }}>{s.code}</td>
                  <td style={{ padding: 10, textAlign: 'right' }}>{s.avg ?? '-'}</td>
                  <td style={{ padding: 10, textAlign: 'right', color: s.grace ? '#c0392b' : '#666', fontWeight: s.grace ? 700 : 400 }}>{s.grace}</td>
                  <td style={{ padding: 10, textAlign: 'right', fontWeight: 800 }}>{s.final ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800 }}>Grade: <span style={{ color: '#27ae60' }}>{gradeFor(selectedRow.percentage)}</span></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 900, color: selectedRow.percentage >= 35 ? '#27ae60' : '#c0392b' }}>{selectedRow.percentage >= 35 ? 'PASS' : 'FAIL'}</div>
            </div>
          </div>
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
