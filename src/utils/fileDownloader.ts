/**
 * Universal File Downloader and Export Utility
 * Works seamlessly in Web Browsers, Sandboxed Iframes, PWAs, Android/iOS WebViews
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

export async function downloadTextFile(
  content: string,
  fileName: string,
  mimeType: string = 'text/plain;charset=utf-8'
): Promise<{ success: boolean; method: 'download' | 'clipboard' | 'failed'; message: string }> {
  // 1. Primary: Standard Blob Link Trigger for Direct File Download
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
    }, 2000);

    return { success: true, method: 'download', message: `Saved ${fileName}` };
  } catch (blobErr) {
    console.warn('Blob direct download failed, trying data URI:', blobErr);
  }

  // 2. Fallback to Data URI Direct Download
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
    }, 1000);
    return { success: true, method: 'download', message: `Saved ${fileName}` };
  } catch (dataUriErr) {
    console.warn('Data URI download failed:', dataUriErr);
  }

  // 3. Fallback: Copy to clipboard so user data is never lost
  const copied = await copyTextToClipboard(content);
  if (copied) {
    return {
      success: true,
      method: 'clipboard',
      message: 'File content copied to clipboard! (Browser blocked direct file saving)',
    };
  }

  return {
    success: false,
    method: 'failed',
    message: 'Could not automatically trigger download in this browser sandbox.',
  };
}

export async function downloadBlobFile(
  blob: Blob,
  fileName: string
): Promise<{ success: boolean; method: 'download' | 'failed'; message: string }> {
  // 1. Primary: Direct Download via Blob Object URL
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
    }, 3000);

    return { success: true, method: 'download', message: `Saved ${fileName}` };
  } catch (blobErr) {
    console.warn('Blob direct download failed, trying FileReader data URI:', blobErr);
  }

  // 2. Fallback: FileReader Data URI Download
  try {
    const reader = new FileReader();
    return new Promise((resolve) => {
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
          }, 1500);
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
  } catch (err) {
    console.error('Data URI download failed:', err);
    return { success: false, method: 'failed', message: 'Download failed in this browser sandbox' };
  }
}

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
    console.warn('Web Share failed, falling back to direct download:', shareErr);
  }

  // Fallback to direct download if share is not supported
  const dlRes = await downloadBlobFile(blob, fileName);
  return { success: dlRes.success, message: dlRes.message };
}

export async function downloadJSONBackup(
  data: any,
  fileNamePrefix: string = 'mandi-backup'
): Promise<{ success: boolean; method: string; message: string }> {
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `${fileNamePrefix}-${dateStr}.json`;
  const jsonStr = JSON.stringify(data, null, 2);
  return downloadTextFile(jsonStr, fileName, 'application/json;charset=utf-8');
}

export async function downloadCSV(
  csvContent: string,
  fileNamePrefix: string = 'mandi-report'
): Promise<{ success: boolean; method: string; message: string }> {
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `${fileNamePrefix}-${dateStr}.csv`;
  // Add UTF-8 BOM so Excel opens Urdu and special characters cleanly
  const bomCsv = '\uFEFF' + csvContent;
  return downloadTextFile(bomCsv, fileName, 'text/csv;charset=utf-8');
}
