import { SUBJECT_MAX, BODY_MAX } from '../lib/messages';
export default function MessageComposer({ back }) {
  return (
    <form method="post" action="/api/admin/messages" className="office-form sendmsg">
      <input type="hidden" name="back" value={back} />
      <label className="label">Send to
        <select name="to" defaultValue="all" aria-label="Send to"><option value="all">All customers</option><option value="one">One customer (by email)</option></select></label>
      <label className="label">Customer email (only for one customer)<input type="email" name="email" placeholder="customer@example.com" autoComplete="off" /></label>
      <label className="label">Subject<input name="subject" maxLength={SUBJECT_MAX} required /></label>
      <label className="label">Message<textarea name="body" rows={6} maxLength={BODY_MAX} required /></label>
      <p className="low">Shows in each customer&apos;s account under Messages. It is not emailed or sent to their phone.</p>
      <button className="btn">Send message</button>
    </form>
  );
}
