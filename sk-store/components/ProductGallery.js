'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';

// Native scroll snap supports touch/trackpad swipes without blocking vertical scrolling.
export default function ProductGallery({ images, name, overrideImage, onNavigate, compact = false, href }) {
  const track = useRef(null);
  const swiped = useRef(false);
  const [index, setIndex] = useState(0);
  const many = images.length > 1;
  const go = (next, instant = false) => {
    if (!track.current) return;
    const clamped = Math.max(0, Math.min(images.length - 1, next));
    onNavigate?.();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.current.scrollTo({ left: clamped * track.current.clientWidth, behavior: reduced || instant ? 'instant' : 'smooth' });
  };
  const scrolled = () => {
    swiped.current = true;
    const next = Math.round(track.current.scrollLeft / (track.current.clientWidth || 1));
    if (next !== index) { setIndex(next); onNavigate?.(); }
  };
  return <div className={`product-gallery${compact ? " gallery-compact" : ""}`} role="region" aria-label={`${name} photos`}>
    <div ref={track} className="gallery-track" tabIndex={many ? 0 : undefined} onScroll={scrolled} onPointerDown={() => { swiped.current = false; }} onTouchStart={() => { swiped.current = false; }}
      onKeyDown={(e) => {
        if (!many) return;
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
          e.preventDefault();
          go(e.key === 'Home' ? 0 : e.key === 'End' ? images.length - 1 : index + (e.key === 'ArrowRight' ? 1 : -1), true);
        }
      }}>
      {images.length ? images.map((im, j) => <div className="tile gallery-slide" key={`${im.url}-${j}`} style={{ background: im.bg || '#fff' }} role="group" aria-label={`Photo ${j + 1} of ${images.length}`}>
        {href ? <Link href={href} className="gallery-photo-link" draggable="false" aria-label={`View ${name}`} onClick={(e) => { if (swiped.current) e.preventDefault(); }}><img src={j === index && overrideImage ? overrideImage : im.url} alt={j === index && overrideImage ? name : im.alt || `${name}, photo ${j + 1}`} draggable="false" loading={compact ? 'lazy' : 'eager'} /></Link> : <img src={j === index && overrideImage ? overrideImage : im.url} alt={j === index && overrideImage ? name : im.alt || `${name}, photo ${j + 1}`} draggable="false" loading={compact ? 'lazy' : 'eager'} />}
      </div>) : <div className="tile gallery-slide">No photo available</div>}
    </div>
    {many && <>
      <div className="gallery-controls">
        <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous photo">&larr;</button>
        <span className="gallery-count" aria-live="polite" aria-atomic="true">{index + 1} / {images.length}</span>
        <button type="button" onClick={() => go(index + 1)} disabled={index === images.length - 1} aria-label="Next photo">&rarr;</button>
      </div>
      {!compact && <p className="gallery-hint">Swipe through photos or use the arrows.</p>}
      {!compact && <div className="thumbs gallery-thumbs" aria-label="Choose a product photo">
        {images.map((im, j) => <button type="button" key={j} className={j === index ? 'sel' : ''} onClick={() => go(j)} aria-pressed={j === index} aria-label={`View photo ${j + 1}`}><img src={im.url} alt="" /></button>)}
      </div>}
    </>}
  </div>;
}
