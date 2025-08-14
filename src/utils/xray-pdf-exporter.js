import { slotConfigurations } from '../xray-config';
// The font files are still needed for embedding
import { RobotoRegular } from './fonts/Roboto-Regular';
import { RobotoBold } from './fonts/Roboto-Bold';
import { RobotoSlabRegular } from './fonts/RobotoSlab-Regular';

// This function ensures the jsPDF libraries are loaded before we try to use them.
const loadScripts = () => {
    return new Promise((resolve, reject) => {
        if (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.autoTable) {
            resolve();
            return;
        }

        const jspdfScript = document.createElement('script');
        jspdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        jspdfScript.async = true;
        document.body.appendChild(jspdfScript);

        jspdfScript.onload = () => {
            const autotableScript = document.createElement('script');
            autotableScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.js';
            autotableScript.async = true;
            document.body.appendChild(autotableScript);
            autotableScript.onload = resolve;
            autotableScript.onerror = reject;
        };
        jspdfScript.onerror = reject;
    });
};

// --- Configuration ---
const PDF_EXPORT_ORDER = [
    0, 1, 6, 7, 8, 12, 13, // Maxillary PA
    4, 5, 9, 10, 11, 16, 17, // Mandibular PA
    2, 3, 14, 15, // Bitewings
];

const pointColors = {
    '#00FFFF': 'Crown Tip',
    '#FF00FF': 'CEJ',
    '#FFFF00': 'Bone Level',
    '#00FF00': 'Root Apex',
    '#FFA500': 'Physiologic Bone'
};

const severityConfig = {
    'Mild': { color: [220, 252, 231] },
    'Moderate': { color: [254, 243, 199] },
    'Severe': { color: [254, 226, 226] },
    // Bitewing Fallbacks
    'Normal (N)': { color: [220, 252, 231] },
    'Early (E)': { color: [254, 243, 199] },
    'Moderate (M)': { color: [254, 226, 226] },
    'Advanced (A)': { color: [254, 202, 202] },
};


// --- Helper Functions ---

const createAnnotatedImage = (base64Image, reports) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            reports.forEach(report => {
                const [axisStart, axisEnd] = report.axis;
                ctx.beginPath();
                ctx.moveTo(axisStart.x, axisStart.y);
                ctx.lineTo(axisEnd.x, axisEnd.y);
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2;
                ctx.stroke();

                report.annotations.forEach((p, i) => {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 6, 0, 2 * Math.PI);
                    ctx.fillStyle = Object.keys(pointColors)[i] || '#FFFFFF';
                    ctx.fill();
                });
            });
            resolve(canvas.toDataURL('image/png'));
        };
        img.src = base64Image;
    });
};

const addHeader = (doc, patientInfo) => {
    doc.setFont('Roboto-Bold');
    doc.setFontSize(16);
    doc.text('Periodontal Radiographic Analysis', 105, 20, { align: 'center' });

    doc.setFont('Roboto-Regular');
    doc.setFontSize(11);
    doc.text(`Patient HN: ${patientInfo.patientHN || 'N/A'}`, 15, 32);
    const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(`Date: ${reportDate}`, 210 - 15, 32, { align: 'right' });
    doc.text(`Patient Name: ${patientInfo.patientName || 'N/A'}`, 15, 38);
    
    doc.setDrawColor(200);
    doc.line(15, 45, 195, 45);
};

// MODIFIED: Removed the Severity Legend
const addLegends = (doc, startY) => {
    doc.setFont('Roboto-Bold');
    doc.setFontSize(10);
    doc.text('Annotation Legend', 15, startY);
    
    let xOffset = 15;
    Object.entries(pointColors).forEach(([color, label]) => {
        doc.setFillColor(color);
        doc.rect(xOffset, startY + 3, 3, 3, 'F');
        doc.setFont('Roboto-Regular');
        doc.setFontSize(9);
        doc.text(label, xOffset + 5, startY + 5.5);
        xOffset += 35;
    });
};

const addFootnotes = (doc) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont('Roboto-Regular');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("¹ RBL% (Staging) = (CEJ to Alveolar Crest) / (CEJ to Apex) × 100.", 15, pageHeight - 15);
    doc.text("² Adj. RBL% (Severity) = (Physiologic Bone Level to Alveolar Crest) / (Physiologic Bone Level to Apex) × 100.", 15, pageHeight - 10);
};

const addSlotPage = async (doc, slotData) => {
    const { slot, config } = slotData;
    const annotatedImage = await createAnnotatedImage(slot.processedImage, slot.reports);

    doc.setFont('RobotoSlab-Regular');
    doc.setFontSize(12);
    const filmType = config.analysisType === 'PA' ? '(Periapical)' : '(Bitewing)';
    doc.text(`Study: ${config.label} ${filmType}`, 15, 58);

    const imgWidth = 85;
    const imgHeight = config.isVertical ? (imgWidth * 4) / 3 : (imgWidth * 3) / 4;
    const imgStartY = 65;

    doc.setFont('Roboto-Regular');
    doc.setFontSize(10);
    doc.text('Annotated Image', 15, imgStartY - 2);
    doc.addImage(annotatedImage, 'PNG', 15, imgStartY, imgWidth, imgHeight);
    
    doc.text('Unannotated Image', 110, imgStartY - 2);
    doc.addImage(slot.processedImage, 'PNG', 110, imgStartY, imgWidth, imgHeight);

    const legendsY = imgStartY + imgHeight + 8;
    addLegends(doc, legendsY);

    // MODIFIED: Reordered table headers
    const tableHeaders = [['Site', 'Loss (mm)', 'C:R Ratio', 'RBL%¹', 'Stage', 'Adj. RBL%²', 'Severity']];
    
    // MODIFIED: Reordered table body data to match new headers
    const tableBody = slot.reports
      .sort((a, b) => parseInt(a.toothNumber) - parseInt(b.toothNumber) || a.side.localeCompare(b.side))
      .map(r => [
        `${r.toothNumber}-${r.side}`,
        r.attachmentLossMm,
        r.crownRootRatio,
        r.rblPercentForStaging !== -1 ? `${r.rblPercentForStaging}%` : 'N/A',
        r.stage || r.prognosis,
        r.adjustedRblPercent !== undefined ? `${r.adjustedRblPercent}%` : 'N/A',
        r.severity || 'N/A',
      ]);

    doc.autoTable({
        head: tableHeaders,
        body: tableBody,
        startY: legendsY + 12,
        theme: 'grid',
        styles: { font: 'Roboto-Regular', fontSize: 9 },
        headStyles: { font: 'Roboto-Bold', fillColor: [22, 78, 99], textColor: 255 },
        didParseCell: (data) => {
            // This logic now checks both the Stage and Severity columns for color coding
            const stage = data.row.raw[4]; // New position for Stage
            const severity = data.row.raw[6]; // New position for Severity
            let colorKey = null;

            if (stage && (stage.includes('III') || stage.includes('Advanced'))) {
                colorKey = 'Severe';
            } else if (stage && (stage.includes('II') || stage.includes('Moderate'))) {
                colorKey = 'Moderate';
            } else if (stage && (stage.includes('I') || stage.includes('Early'))) {
                colorKey = 'Mild';
            }
            
            // Allow severity column to also have color
            if (severityConfig[severity]) {
                colorKey = severity;
            }

            if (colorKey && severityConfig[colorKey]) {
                data.cell.styles.fillColor = severityConfig[colorKey].color;
            }
        },
    });
};

// --- Main Export Function ---
export const exportXRayReportAsPdf = async (appState) => {
    await loadScripts();

    const { slots, patientHN, patientName } = appState;
    
    const processedSlots = PDF_EXPORT_ORDER
        .map(id => ({ slot: slots[id], config: slotConfigurations[id] }))
        .filter(item => item.slot.processedImage && item.slot.reports.length > 0);

    if (processedSlots.length === 0) {
        alert("No analyzed X-rays to export. Please process at least one image.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    doc.addFileToVFS('Roboto-Regular.ttf', RobotoRegular);
    doc.addFont('Roboto-Regular.ttf', 'Roboto-Regular', 'normal');
    doc.addFileToVFS('Roboto-Bold.ttf', RobotoBold);
    doc.addFont('Roboto-Bold.ttf', 'Roboto-Bold', 'normal');
    doc.addFileToVFS('RobotoSlab-Regular.ttf', RobotoSlabRegular);
    doc.addFont('RobotoSlab-Regular.ttf', 'RobotoSlab-Regular', 'normal');
    
    const patientInfo = { patientHN, patientName };

    for (let i = 0; i < processedSlots.length; i++) {
        if (i > 0) doc.addPage();
        addHeader(doc, patientInfo);
        await addSlotPage(doc, processedSlots[i]);
        addFootnotes(doc);
    }
    
    const fileName = `${patientHN || 'NoHN'}-${patientName || 'NoName'}-XRay-Detailed-Report.pdf`;
    doc.save(fileName);
};