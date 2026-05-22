const store = {
  snapshot: null,
};

export function setSnapshot(snapshot) {
  store.snapshot = snapshot;
}

export function getSnapshot() {
  return store.snapshot;
}
