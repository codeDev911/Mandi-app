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
): Promise<{ success: boolean; method: 'download' | 'share' | 'clipboard' | 'failed'; message: string }> {
  const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  // 1. Try Web Share API with File (Supported on mobile Chrome/Safari/PWA)
  if (isMobile && typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator) {
    try {
      const file = new File([content], fileName, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: fileName,
          text: `Backup file: ${fileName}`,
        });
        return { success: true, method: 'share', message: 'File shared successfully!' };
      }
    } catch (shareErr: any) {
      if (shareErr?.name === 'AbortError') {
        return { success: true, method: 'share', message: 'Share action completed.' };
      }
      console.warn('Web Share failed, falling back to direct download:', shareErr);
    }
  }

  // 2. Standard Blob Link Trigger
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
    }, 1000);

    return { success: true, method: 'download', message: `Saved ${fileName}` };
  } catch (blobErr) {
    console.warn('Blob download failed, trying data URI:', blobErr);
  }

  // 3. Fallback to Data URI
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
    }, 500);
    return { success: true, method: 'download', message: `Saved ${fileName}` };
  } catch (dataUriErr) {
    console.warn('Data URI download failed:', dataUriErr);
  }

  // 4. Ultimate Fallback: Copy to clipboard so data is NEVER lost
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
): Promise<{ success: boolean; method: 'download' | 'share' | 'failed'; message: string }> {
  const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  // 1. Try Web Share API with File (Supported on mobile Chrome/Safari/PWA/Capacitor)
  if (isMobile && typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator) {
    try {
      const file = new File([blob], fileName, { type: blob.type || 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: fileName,
        });
        return { success: true, method: 'share', message: 'File shared successfully!' };
      }
    } catch (shareErr: any) {
      if (shareErr?.name === 'AbortError') {
        return { success: true, method: 'share', message: 'Share action completed.' };
      }
      console.warn('Web Share failed, falling back to direct download:', shareErr);
    }
  }

  // 2. Standard Blob Link Trigger
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
    }, 2000);

    return { success: true, method: 'download', message: `Saved ${fileName}` };
  } catch (blobErr) {
    console.warn('Blob download failed, trying FileReader data URI:', blobErr);
  }

  // 3. Fallback to FileReader Data URI
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
          }, 1000);
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
