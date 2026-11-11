// Patches a live subtree to match freshly rendered markup instead of replacing
// it, so the periodic refresh keeps what the browser holds on the elements:
// scroll positions, <details> the user opened or closed, focus and selection,
// typed input values and already decoded images. Children pair up by position
// and tag (and by identity attributes where lists can shift); anything that no
// longer matches is replaced, so the result is the same DOM innerHTML would give.
const identities = ['id', 'data-details', 'data-section', 'data-overview', 'data-node', 'data-phase', 'data-svg-preview', 'data-tree-scroll', 'data-kra-preview'];
const identity = node => {
  if (node.nodeType !== 1) return node.nodeType;
  for (const name of identities) if (node.hasAttribute(name)) return node.tagName + '|' + name + '=' + node.getAttribute(name);
  return node.tagName;
};

export function morph(target, html) {
  const template = document.createElement('template');
  template.innerHTML = html; // inert: nothing loads until a node is placed
  patchChildren(target, template.content);
}

function patchChildren(live, next) {
  const liveNodes = [...live.childNodes], nextNodes = [...next.childNodes];
  nextNodes.forEach((node, index) => {
    const current = liveNodes[index];
    if (!current) live.appendChild(node);
    else if (identity(current) !== identity(node)) live.replaceChild(node, current);
    else patch(current, node);
  });
  for (const node of liveNodes.slice(nextNodes.length)) node.remove();
}

function patch(live, next) {
  if (live.nodeType !== 1) { if (live.nodeValue !== next.nodeValue) live.nodeValue = next.nodeValue; return; }
  // The open state of <details> belongs to the user once the element exists.
  const keep = name => name === 'open' && live.tagName === 'DETAILS'
    || name === 'style' && live.hasAttribute('data-flow-layout') && next.hasAttribute('data-flow-layout')
    || live.tagName === 'CANVAS' && (name === 'width' || name === 'height');
  for (const { name } of [...live.attributes]) if (!next.hasAttribute(name) && !keep(name)) live.removeAttribute(name);
  for (const { name, value } of [...next.attributes]) if (live.getAttribute(name) !== value && !keep(name)) live.setAttribute(name, value);
  // Read the rendered control state first: patching moves unmatched children out of next.
  const chosen = live.tagName === 'SELECT' ? [...next.options].findIndex(option => option.hasAttribute('selected')) : -1;
  const text = live.tagName === 'TEXTAREA' ? next.textContent : null;
  patchChildren(live, next);
  if (live === document.activeElement) return;
  if (live.tagName === 'INPUT') {
    if (live.type === 'checkbox' || live.type === 'radio') live.checked = next.hasAttribute('checked');
    else if (live.type !== 'file') live.value = next.getAttribute('value') ?? '';
  } else if (live.tagName === 'SELECT') live.selectedIndex = chosen >= 0 ? chosen : live.multiple ? -1 : 0;
  else if (text !== null) live.value = text;
}
