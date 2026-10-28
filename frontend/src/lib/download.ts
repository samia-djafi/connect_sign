/**
 * Triggers a browser file download using an ephemeral Blob object URL.
 *
 * @param filename - Target file name including extension (e.g. 'export.json').
 * @param content - String contents to download.
 * @param contentType - MIME type string (defaults to 'text/plain').
 */
export function downloadFile(filename: string, content: string, contentType: string = 'text/plain') {
  if (typeof document === 'undefined') return;

  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
