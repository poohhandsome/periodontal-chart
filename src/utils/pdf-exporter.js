// src/utils/pdf-exporter.js
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ALL_TEETH } from '../chart.config';

// --- Image Preloader ---
const preloadToothImages = () => {
  const promises = ALL_TEETH.map(toothId => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = `/teeth/${toothId}.png`;
      img.onload = resolve;
      img.onerror = reject; // It's good practice to handle errors
    });
  });
  return Promise.all(promises);
};

// --- PDF Header Function ---
const addHeader = (pdf, patientHN, patientName) => {
  pdf.setFontSize(10);
  pdf.text(`Patient HN: ${patientHN || 'N/A'}`, 15, 15);
  pdf.text(`Patient Name: ${patientName || 'N/A'}`, 15, 22);
};

// --- A helper function to add a delay ---
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- Main PDF Export Logic ---
export const exportChartAsPdf = async (patientHN, patientName) => {
  const loadingIndicator = document.createElement('div');
  loadingIndicator.innerHTML = 'Generating PDF, please wait...';
  loadingIndicator.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 20px; background: white; border-radius: 10px; box-shadow: 0 0 15px rgba(0,0,0,0.2); z-index: 1000;';
  document.body.appendChild(loadingIndicator);

  try {
    await preloadToothImages();
    // --- ADDED A SMALL DELAY ---
    // This gives the browser a moment to render the images after preloading.
    await wait(100);

    const upperArch = document.getElementById('pdf-upper-arch');
    const lowerArch = document.getElementById('pdf-lower-arch');
    const summary = document.getElementById('chart-summary-pdf');

    if (!upperArch || !lowerArch || !summary) {
      alert("Could not find all chart elements to export.");
      return;
    }

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      putOnlyUsedFonts: true,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pdfWidth - (margin * 2);
    // --- INCREASED CAPTURE SCALE FOR LARGER FONT ---
    const canvasOptions = { scale: 3 }; 

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
    const summaryPdfWidth = pdfWidth / 2;
    const summaryPdfHeight = (summaryImgProps.height * summaryPdfWidth) / summaryImgProps.width;
    pdf.addImage(summaryImgData, 'PNG', margin, 30, summaryPdfWidth, summaryPdfHeight);

    const fileName = `${patientHN || 'NoHN'}-${patientName || 'NoName'}-Report.pdf`;
    pdf.save(fileName);

  } catch (error) {
    console.error("Error generating PDF:", error);
    alert("An error occurred while generating the PDF. Please try again.");
  } finally {
    document.body.removeChild(loadingIndicator);
  }
};