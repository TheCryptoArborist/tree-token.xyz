let activeReview = null;

function element(tag, className, text) {
  const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node;
}

function renderMessage(container, message) {
  const groups = String(message || '').trim().split(/\n\s*\n/).map((group) => group.trim()).filter(Boolean);
  groups.forEach((group, groupIndex) => {
    const lines = group.split('\n').map((line) => line.trim()).filter(Boolean);
    const details = lines.map((line) => line.match(/^([^:]{2,38}):\s*(.+)$/)).filter(Boolean);
    if (details.length === lines.length && details.length > 0) {
      const grid = element('dl', 'tree-review-details');
      details.forEach((match) => { grid.append(element('dt', '', match[1]), element('dd', '', match[2])); });
      container.append(grid); return;
    }
    const paragraph = element('p', groupIndex === 0 ? 'tree-review-lead' : '');
    lines.forEach((line, index) => { if (index) paragraph.append(document.createElement('br')); paragraph.append(document.createTextNode(line)); });
    container.append(paragraph);
  });
}

export function confirmTransaction(message, options = {}) {
  if (activeReview) activeReview(false);
  return new Promise((resolve) => {
    const previousFocus = document.activeElement; const previousOverflow = document.body.style.overflow;
    const overlay = element('div', 'tree-review-overlay'); overlay.setAttribute('role', 'presentation');
    const dialog = element('section', 'tree-review-dialog'); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'treeReviewTitle');
    const header = element('header', 'tree-review-header');
    const emblem = element('span', 'tree-review-emblem'); emblem.setAttribute('aria-hidden', 'true');
    const emblemImage = element('img'); emblemImage.src = '../assets/tree-command-logo-v2-512.png'; emblemImage.alt = ''; emblemImage.width = 37; emblemImage.height = 37; emblem.append(emblemImage);
    const heading = element('div'); const eyebrow = element('span', 'tree-review-eyebrow', options.eyebrow || 'TREE TRANSACTION REVIEW');
    const title = element('h2', '', options.title || 'Review Before Wallet'); title.id = 'treeReviewTitle'; heading.append(eyebrow, title); header.append(emblem, heading);
    const body = element('div', 'tree-review-body'); renderMessage(body, message);
    const verified = element('div', 'tree-review-verified'); verified.append(element('span', '', '✓'), element('p', '', options.verification || 'The transaction details shown here were checked before your wallet is opened. Your wallet remains the final approval.'));
    const actions = element('footer', 'tree-review-actions'); const cancel = element('button', 'tree-review-cancel', options.cancelLabel || 'Cancel'); cancel.type = 'button';
    const approve = element('button', 'tree-review-approve', options.confirmLabel || 'Continue to Wallet'); approve.type = 'button'; actions.append(cancel, approve);
    dialog.append(header, body, verified, actions); overlay.append(dialog); document.body.append(overlay); document.body.style.overflow = 'hidden';

    const finish = (answer) => {
      if (!overlay.isConnected) return; overlay.remove(); document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown); activeReview = null;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus(); resolve(Boolean(answer));
    };
    const onKeyDown = (event) => { if (event.key === 'Escape') finish(false); };
    activeReview = finish; cancel.addEventListener('click', () => finish(false)); approve.addEventListener('click', () => finish(true));
    overlay.addEventListener('click', (event) => { if (event.target === overlay) finish(false); }); document.addEventListener('keydown', onKeyDown); queueMicrotask(() => approve.focus());
  });
}

function openLocalPreview() {
  if (!['localhost', '127.0.0.1'].includes(location.hostname) || new URLSearchParams(location.search).get('transaction-review-preview') !== '1') return;
  confirmTransaction(`Process 50,000 VICTORY with Sustainable Reinvest?\n\nReinvest: 32,500 VICTORY (65%)\nLock: 17,500 VICTORY for 7 days\nEstimated unlock: August 28, 2026\nMinimum SUI from VICTORY: 7.40 SUI\nMinimum TREE for liquidity: 130,000 TREE\nCombined quoted impact: 0.60%\n\nStep 1 atomically locks the selected portion and creates liquidity. Step 2 offers to stake only the new LP. The exact transaction passed two Mainnet simulations.`, {
    title: 'Sustainable Reinvest', confirmLabel: 'Preview Complete', verification: 'Preview only—this review window is not connected to a transaction or wallet request.',
  });
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', openLocalPreview, { once: true }) : queueMicrotask(openLocalPreview);
