'use client';

import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface PdfExportButtonProps {
    targetId: string;
    filename?: string;
    className?: string;
}

export function PdfExportButton({ targetId, filename = 'movitty-report.pdf', className }: PdfExportButtonProps) {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        const element = document.getElementById(targetId);
        if (!element) {
            console.error(`Element with id ${targetId} not found`);
            return;
        }

        try {
            setIsExporting(true);

            // Hide UI elements we don't want in the PDF (if we had them using a specific class)
            // For now, html2canvas will capture what's visible

            // Add a temporary class to the body if we want to force light mode or specific print styles
            // document.body.classList.add('pdf-exporting');

            const canvas = await html2canvas(element, {
                scale: 2, // Higher resolution
                useCORS: true, // Allow loading cross-origin images (important for VIN images)
                backgroundColor: '#111118', // Match our surface-dark background to ensure contrast is kept
                windowWidth: 1200, // Force a desktop-like width even if exporting from mobile
            });

            // document.body.classList.remove('pdf-exporting');

            const imgData = canvas.toDataURL('image/png');

            // Calculate PDF dimensions based on A4 size and image aspect ratio
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            // Optional: If height > A4 height, add pages (simplistic approach: just fit to width and let it flow down)

            let position = 0;
            const pageHeight = pdf.internal.pageSize.getHeight();

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);

            // Handle multiple pages if the content is very long
            let heightLeft = pdfHeight - pageHeight;
            while (heightLeft >= 0) {
                position = heightLeft - pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(filename);

        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("No se pudo generar el PDF. Verifica la consola.");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <button
            onClick={handleExport}
            disabled={isExporting}
            className={`flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors font-semibold text-sm border border-white/10 shadow-glass ${className || ''}`}
        >
            {isExporting ? (
                <><span className="spinner w-4 h-4 border-2"></span> Generando...</>
            ) : (
                <><span className="material-symbols-outlined text-sm">picture_as_pdf</span> Exportar PDF</>
            )}
        </button>
    );
}
