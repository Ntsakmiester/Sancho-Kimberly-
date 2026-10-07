'use client';
import { useEffect, useState } from 'react';
export default function ProductImagesInput() {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [urls, setUrls] = useState([]);
  useEffect(() => { const next = files.map((f) => URL.createObjectURL(f)); setUrls(next); return () => next.forEach(URL.revokeObjectURL); }, [files]);
  return <div className="image-input"><label htmlFor="product-images">Product images <span className="low">(optional)</span></label>
    <p className="low" id="image-help">Choose up to 8 images. PNG, JPEG, WebP or GIF, 2 MB each. The first image is the cover.</p>
    <input id="product-images" type="file" name="images" multiple accept="image/png,image/jpeg,image/webp,image/gif" aria-describedby="image-help" onChange={(e) => {
      const next = Array.from(e.target.files || []);
      if (next.length > 8 || next.some(f => f.size > 2 * 1024 * 1024 || !['image/png','image/jpeg','image/webp','image/gif'].includes(f.type))) { setError('Choose up to 8 supported images, no larger than 2 MB each.'); setFiles([]); e.target.value = ''; return; }
      setError(''); setFiles(next);
    }} />
    {error && <p className="err" role="alert">{error}</p>}
    <div className="image-previews">{urls.map((url, i) => <figure key={url}><img src={url} alt={`Preview of ${files[i]?.name || 'image'}`} /><figcaption>{i === 0 ? 'Cover' : `Image ${i + 1}`}</figcaption></figure>)}</div>
  </div>;
}
