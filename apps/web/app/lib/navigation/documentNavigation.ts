export function navigateToDocument(path: string): void {
  window.location.assign(path);
}

export function reloadCurrentDocument(): void {
  window.location.reload();
}
