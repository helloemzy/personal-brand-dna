// PDF generation helper utilities

export const pdfBrandColors = {
  primary: '#2563eb',
  secondary: '#7c3aed',
  accent: '#10b981',
  dark: '#111827',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  white: '#ffffff'
};

export const pdfFontSizes = {
  hero: 36,
  title: 32,
  subtitle: 24,
  section: 18,
  heading: 16,
  subheading: 14,
  body: 11,
  caption: 9,
  small: 8
};

export const pdfMargins = {
  page: [40, 60, 40, 60] as [number, number, number, number],
  section: [0, 20, 0, 20] as [number, number, number, number],
  paragraph: [0, 0, 0, 10] as [number, number, number, number],
  item: [0, 5, 0, 5] as [number, number, number, number]
};

// Helper to truncate text if too long
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Helper to format date
export function formatPDFDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

// Helper to clean text for PDF (remove special characters that might cause issues)
export function cleanTextForPDF(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'") // Smart quotes to regular quotes
    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes to regular quotes
    .replace(/\u2026/g, '...') // Ellipsis
    .replace(/[\u2013\u2014]/g, '-') // Em/en dash to regular dash
    .replace(/\u00A0/g, ' ') // Non-breaking space to regular space
    .trim();
}

// Helper to get archetype color
export function getArchetypeColor(archetypeId: string): string {
  const colorMap: Record<string, string> = {
    'innovative-leader': pdfBrandColors.primary,
    'empathetic-expert': pdfBrandColors.accent,
    'strategic-visionary': pdfBrandColors.secondary,
    'authentic-changemaker': '#f97316' // Orange
  };
  return colorMap[archetypeId] || pdfBrandColors.primary;
}

// Helper to format content pillars for PDF
export function formatContentPillarPercentage(percentage: number): string {
  return `${percentage}%`;
}

// Helper to create a safe filename
export function createPDFFilename(archetypeName: string): string {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const safeName = archetypeName.replace(/[^a-zA-Z0-9]/g, '-');
  return `BrandHouse-${safeName}-${timestamp}.pdf`;
}