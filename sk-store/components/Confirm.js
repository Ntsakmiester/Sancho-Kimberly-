'use client';
// Submit button that asks "are you sure?" before a risky action.
export default function Confirm({ children, message = 'Are you sure?', className = 'btn', ...rest }) {
  return <button className={className} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }} {...rest}>{children}</button>;
}
