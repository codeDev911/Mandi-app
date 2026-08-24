/**
 * Universal File Saver, Downloader and Export Utility
 * Works seamlessly across Browsers, Sandboxed Iframes, PWAs, Tauri Desktop, and Android/iOS WebViews
 */

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback clipboard copy failed:', err);
    return false;
  }
}

/**
 * Universal Save for Blob files (PDF, PNG, Images, Excel, etc.)
 * Uses modern File System Access API (showSaveFilePicker) where supported,
 * falling back cleanly to Blob URLs, Data URIs, and Web Share.
 */
export async function saveBlobFile(
  blob: Blob,
  fileName: string,
  description?: string
): Promise<{ success: boolean; method: 'picker' | 'download' | 'share' | 'failed'; message: string }> {
  // Strategy 1: Modern File System Access API (window.showSaveFilePicker)
  // This lets the user pick the exact destination folder & file name on disk.
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
      const mime = blob.type || 'application/octet-stream';
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: description || 'File Document',
            accept: {
              [mime]: ext ? [ext] : [],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { success: true, method: 'picker', message: `Saved to ${fileName}` };
    } catch (pickerErr: any) {
      // If user cancelled the picker dialog, do not trigger ugly fallbacks
      if (pickerErr?.name === 'AbortError') {
        return { success: true, method: 'picker', message: 'Save cancelled by user' };
      }
      console.warn('showSaveFilePicker failed or was blocked, falling back to standard download:', pickerErr);
    }
  }

  // Strategy 2: Direct Blob URL Link Trigger
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    a.target = '_self';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 4000);

    return { success: true, method: 'download', message: `Saved ${fileName}` };
  } catch (blobErr) {
    console.warn('Blob direct download failed, trying FileReader data URI:', blobErr);
  }

  // Strategy 3: FileReader Data URI Download Trigger
  try {
    const reader = new FileReader();
    const result = await new Promise<{ success: boolean; method: 'download' | 'failed'; message: string }>((resolve) => {
      reader.onloadend = () => {
        try {
          const dataUri = reader.result as string;
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = dataUri;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            if (document.body.contains(a)) {
              document.body.removeChild(a);
            }
          }, 2000);
          resolve({ success: true, method: 'download', message: `Saved ${fileName}` });
        } catch {
          resolve({ success: false, method: 'failed', message: 'Failed to download file' });
        }
      };
      reader.onerror = () => {
        resolve({ success: false, method: 'failed', message: 'FileReader failed' });
      };
      reader.readAsDataURL(blob);
    });

    if (result.success) return result;
  } catch (err) {
    console.warn('Data URI download failed:', err);
  }

  // Strategy 4: Web Share API fallback on mobile browsers
  try {
    const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
    if (typeof navigator !== 'undefined' && 'canShare' in navigator && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: fileName,
      });
      return { success: true, method: 'share', message: 'Shared file to save' };
    }
  } catch (shareErr) {
    console.warn('Web Share fallback failed:', shareErr);
  }

  return { success: false, method: 'failed', message: 'File could not be saved automatically in this sandbox.' };
}

/**
 * Universal Save for Text / JSON / CSV files
 */
export async function saveTextFile(
  content: string,
  fileName: string,
  mimeType: string = 'text/plain;charset=utf-8',
  description?: string
): Promise<{ success: boolean; method: 'picker' | 'download' | 'clipboard' | 'failed'; message: string }> {
  // Strategy 1: File System Access API
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: description || 'Text Document',
            accept: {
              [mimeType.split(';')[0]]: ext ? [ext] : [],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return { success: true, method: 'picker', message: `Saved to ${fileName}` };
    } catch (pickerErr: any) {
      if (pickerErr?.name === 'AbortError') {
        return { success: true, method: 'picker', message: 'Save cancelled by user' };
      }
      console.warn('showSaveFilePicker for text failed, falling back:', pickerErr);
    }
  }

  // Strategy 2: Blob Link
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    a.target = '_self';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 3000);

    return { success: true, method: 'download', message: `Saved ${fileName}` };
  } catch (blobErr) {
    console.warn('Blob text download failed:', blobErr);
  }

  // Strategy 3: Data URI
  try {
    const dataUri = `data:${mimeType},` + encodeURIComponent(content);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = dataUri;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    }, 1500);
    return { success: true, method: 'download', message: `Saved ${fileName}` };
  } catch (dataUriErr) {
    console.warn('Data URI download failed:', dataUriErr);
  }

  // Strategy 4: Clipboard Fallback
  const copied = await copyTextToClipboard(content);
  if (copied) {
    return {
      success: true,
      method: 'clipboard',
      message: 'File content copied to clipboard! (Browser sandbox prevented direct file write)',
    };
  }

  return {
    success: false,
    method: 'failed',
    message: 'Could not automatically save file in this environment.',
  };
}

// Backward compatibility alias
export const downloadBlobFile = saveBlobFile;
export const downloadTextFile = saveTextFile;

/**
 * Dedicated Share API for mobile share sheet when user explicitly clicks Share
 */
export async function shareBlobFile(
  blob: Blob,
  fileName: string,
  shareTitle: string = 'Share Document'
): Promise<{ success: boolean; message: string }> {
  try {
    const file = new File([blob], fileName, { type: blob.type || 'application/pdf' });
    if (typeof navigator !== 'undefined' && 'canShare' in navigator && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: shareTitle,
        text: fileName,
      });
      return { success: true, message: 'Shared successfully!' };
    }
  } catch (shareErr: any) {
    if (shareErr?.name === 'AbortError') {
      return { success: true, message: 'Share action cancelled.' };
    }
    console.warn('Web Share failed, falling back to direct save:', shareErr);
  }

  // Fallback to direct save if share is not supported
  const dlRes = await saveBlobFile(blob, fileName, shareTitle);
  return { success: dlRes.success, message: dlRes.message };
}

export async function downloadJSONBackup(
  data: any,
  fileNamePrefix: string = 'mandi-backup'
): Promise<{ success: boolean; method: string; message: string }> {
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `${fileNamePrefix}-${dateStr}.json`;
  const jsonStr = JSON.stringify(data, null, 2);
  return saveTextFile(jsonStr, fileName, 'application/json;charset=utf-8', 'Mandi JSON Backup');
}

export async function downloadCSV(
  csvContent: string,
  fileNamePrefix: string = 'mandi-report'
): Promise<{ success: boolean; method: string; message: string }> {
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `${fileNamePrefix}-${dateStr}.csv`;
  // Add UTF-8 BOM so Excel opens Urdu and special characters cleanly
  const bomCsv = '\uFEFF' + csvContent;
  return saveTextFile(bomCsv, fileName, 'text/csv;charset=utf-8', 'Mandi CSV Report');
}
