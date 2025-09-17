import React, { useEffect, useState } from 'react';

const dued8: any = (window as any)?.dued8;

type Student = {
  id: number;
  first_name: string;
  last_name: string;
  county: string;
  created_at: string;
};

export default function Dashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [county, setCounty] = useState<'Fairfax' | 'Sci-Tech'>('Fairfax');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canAdd = first.trim().length > 0 && last.trim().length > 0;

  async function refresh() {
    setErr(null);
    try {
      if (!dued8 || !dued8.students || !dued8.students.list) {
        throw new Error('Bridge not ready: dued8.students.list is unavailable');
      }
      const rows: Student[] = await dued8.students.list();
      setStudents(rows);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load students');
    }
  }

  async function addStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!first.trim() || !last.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      if (!dued8 || !dued8.students || !dued8.students.add) {
        throw new Error('Bridge not ready: dued8.students.add is unavailable');
      }
      await dued8.students.add({ first_name: first.trim(), last_name: last.trim(), county });
      setFirst('');
      setLast('');
      setCounty('Fairfax');
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? 'Add failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h2>Students</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0 16px' }}>
        <button type="button" onClick={refresh}>Refresh</button>
        <span>Count: {students.length}</span>
      </div>

      <form onSubmit={addStudent} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input placeholder="First name" value={first} onChange={e => setFirst(e.target.value)} />
        <input placeholder="Last name" value={last} onChange={e => setLast(e.target.value)} />
        <select value={county} onChange={e => setCounty(e.target.value as 'Fairfax' | 'Sci-Tech')}>
          <option>Fairfax</option>
          <option>Sci-Tech</option>
        </select>
        <button type="submit" disabled={loading || !canAdd}>{loading ? 'Adding...' : 'Add'}</button>
      </form>

      {err && <div role="status" aria-live="polite" style={{ color: 'crimson', marginBottom: 8 }}>{err}</div>}

      <ul style={{ lineHeight: 1.8 }}>
        {students.map(s => (
          <li key={s.id}>
            {s.last_name}, {s.first_name} — {s.county} — {new Date(s.created_at).toLocaleString()}
          </li>
        ))}
        {students.length === 0 && <li>No students yet</li>}
      </ul>
    </div>
  );
}