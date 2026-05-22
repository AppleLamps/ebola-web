export function text(id, value) {
  const node = document.getElementById(id);
  if (!node) {
    return;
  }

  node.textContent = value;
}

export function html(id, value) {
  const node = document.getElementById(id);
  if (!node) {
    return;
  }

  node.innerHTML = value;
}
