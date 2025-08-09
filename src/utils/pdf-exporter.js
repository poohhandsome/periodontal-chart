// src/utils/pdf-exporter.js
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ALL_TEETH } from '../chart.config';

// --- Image Preloader ---
// This function ensures all tooth images are loaded before we try to render them.
const preloadToothImages = () => {
  const promises = ALL_TEETH.map(toothId => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = `/teeth/${toothId}.png`;
      img.onload = resolve;
      img.onerror = reject;
    });
  });
  return Promise.all(promises);
};

// --- PDF Header Function ---
// This adds the patient info to the top-left of each page.
const addHeader = (pdf, patientHN, patientName) => {
  pdf.setFontSize(10);
  pdf.text(`Patient HN: ${patientHN || 'N/A'}`, 15, 15);
  pdf.text(`Patient Name: ${patientName || 'N/A'}`, 15, 22);
};

// --- Main PDF Export Logic ---
export const exportChartAsPdf = async (patientHN, patientName) => {
  const loadingIndicator = document.createElement('div');
  loadingIndicator.innerHTML = 'Generating PDF, please wait...';
  loadingIndicator.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 20px; background: white; border-radius: 10px; box-shadow: 0 0 15px rgba(0,0,0,0.2); z-index: 1000;';
  document.body.appendChild(loadingIndicator);

  try {
    // 1. Preload images to ensure they appear in the PDF
    await preloadToothImages();

    // 2. Find the required elements
    const upperArch = document.getElementById('pdf-upper-arch');
    const lowerArch = document.getElementById('pdf-lower-arch');
    const summary = document.getElementById('chart-summary-pdf');

    if (!upperArch || !lowerArch || !summary) {
      alert("Could not find all chart elements to export.");
      return;
    }

    // 3. Initialize jsPDF in Landscape mode
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pdfWidth - (margin * 2);
    const canvasOptions = { scale: 2.5 }; // Increased scale for bigger font/better quality

    // --- Page 1: Upper Arch (Q1 & Q2) ---
    addHeader(pdf, patientHN, patientName);
    const upperCanvas = await html2canvas(upperArch, canvasOptions);
    const upperImgData = upperCanvas.toDataURL('image/png');
    const upperImgProps = pdf.getImageProperties(upperImgData);
    const upperPdfHeight = (upperImgProps.height * contentWidth) / upperImgProps.width;
    pdf.addImage(upperImgData, 'PNG', margin, 30, contentWidth, upperPdfHeight);
    
    // --- Page 2: Lower Arch (Q3 & Q4) ---
    pdf.addPage();
    addHeader(pdf, patientHN, patientName);
    const lowerCanvas = await html2canvas(lowerArch, canvasOptions);
    const lowerImgData = lowerCanvas.toDataURL('image/png');
    const lowerImgProps = pdf.getImageProperties(lowerImgData);
    const lowerPdfHeight = (lowerImgProps.height * contentWidth) / lowerImgProps.width;
    pdf.addImage(lowerImgData, 'PNG', margin, 30, contentWidth, lowerPdfHeight);

    // --- Page 3: Summary ---
    pdf.addPage();
    addHeader(pdf, patientHN, patientName);
    const summaryCanvas = await html2canvas(summary, canvasOptions);
    const summaryImgData = summaryCanvas.toDataURL('image/png');
    const summaryImgProps = pdf.getImageProperties(summaryImgData);
    const summaryPdfWidth = pdfWidth / 2; // Center the summary
    const summaryPdfHeight = (summaryImgProps.height * summaryPdfWidth) / summaryImgProps.width;
    pdf.addImage(summaryImgData, 'PNG', margin, 30, summaryPdfWidth, summaryPdfHeight);

    // 4. Save the final PDF
    const fileName = `${patientHN || 'NoHN'}-${patientName || 'NoName'}-Report.pdf`;
    pdf.save(fileName);

  } catch (error) {
    console.error("Error generating PDF:", error);
    alert("An error occurred while generating the PDF.");
  } finally {
    document.body.removeChild(loadingIndicator);
  }
};