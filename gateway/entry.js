const commandCenter = document.querySelector('.app-nav') && document.querySelector('main');
if (commandCenter) {
  const style = document.createElement('style');
  style.textContent = `#tree-gateway-dock{position:relative;z-index:2;margin:0 0 14px;border:1px solid rgba(53,200,255,.2);border-radius:12px;background:#081119;color:#f5fbff;overflow:hidden}#tree-gateway-dock>summary{padding:12px 14px;cursor:pointer;font:600 13px system-ui}#tree-gateway-dock>summary small{font:400 10px system-ui;color:#9aa9b8;margin-left:8px}#tree-gateway-dock iframe{display:block;width:100%;border:0;background:#081119}#tree-gateway-dock .gateway-full{display:block;padding:8px 14px 12px;font:12px system-ui;color:#35c8ff;text-align:right}#tree-gateway-dock :focus-visible{outline:2px solid #35c8ff;outline-offset:-3px}`;
  document.head.append(style);
  const dock = document.createElement('details');
  dock.id = 'tree-gateway-dock';
  const summary = document.createElement('summary');
  summary.append('↗ TREE Gateway ');
  const badge = document.createElement('small');
  badge.textContent = 'Bridge to Sui · Preview';
  summary.append(badge);
  dock.append(summary);
  const full = document.createElement('a');
  full.className = 'gateway-full';
  full.href = '/gateway/';
  full.textContent = 'Open standalone Gateway ↗';
  let frame;
  let observer;
  dock.addEventListener('toggle', () => {
    if (!dock.open || frame) return;
    frame = document.createElement('iframe');
    frame.title = 'TREE Gateway quote preview — transfers disabled';
    frame.style.height = '760px';
    frame.addEventListener('load', () => {
      observer?.disconnect();
      // Fixed same-origin page; no cross-window wallet or transaction messages.
      const content = frame.contentDocument?.querySelector('main');
      if (!content) return;
      const resize = () => { frame.style.height = Math.min(5000, Math.max(300, Math.ceil(content.getBoundingClientRect().height) + 2)) + 'px'; };
      observer = new ResizeObserver(resize);
      observer.observe(content);
      resize();
    });
    frame.src = '/gateway/?embed=command-center';
    dock.append(frame, full);
  });
  commandCenter.prepend(dock);
} else {
  const link = document.createElement('a');
  link.href = '/dapp/';
  link.textContent = 'TREE Gateway · In the Command Center →';
  link.setAttribute('aria-label', 'Open Command Center with TREE Gateway preview');
  Object.assign(link.style, { position: 'fixed', bottom: '22px', right: '20px', zIndex: '2147483646', padding: '12px 16px', borderRadius: '12px', background: 'linear-gradient(135deg,#35f28c,#20cfa7)' , color: '#102013', font: '700 13px system-ui', maxWidth: 'calc(100vw - 40px)', textDecoration: 'none' });
  document.body.append(link);
}
