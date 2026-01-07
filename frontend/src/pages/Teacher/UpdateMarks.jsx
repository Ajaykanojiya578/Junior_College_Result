// src/pages/Teacher/UpdateMarks.jsx
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useRef } from "react";
import * as XLSX from 'xlsx';
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useLocation } from 'react-router-dom';

export default function UpdateMarks() {
  useAuth();
  const [allocations, setAllocations] = useState([]); // allocations contain subject+division pairs
  const [division, setDivision] = useState("");
  const [students, setStudents] = useState([]);
  const [studentRoll, setStudentRoll] = useState("");
  const [subjects, setSubjects] = useState([]); // subject rows for selected student (filtered to chosen subject)
  const [editing, setEditing] = useState({}); // map subject_id -> values
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    async function loadAllocations() {
      try {
        const res = await api.get("/auth/me");
        const alloc = res.data.allocations || [];
        setAllocations(alloc);
            if (alloc.length > 0) {
              // default to first allocation
              setDivision(alloc[0].division);
              setChosenSubjectId(alloc[0].subject_id);
              setChosenSubjectCode(alloc[0].subject_code);
            }
      } catch (err) {
        console.error(err);
      }
    }
    loadAllocations();
  }, []);

  const [chosenSubjectId, setChosenSubjectId] = useState(null);
  const [chosenSubjectCode, setChosenSubjectCode] = useState(null);
  const [rows, setRows] = useState([]); // student rows for bulk entry
  const [excelRows, setExcelRows] = useState([]);
  const [linkedToExcel, setLinkedToExcel] = useState(false);
  const [missingRows, setMissingRows] = useState([]);
  const [excelSimpleMode, setExcelSimpleMode] = useState(false);
  const fileInputRef = useRef(null);
  const location = useLocation();

  // Students are loaded on explicit Search (handleFetchStudents) or via Excel upload.
  // Removing automatic fetch here to avoid unexpected network calls when changing selection.

  // read subject_id from query param when navigating from dashboard
  useEffect(() => {
    const qp = new URLSearchParams(location.search);
    const sid = qp.get('subject_id');
    const divq = qp.get('division');
    if (sid) {
      setChosenSubjectId(sid);
      const alloc = allocations.find(a => String(a.subject_id) === String(sid));
      if (alloc) setChosenSubjectCode(alloc.subject_code);
    }
    if (divq) setDivision(divq);
  }, [location.search, allocations]);

  const handleFetchStudents = async (roll_no = '') => {
    if (!chosenSubjectId || !division) return alert('Select subject and division');
    setLoading(true);
    try {
      const res = await api.get('/teacher/marks', { params: { subject_id: chosenSubjectId, division } });
      let data = res.data || [];
      if (roll_no) {
        data = data.filter(r => String(r.roll_no) === String(roll_no));
      }
      setRows(data.map(r => ({ ...r, mark: r.mark || { mark_id: null, unit1: '', unit2: '', term: '', annual: '', grace: 0 } })));
    } catch (err) {
      console.error(err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (roll_no, field, value) => {
    // update value
    setRows(prev => prev.map(r => r.roll_no === roll_no ? { ...r, mark: { ...r.mark, [field]: value } } : r));

    // inline validation
    const n = value === '' ? null : Number(value);
    const key = `${roll_no}_${field}`;
    if (value === '' || value === null) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
      return;
    }
    if (Number.isNaN(n) || n < 0) {
      setErrors(prev => ({ ...prev, [key]: 'Enter a valid non-negative number' }));
      return;
    }
    const limit = FIELD_LIMITS[field];
    if (limit !== undefined && n > limit) {
      let msg = '';
      if (field === 'unit1') msg = `Unit 1 marks cannot exceed ${limit}`;
      else if (field === 'unit2') msg = `Unit 2 marks cannot exceed ${limit}`;
      else if (field === 'term') msg = `Terminal marks cannot exceed ${limit}`;
      else if (field === 'annual') msg = `Annual marks cannot exceed ${limit}`;
      else msg = `Value cannot exceed ${limit}`;
      setErrors(prev => ({ ...prev, [key]: msg }));
      return;
    }
    // pass validation
    setErrors(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    // update excel buffer if linked or if excelRows exist (keep in sync)
    setExcelRows(prev => prev.map(r => r.roll_no === roll_no ? { ...r, [field]: value } : r));
  };

  const FIELD_LIMITS = {
    unit1: 25,
    unit2: 25,
    term: 50,
    annual: 100,
    grace: 20,
  };

  const validateScores = (obj) => {
    const fields = Object.keys(FIELD_LIMITS);
    for (const f of fields) {
      const v = obj[f];
      if (v === "" || v === null || v === undefined) continue; // allow empty for add
      const n = Number(v);
      if (Number.isNaN(n) || n < 0 || n > FIELD_LIMITS[f]) return false;
    }
    return true;
  };

  // Save all subjects for selected student
  const handleSaveAll = async () => {
    if (!rows || rows.length === 0) return alert('No student rows to save. Use Search first.');
    // validate rows
    if (Object.keys(errors).length > 0) {
      const firstMsg = errors[Object.keys(errors)[0]];
      return alert(firstMsg);
    }
    if (excelSimpleMode) {
      // require single marks value per row
      for (const r of rows) {
        const m = r.mark || {};
        const v = m.annual;
        if (v === '' || v === null || v === undefined) return alert('All marks must be entered for each student before saving');
        const n = Number(v);
        if (Number.isNaN(n) || n < 0 || n > 100) return alert('Enter valid numeric marks between 0 and 100');
      }
    } else {
      for (const r of rows) {
        const m = r.mark || {};
        const required = ['unit1','unit2','term','annual'];
        for (const f of required) {
          const v = m[f];
          if (v === '' || v === null || v === undefined) return alert('All marks must be entered for each student before saving');
        }
        if (!validateScores(m)) return alert('Enter valid numeric scores within allowed ranges');
      }
    }

    setLoading(true);
    try {
      if ((linkedToExcel || (excelRows && excelRows.length > 0) || excelSimpleMode) && rows.length > 0) {
        // prepare entries and call batch endpoint
        const entries = rows.map(r => {
          const m = r.mark || {};
          if (excelSimpleMode) {
            return {
              roll_no: r.roll_no,
              division: r.division || division,
              subject_id: Number(chosenSubjectId),
              unit1: 0,
              unit2: 0,
              term: 0,
              annual: Number(m.annual) || 0,
              grace: Number(m.grace) || 0,
              grade: r.grade || ''
            };
          }
          return {
            roll_no: r.roll_no,
            division: r.division || division,
            subject_id: Number(chosenSubjectId),
            unit1: Number(m.unit1) || 0,
            unit2: Number(m.unit2) || 0,
            term: Number(m.term) || 0,
            annual: Number(m.annual) || 0,
            grace: Number(m.grace) || 0,
          };
        });
        await api.post('/teacher/marks/batch', { entries });
      } else {
        for (const r of rows) {
          const m = r.mark || {};
          const body = {
            roll_no: r.roll_no,
            division: r.division || division,
            subject_id: Number(chosenSubjectId),
            unit1: Number(m.unit1) || 0,
            unit2: Number(m.unit2) || 0,
            term: Number(m.term) || 0,
            annual: Number(m.annual) || 0,
          };
          if (m.mark_id) {
            await api.put(`/teacher/marks/${m.mark_id}`, { ...body, grace: Number(m.grace) || 0 });
          } else {
            await api.post('/teacher/marks', body);
          }
        }
      }
      alert('All marks saved');
      // refresh rows (respect current roll filter if present)
      await handleFetchStudents(studentRoll);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || err.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (subject_id) => {
    const payload = editing[subject_id];
    if (!payload || !payload.mark_id) { alert('No mark to delete'); return; }
    if (!window.confirm('Delete marks for subject ' + subject_id + '?')) return;
    try {
      await api.delete(`/teacher/marks/${payload.mark_id}`);
      alert('Deleted');
      // reload subjects for student
      if (studentRoll) await loadStudentSubjects(studentRoll);
    } catch (err) {
      alert(err.message || 'Delete failed');
    }
  };

  // helper to load student subjects
  const loadStudentSubjects = async (roll_no) => {
    if (!roll_no) return;
    setLoading(true);
    try {
      const res = await api.get('/teacher/student-marks', { params: { roll_no, division } });
      const data = res.data || {};
      // Only show the currently chosen subject for this student (teacher may be assigned many subjects)
      const filtered = (data.subjects || []).filter(s => Number(s.subject_id) === Number(chosenSubjectId));
      setSubjects(filtered);
      // prepare editing map
      const map = {};
      (filtered || []).forEach(s => {
        map[s.subject_id] = {
          mark_id: s.mark?.mark_id,
          unit1: s.mark?.unit1 ?? '',
          unit2: s.mark?.unit2 ?? '',
          term: s.mark?.term ?? '',
          annual: s.mark?.annual ?? '',
          grace: s.mark?.grace ?? 0,
        };
      });
      setEditing(map);
    } catch (err) {
      console.error(err);
      setSubjects([]);
      setEditing({});
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h3>Marks (Actions)</h3>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontWeight: 600 }}>Subject</label><br />
          <select value={chosenSubjectId || ''} onChange={e => {
            const id = e.target.value;
            const alloc = allocations.find(a => String(a.subject_id) === String(id));
            setChosenSubjectId(id);
            setChosenSubjectCode(alloc?.subject_code || null);
            if (alloc?.division) setDivision(alloc.division);
            // clear selected student roll input
            setStudentRoll('');
            setStudents([]);
            setSubjects([]);
          }}>
            <option value="">-- select subject --</option>
            {Array.from(new Map(allocations.map(a => [a.subject_id, a])).values()).map(a => (
              <option key={a.subject_id} value={a.subject_id}>{a.subject_code} — {a.subject_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontWeight: 600 }}>Division</label><br />
          <select value={division || ''} onChange={e => setDivision(e.target.value)}>
            <option value="">-- select division --</option>
            {['A','B','C'].map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontWeight: 600 }}>Student Roll Number</label><br />
            <input value={studentRoll} onChange={e => setStudentRoll(e.target.value)} placeholder="Enter roll no" />
          </div>
          <div>
            <button onClick={() => handleFetchStudents(studentRoll)} style={{ padding: '8px 12px' }}>Search</button>
          </div>
        </div>
      </div>

      {loading && <div>Loading...</div>}

      {!loading && rows.length > 0 && (
        <div>
          <div style={{ marginBottom: 8, color: '#444' }}>
            <div style={{ marginBottom: 6, fontWeight: 600 }}>Excel marks workflow</div>
            <div style={{ fontSize: 13, color: '#555' }}>
              Use the shared Excel file to add or update marks. Required columns: Roll, Student Name, Subject, Division, Unit1, Unit2, Term, Annual, Grace. Incorrect formats will be rejected. Teachers can only update marks for their allocated subject+division.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button onClick={async () => {
              try {
                const res = await api.get('/admin/excel/master', { responseType: 'blob' });
                const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `master_marks.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
              } catch (err) {
                console.error(err);
                alert(err.response?.data?.error || err.message || 'Failed to download master Excel');
              }
            }} style={{ padding: '8px 12px' }}>Download Excel</button>

            <button onClick={() => fileInputRef.current && fileInputRef.current.click()} style={{ padding: '8px 12px' }}>Upload Excel File</button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={async (e) => {
              const f = e.target.files && e.target.files[0];
              if (!f) return;
              const form = new FormData();
              form.append('file', f);
              // optionally include division/subject as defaults
              if (division) form.append('division', division);
              if (chosenSubjectId) form.append('subject_id', chosenSubjectId);
              setLoading(true);
              try {
                // call the non-destructive endpoint to read and match rows
                const res = await api.post('/teacher/marks/from-excel', form, { headers: { 'Content-Type': 'multipart/form-data' } });
                const data = res.data || {};
                const matched = data.matched || [];
                const missing = data.missing || [];
                setMissingRows(missing || []);
                // Map matched rows into the simplified table: Roll, Name, Marks, Grade
                if (matched.length > 0) {
                  setRows(matched.map(m => ({ roll_no: m.roll_no, name: m.name, division: m.division, mark: { annual: m.mark?.annual ?? m.mark?.tot ?? '', mark_id: m.mark?.mark_id ?? null }, grade: m.grade || '' })));
                  setExcelSimpleMode(true);
                } else {
                  setRows([]);
                  setExcelSimpleMode(false);
                }
                alert((matched.length>0? matched.length + ' rows matched. ' : '') + (missing.length>0? missing.length + ' rows missing.' : '') || 'Upload processed');
              } catch (err) {
                console.error(err);
                alert(err.response?.data?.error || err.message || 'Upload failed');
              } finally {
                setLoading(false);
                e.target.value = '';
              }
            }} />

            <button onClick={() => {
              // open master excel location in new tab
              const url = '/admin/excel/master';
              window.open(url, '_blank');
            }} style={{ padding: '8px 12px' }}>{linkedToExcel ? 'Unlink Excel' : 'Link to Excel'}</button>
          </div>
          <div style={{ marginBottom: 10, fontWeight: 700 }}>
            Subject: {chosenSubjectCode} &nbsp;|&nbsp; Division: {division}
          </div>
          {excelSimpleMode ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f7f9fb' }}>
                  <th style={{ padding: 8, textAlign: 'left' }}>Roll No.</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Student Name</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>Marks</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>Grade</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const e = r.mark || {};
                  return (
                    <tr key={r.roll_no} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: 8 }}>{r.roll_no}</td>
                      <td style={{ padding: 8 }}>{r.name}</td>
                      <td style={{ padding: 6, textAlign: 'center' }}>
                        <input style={{ width: 100 }} type="number" min="0" max="100" value={e.annual ?? ''} onChange={ev => handleChange(r.roll_no, 'annual', ev.target.value)} />
                        {errors[`${r.roll_no}_annual`] && (
                          <div style={{ color: '#c0392b', fontSize: 12, marginTop: 4 }}>{errors[`${r.roll_no}_annual`]}</div>
                        )}
                      </td>
                      <td style={{ padding: 6, textAlign: 'center' }}>
                        <select value={r.grade || ''} onChange={ev => {
                          const val = ev.target.value;
                          setRows(prev => prev.map(rr => rr.roll_no === r.roll_no ? { ...rr, grade: val } : rr));
                        }}>
                          <option value="">--</option>
                          <option value="A+">A+</option>
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="D">D</option>
                          <option value="F">F</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f7f9fb' }}>
                <th style={{ padding: 8, textAlign: 'left' }}>Roll</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Name</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Unit1</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Unit2</th>
                
                <th style={{ padding: 8, textAlign: 'center' }}>Term</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Annual</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Grace</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const e = r.mark || {};
                return (
                  <tr key={r.roll_no} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: 8 }}>{r.roll_no}</td>
                    <td style={{ padding: 8 }}>{r.name}</td>
                    <td style={{ padding: 6, textAlign: 'center' }}>
                      <input style={{ width: 60 }} type="number" min="0" max="25" value={e.unit1 ?? ''} onChange={ev => handleChange(r.roll_no, 'unit1', ev.target.value)} />
                      {errors[`${r.roll_no}_unit1`] && (
                        <div style={{ color: '#c0392b', fontSize: 12, marginTop: 4 }}>{errors[`${r.roll_no}_unit1`]}</div>
                      )}
                    </td>
                    <td style={{ padding: 6, textAlign: 'center' }}>
                      <input style={{ width: 60 }} type="number" min="0" max="25" value={e.unit2 ?? ''} onChange={ev => handleChange(r.roll_no, 'unit2', ev.target.value)} />
                      {errors[`${r.roll_no}_unit2`] && (
                        <div style={{ color: '#c0392b', fontSize: 12, marginTop: 4 }}>{errors[`${r.roll_no}_unit2`]}</div>
                      )}
                    </td>
                    
                    <td style={{ padding: 6, textAlign: 'center' }}>
                      <input style={{ width: 60 }} type="number" min="0" max="50" value={e.term ?? ''} onChange={ev => handleChange(r.roll_no, 'term', ev.target.value)} />
                      {errors[`${r.roll_no}_term`] && (
                        <div style={{ color: '#c0392b', fontSize: 12, marginTop: 4 }}>{errors[`${r.roll_no}_term`]}</div>
                      )}
                    </td>
                    <td style={{ padding: 6, textAlign: 'center' }}>
                      <input style={{ width: 60 }} type="number" min="0" max="100" value={e.annual ?? ''} onChange={ev => handleChange(r.roll_no, 'annual', ev.target.value)} />
                      {errors[`${r.roll_no}_annual`] && (
                        <div style={{ color: '#c0392b', fontSize: 12, marginTop: 4 }}>{errors[`${r.roll_no}_annual`]}</div>
                      )}
                    </td>
                    <td style={{ padding: 6, textAlign: 'center' }}>
                      <input
                        style={{ width: 60, color: e.grace ? '#c0392b' : undefined, fontWeight: e.grace ? 700 : 400 }}
                        type="number"
                        min="0"
                        max="20"
                        value={e.grace ?? 0}
                        onChange={ev => handleChange(r.roll_no, 'grace', ev.target.value)}
                      />
                      {errors[`${r.roll_no}_grace`] && (
                        <div style={{ color: '#c0392b', fontSize: 12, marginTop: 4 }}>{errors[`${r.roll_no}_grace`]}</div>
                      )}
                    </td>
                    <td style={{ padding: 6, textAlign: 'center' }}>
                      {e.mark_id ? (
                        <button onClick={async () => { if (!window.confirm('Delete marks for ' + r.roll_no + '?')) return; try { await api.delete(`/teacher/marks/${e.mark_id}`); await handleFetchStudents(studentRoll); } catch(err){ alert('Delete failed'); } }} style={{ padding: '6px 8px', background: '#e74c3c', color: 'white' }}>Delete</button>
                      ) : (
                        <span style={{ color: '#888' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
        </div>
      )}

      {/* Save button placed at bottom-right to allow completing all entries */}
      {!loading && rows.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={handleSaveAll} style={{ padding: '10px 14px', background: '#27ae60', color: '#fff', border: 'none', borderRadius: 6 }}>Save All</button>
        </div>
      )}
    </div>
  );
}
