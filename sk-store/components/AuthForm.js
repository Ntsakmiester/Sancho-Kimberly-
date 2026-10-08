import Link from 'next/link';
export default function AuthForm({ title, sub, action, fields, button, error, notice, children }) {
  return (
    <section className="wrap shop" style={{ maxWidth: 440 }}>
      <h2>{title}</h2>
      {sub && <p className="low">{sub}</p>}
      {error && <p className="err">{error}</p>}
      {notice && <p style={{ color: '#146c2e' }}>{notice}</p>}
      <form method="post" action={action} style={{ display: 'grid', gap: 10 }}>
        {fields.map((f) => (
          <input key={f.name} name={f.name} type={f.type || 'text'} placeholder={f.placeholder}
            defaultValue={f.value || ''} autoComplete={f.autoComplete} maxLength={f.type === 'password' ? 200 : undefined} required={f.required !== false} />
        ))}
        <button className="btn full">{button}</button>
      </form>
      {children}
    </section>
  );
}
export function AuthLink({ href, children }) {
  return <p className="low" style={{ marginTop: 12 }}><Link href={href}>{children}</Link></p>;
}
