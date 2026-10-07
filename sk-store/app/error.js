'use client';
export default function Error({ reset }) {
  return <section className="wrap shop"><h2>Something went wrong</h2><p className="lead">Please try again. If it keeps happening, contact us.</p><button className="btn" onClick={() => reset()}>Try again</button></section>;
}
