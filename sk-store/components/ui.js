import Link from 'next/link';
// Small shared building blocks for the back office. Tables scroll sideways on phones.
export const Flash = ({ sp }) => (sp?.saved ? <p className="low" role="status" style={{ color: '#0a6' }}>{sp.saved === '1' ? 'Saved.' : sp.saved}</p> : sp?.error ? <p className="err" role="alert">{sp.error}</p> : null);
export const Table = ({ head, children, empty = 'Nothing here yet.', count }) => (
  <div className="office-table-scroll" tabIndex={0} role="region" aria-label="Scrollable data table">
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}><thead><tr style={{ textAlign: 'left' }}>{head.map((h) => <th key={h} style={{ padding: '6px 8px' }}>{h}</th>)}</tr></thead>
      <tbody>{children}</tbody></table>
    {count === 0 && <p className="low">{empty}</p>}
  </div>
);
export const Td = ({ children, ...p }) => <td style={{ padding: '6px 8px', borderTop: '1px solid var(--line)', verticalAlign: 'top' }} {...p}>{children}</td>;
export function Pager({ base, page, size, total }) {
  if (!total || total <= size) return null;
  const href = (n) => base + (base.includes('?') ? '&' : '?') + 'page=' + n;
  return <div className="chips" style={{ marginTop: 12 }}>{page > 1 && <Link href={href(page - 1)}>&larr; Previous</Link>}<span className="low">Page {page} of {Math.ceil(total / size)} ({total} total)</span>{page * size < total && <Link href={href(page + 1)}>Next &rarr;</Link>}</div>;
}
export const Stat = ({ label, value, accent = false }) => <div className={'stat-card' + (accent ? ' stat-accent' : '')}><div className="stat-label">{label}</div><div className="stat-value">{value}</div></div>;
export const Stats = ({ children }) => <div className="stats-grid">{children}</div>;
export const Empty = ({ children }) => <div className="empty">{children}</div>;
export const RangeBar = ({ base, sp }) => (
  <form method="get" action={base} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', margin: '8px 0' }}>
    <select name="range" defaultValue={sp?.range || '30d'} aria-label="Date range">{[['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['month', 'This month'], ['prev', 'Previous month'], ['custom', 'Custom']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    <input type="date" name="from" defaultValue={sp?.from || ''} aria-label="From" /><input type="date" name="to" defaultValue={sp?.to || ''} aria-label="To" />
    <button className="btn">Apply</button>
  </form>
);
