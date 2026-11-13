const pdfParse = require('pdf-parse');

// Utils layer: parses raw PDF buffer and extracts normalized text.
const extractTextFromPdf = async (pdfBuffer) => {
  const parsed = await pdfParse(pdfBuffer);
  return (parsed.text || '').replace(/\s+/g, ' ').trim();
};

module.exports = extractTextFromPdf;
