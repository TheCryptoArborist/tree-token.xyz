const link = document.createElement('a');
link.href = '/gateway/';
link.textContent = 'NEW · TREE Gateway — Explore the Mayan bridge →';
link.setAttribute('aria-label', 'Open TREE Gateway Mayan bridge preview');
Object.assign(link.style, { position: 'fixed', bottom: '22px', right: '20px', zIndex: '2147483646', padding: '16px 20px', borderRadius: '14px', background: '#c2ed98', color: '#102013', font: '700 14px system-ui', boxShadow: '0 6px 35px #0008', maxWidth: 'calc(100vw - 40px)', textDecoration: 'none', border: '1px solid #e0ffc0' });
document.body.append(link);
const nav = document.querySelector('.app-nav');
if (nav) { const item = document.createElement('a'); item.href = '/gateway/'; item.textContent = '↗ Gateway'; nav.prepend(item); }
