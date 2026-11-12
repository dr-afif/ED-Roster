import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import type { MemoExportPayload } from './types';

/**
 * Format a date string (YYYY-MM-DD or ISO) into dd/mm/yyyy
 */
export function formatMemoDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Clean filename
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '_').replace(/_{2,}/g, '_');
}

/**
 * Generate and trigger download of the GHKA Memo DOCX.
 */
export async function generateGhkaMemoDocx(payload: MemoExportPayload): Promise<void> {
  const templateUrl = `${import.meta.env.BASE_URL}templates/ghka-memo-template.docx`;
  const response = await fetch(templateUrl);

  if (!response.ok) {
    throw new Error(`Failed to load template from ${templateUrl}: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const zip = new PizZip(arrayBuffer);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  const data = {
    NAME: (payload.applicantName || '').toUpperCase(),
    DATE: formatMemoDate(payload.memoDate),
    ID: payload.applicantStaffId || '',
    PHONE: payload.applicantPhone || '',
    EMAIL: payload.applicantEmail || '',
    rows: (payload.rows || []).map((r, index) => ({
      no: `${index + 1}.`,
      phDate: formatMemoDate(r.phDate),
      phName: r.phName || '',
      ghkaDate: formatMemoDate(r.ghkaDate),
      ghkaDay: r.ghkaDay || '',
    })),
  };

  doc.render(data);

  const blob = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  // Native browser download
  const cleanName = sanitizeFilename(payload.applicantName || 'Applicant');
  const filename = `GHKA Memo - ${cleanName} - ${payload.memoMonth}.docx`;

  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}
