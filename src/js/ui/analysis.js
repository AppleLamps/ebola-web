export function renderAnalysis(listElement, insights) {
  if (!listElement) {
    return;
  }

  listElement.innerHTML = "";

  for (const insight of insights) {
    const li = document.createElement("li");
    li.textContent = insight;
    listElement.appendChild(li);
  }
}
