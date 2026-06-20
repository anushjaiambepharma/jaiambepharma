import { DOC_TYPE_LABEL, DOC_TYPE_FOLDER } from './constants.js';

export function sanitizeForFilename(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const MAX_BASENAME_LENGTH = 150;

/** Build "{DocumentType}_{PartyName}_{DocumentNumber}.pdf", deduping with _2, _3, ... */
export function buildFileName(docType, partyName, documentNumber, usedNames) {
  const label = DOC_TYPE_LABEL[docType] || docType;
  let base = `${label}_${sanitizeForFilename(partyName)}_${sanitizeForFilename(documentNumber)}`;
  if (base.length > MAX_BASENAME_LENGTH) base = base.slice(0, MAX_BASENAME_LENGTH);

  let name = `${base}.pdf`;
  let suffix = 2;
  while (usedNames.has(name)) {
    name = `${base}_${suffix}.pdf`;
    suffix += 1;
  }
  usedNames.add(name);
  return name;
}

export function folderFor(docType) {
  return DOC_TYPE_FOLDER[docType] || 'Other';
}
