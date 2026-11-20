// Copies text when the browser allows it. Returns false
// when there is no clipboard or the browser refuses, so
// the page can tell the person to copy by hand instead of
// pretending the copy ran.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) {
      return false;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
