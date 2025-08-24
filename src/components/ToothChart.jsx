// src/components/ToothChart.jsx
import React from 'react';
import Tooth from './Tooth';
import { UPPER_RIGHT, UPPER_LEFT, LOWER_LEFT, LOWER_RIGHT } from '../chart.config';

// Helper to convert furcation value to Roman numeral
const roman = (n) => (n == null ? '' : ['', 'I', 'II', 'III'][Number(n)] || '');

// NEW: Utility function to determine the Periodontitis diagnosis
const getPeriodontalDiagnosis = (toothData) => {
    if (!toothData || !toothData.pd || !toothData.re) return { dx: '', px: '-' };

    const pdValues = Object.values(toothData.pd).filter(v => v !== null);
    const reValues = Object.values(toothData.re).filter(v => v !== null);

    if (pdValues.length === 0) return { dx: '', px: '-' };

    const maxPd = Math.max(0, ...pdValues);

    // Calculate CAL for each site and find the max
    let maxCal = 0;
    const allSites = ['db', 'b', 'mb', 'dl', 'l', 'ml'];
    allSites.forEach(site => {
        const pd = toothData.pd[site] ?? 0;
        const re = toothData.re[site] ?? 0;
        if (pd > 0) { // Only consider sites with probing
             maxCal = Math.max(maxCal, pd + re);
        }
    });

    // Determine severity level based on PD
    let pdSeverity = 0; // 0: None, 1: Early, 2: Moderate, 3: Advanced
    if (maxPd >= 7) {
        pdSeverity = 3;
    } else if (maxPd >= 5) { // PD is 5 or 6
        pdSeverity = 2;
    } else if (maxPd > 0) { // PD is 1-4
        pdSeverity = 1;
    }

    // Determine severity level based on CAL
    let calSeverity = 0; // 0: None, 1: Early, 2: Moderate, 3: Advanced
    if (maxCal >= 5) {
        calSeverity = 3;
    } else if (maxCal >= 3) { // CAL is 3 or 4
        calSeverity = 2;
    } else if (maxCal >= 1) { // CAL is 1 or 2
        calSeverity = 1;
    }

    // The final diagnosis is the most severe of the two
    const finalSeverity = Math.max(pdSeverity, calSeverity);

    let dx = '';
    switch (finalSeverity) {
        case 1: dx = 'E'; break;
        case 2: dx = 'M'; break;
        case 3: dx = 'A'; break;
        default: dx = '';
    }

    return { dx, px: '-' };
};


// NEW: A dedicated component to format and display combined furcation data
const FurcationDataRow = ({ teeth, data, label, onDataCellClick, missingTeeth = [] }) => {
    
    const formatFurcation = (toothData) => {
        if (!toothData || !toothData.f) return '–';

        const { b, l, mli, dli } = toothData.f;
        const parts = [];
        
        if (b) parts.push(`${roman(b)}(B)`);
        if (l) parts.push(`${roman(l)}(Li)`);
        if (mli) parts.push(`${roman(mli)}(MLi)`);
        if (dli) parts.push(`${roman(dli)}(DLi)`);

        return parts.length > 0 ? parts.join('/') : '–';
    };

    return (
        <div className="flex items-center">
            <div className="w-10 text-right pr-2 text-blue-600 font-semibold text-xs">{label}</div>
            <div className="flex-1 flex bg-gray-50 border border-gray-200 rounded-sm">
                <div className="flex flex-1">
                    {teeth.slice(0, 8).map(toothId =>
                        missingTeeth.includes(toothId)
                            ? <div key={toothId} className="flex-1 border-r border-gray-200"></div>
                            : <div key={`${toothId}-f`} className="flex-1 hover:bg-blue-50 cursor-pointer" onClick={() => onDataCellClick(toothId, 'lingual')}>
                                <SingleValueCell value={formatFurcation(data[toothId])} />
                              </div>
                    )}
                </div>
                <div className="w-4 bg-white" />
                <div className="flex flex-1">
                    {teeth.slice(8).map(toothId =>
                        missingTeeth.includes(toothId)
                            ? <div key={toothId} className="flex-1 border-r border-gray-200"></div>
                            : <div key={`${toothId}-f-r`} className="flex-1 hover:bg-blue-50 cursor-pointer" onClick={() => onDataCellClick(toothId, 'lingual')}>
                                <SingleValueCell value={formatFurcation(data[toothId])} />
                              </div>
                    )}
                </div>
            </div>
        </div>
    );
};


const SingleValueCell = ({ value }) => (
  <div className="flex-1 h-6 flex items-center justify-center text-xs font-mono border-r border-gray-200 last:border-r-0">
    {value ?? '–'}
  </div>
);

// UPDATED: DxPxRow now calculates and displays the diagnosis
const DxPxRow = ({ teeth, data, label, onDataCellClick, missingTeeth = [] }) => (
    <div className="flex items-center">
        <div className="w-10 text-right pr-2 text-blue-600 font-semibold text-xs">{label}</div>
        <div className="flex-1 flex bg-gray-50 border border-gray-200 rounded-sm">
            <div className="flex flex-1">
                {teeth.slice(0, 8).map(toothId => {
                    // If dxpx is saved, use it. Otherwise, calculate it.
                    const displayValue = data[toothId]?.dxpx || `${getPeriodontalDiagnosis(data[toothId]).dx}/-`;
                    
                    return missingTeeth.includes(toothId)
                        ? <div key={toothId} className="flex-1 border-r border-gray-200"></div>
                        : <div key={`${toothId}-dxpx`} className="flex-1 hover:bg-blue-50 cursor-pointer" onClick={() => onDataCellClick(toothId)}>
                            <SingleValueCell value={displayValue} />
                          </div>;
                })}
            </div>
            <div className="w-4 bg-white" />
            <div className="flex flex-1">
                {teeth.slice(8).map(toothId => {
                    const displayValue = data[toothId]?.dxpx || `${getPeriodontalDiagnosis(data[toothId]).dx}/-`;

                    return missingTeeth.includes(toothId)
                        ? <div key={toothId} className="flex-1 border-r border-gray-200"></div>
                        : <div key={`${toothId}-dxpx-r`} className="flex-1 hover:bg-blue-50 cursor-pointer" onClick={() => onDataCellClick(toothId)}>
                            <SingleValueCell value={displayValue} />
                          </div>;
                })}
            </div>
        </div>
    </div>
);

// Single value per tooth, but for a specific side (here we’ll use for MO on lingual)
const SingleSideRow = ({ teeth, data, label, field, side, onDataCellClick, missingTeeth=[] }) => (
  <div className="flex items-center">
    <div className="w-10 text-right pr-2 text-blue-600 font-semibold text-xs">{label}</div>
    <div className="flex-1 flex bg-gray-50 border border-gray-200 rounded-sm">
      <div className="flex flex-1">
        {teeth.slice(0,8).map(toothId =>
          missingTeeth.includes(toothId)
            ? <div key={toothId} className="flex-1 border-r border-gray-200"></div>
            : <div key={`${toothId}-${field}-${side}`} className="flex-1 hover:bg-blue-50 cursor-pointer" onClick={() => onDataCellClick(toothId, side)}>
                <SingleValueCell value={data[toothId]?.[field]?.[side === 'lingual' ? 'l' : 'b']} />
              </div>
        )}
      </div>
      <div className="w-4 bg-white" />
      <div className="flex flex-1">
        {teeth.slice(8).map(toothId =>
          missingTeeth.includes(toothId)
            ? <div key={toothId} className="flex-1 border-r border-gray-200"></div>
            : <div key={`${toothId}-${field}-${side}-r`} className="flex-1 hover:bg-blue-50 cursor-pointer" onClick={() => onDataCellClick(toothId, side)}>
                <SingleValueCell value={data[toothId]?.[field]?.[side === 'lingual' ? 'l' : 'b']} />
              </div>
        )}
      </div>
    </div>
  </div>
);
// Renders a cell with 3 data points
const DataCell = ({ values, field }) => (
  <div className="flex-1 h-6 flex justify-around items-center text-xs font-mono border-r border-gray-200 last:border-r-0">
    {values.map((val, i) => (
      <span
        key={i}
        className={`flex-1 text-center ${
          field === 'pd' && val >= 4 ? 'text-red-500 font-bold' : ''
        }`}
      >
        {val ?? '-'}
      </span>
    ))}
  </div>
);

// Renders a cell with a single data point
const MGJDataCell = ({ value }) => (
    <div className="flex-1 h-6 flex justify-center items-center text-xs font-mono border-r border-gray-200 last:border-r-0">
        <span>{value ?? '-'}</span>
    </div>
);

// Renders a full row for PD or RE data
const DataRow = ({ teeth, data, field, siteKeys, label, surface, missingTeeth=[], onDataCellClick }) => {
    const isLeftSideTooth = (toothId) => UPPER_LEFT.includes(toothId) || LOWER_LEFT.includes(toothId);

    return (
        <div className="flex items-center">
            <div className="w-10 text-right pr-2 text-blue-600 font-semibold text-xs">{label}</div>
            <div className="flex-1 flex bg-gray-50 border border-gray-200 rounded-sm">
                <div className="flex flex-1">
                    {teeth.slice(0, 8).map(toothId => {
                        const displaySiteKeys = isLeftSideTooth(toothId) ? [...siteKeys].reverse() : siteKeys;
                        return missingTeeth.includes(toothId)
                            ? <div key={toothId} className="flex-1 border-r border-gray-200"></div>
                            : <div key={`${toothId}-${field}`} className="flex-1 cursor-pointer hover:bg-blue-100" onClick={() => onDataCellClick(toothId, surface)}>
                                  <DataCell values={displaySiteKeys.map(site => data[toothId]?.[field]?.[site])} field={field} />
                              </div>
                    })}
                </div>
                <div className="w-4 bg-white"></div>
                <div className="flex flex-1">
                    {teeth.slice(8).map(toothId => {
                        const displaySiteKeys = isLeftSideTooth(toothId) ? [...siteKeys].reverse() : siteKeys;
                        return missingTeeth.includes(toothId)
                            ? <div key={toothId} className="flex-1 border-r border-gray-200"></div>
                            : <div key={`${toothId}-${field}`} className="flex-1 cursor-pointer hover:bg-blue-100" onClick={() => onDataCellClick(toothId, surface)}>
                                  <DataCell values={displaySiteKeys.map(site => data[toothId]?.[field]?.[site])} field={field} />
                              </div>
                    })}
                </div>
            </div>
        </div>
    );
};

// Renders a full row for MGJ data
const MGJDataRow = ({ teeth, data, label, missingTeeth=[], onDataCellClick }) => (
    <div className="flex items-center">
        <div className="w-10 text-right pr-2 text-blue-600 font-semibold text-xs">{label}</div>
        <div className="flex-1 flex bg-gray-50 border border-gray-200 rounded-sm">
            <div className="flex flex-1">
                {teeth.slice(0, 8).map(toothId => 
                    missingTeeth.includes(toothId) 
                        ? <div key={toothId} className="flex-1 border-r border-gray-200"></div> 
                        : <div key={`${toothId}-mgj`} className="flex-1 cursor-pointer hover:bg-blue-100" onClick={() => onDataCellClick(toothId, 'buccal')}>
                              <MGJDataCell value={data[toothId]?.mgj?.b} />
                          </div>
                )}
            </div>
            <div className="w-4 bg-white"></div>
            <div className="flex flex-1">
                 {teeth.slice(8).map(toothId => 
                    missingTeeth.includes(toothId) 
                        ? <div key={toothId} className="flex-1 border-r border-gray-200"></div> 
                        : <div key={`${toothId}-mgj`} className="flex-1 cursor-pointer hover:bg-blue-100" onClick={() => onDataCellClick(toothId, 'buccal')}>
                              <MGJDataCell value={data[toothId]?.mgj?.b} />
                          </div>
                )}
            </div>
        </div>
    </div>
);


const ToothChart = ({ data, onSiteClick, activeSite, missingTeeth, isEditMode, onDataCellClick, onDxPxClick }) => {
  const buccalSites = ['db', 'b', 'mb'];
  const lingualSites = ['dl', 'l', 'ml'];

  const renderQuadrant = (teeth, surface, arch) => (
    <div className="flex flex-1">
      {teeth.map(toothId => (
        <div key={`${toothId}-${surface}`} className="flex-1">
          {missingTeeth.includes(toothId) ? (
            <div className={`h-full flex items-center justify-center ${isEditMode ? 'bg-gray-200 cursor-pointer' : ''}`} onClick={() => isEditMode && onSiteClick(toothId)}>
              {isEditMode && <span className="text-gray-400 text-xs select-none">Missing</span>}
            </div>
          ) : (
            <Tooth
              toothId={toothId} surface={surface} arch={arch} toothData={data[toothId]}
              onSiteClick={onSiteClick} activeSite={activeSite} isEditMode={isEditMode}
            />
          )}
        </div>
      ))}
    </div>
  );
  
  return (
    <div className="bg-white p-4 rounded-xl shadow-lg">
      <div className="space-y-3">
        {/* === MAXILLARY (UPPER) ARCH === */}
        <div id="pdf-upper-arch">
        <div className="space-y-1">
          <DxPxRow  teeth={[...UPPER_RIGHT, ...UPPER_LEFT]}  data={data}  label="Dx/Px"  onDataCellClick={onDxPxClick} missingTeeth={missingTeeth} />
          <MGJDataRow teeth={[...UPPER_RIGHT, ...UPPER_LEFT]} data={data} label="MGJ" missingTeeth={missingTeeth} onDataCellClick={onDataCellClick} />
          <DataRow teeth={[...UPPER_RIGHT, ...UPPER_LEFT]} data={data} field="pd" siteKeys={buccalSites} label="PD" surface="buccal" missingTeeth={missingTeeth} onDataCellClick={onDataCellClick} />
          <DataRow teeth={[...UPPER_RIGHT, ...UPPER_LEFT]} data={data} field="re" siteKeys={buccalSites} label="RE" surface="buccal" missingTeeth={missingTeeth} onDataCellClick={onDataCellClick} />
          
          <div className="h-2"></div>
          <div className="flex justify-center items-center">
            <div className="w-10"></div>
            <div className="flex-1 flex">
              {renderQuadrant(UPPER_RIGHT, 'buccal', 'upper')}
              <div className="w-4 h-28 self-center"></div>
              {renderQuadrant(UPPER_LEFT, 'buccal', 'upper')}
            </div>
          </div>
        </div>
        <div className="space-y-1 pt-3 border-t-4 border-gray-200">
          <div className="h-2"></div>
          <div className="flex justify-center items-center">
             <div className="w-10"></div>
             <div className="flex-1 flex">
                {renderQuadrant(UPPER_RIGHT, 'lingual', 'upper')}
                <div className="w-4 h-28 self-center"></div>
                {renderQuadrant(UPPER_LEFT, 'lingual', 'upper')}
             </div>
          </div>
            <SingleSideRow
                teeth={[...UPPER_RIGHT, ...UPPER_LEFT]}
                data={data}
                label="MO"
                field="mo"
                side="lingual"
                onDataCellClick={onDataCellClick}
                missingTeeth={missingTeeth}
            />
            <FurcationDataRow
                teeth={[...UPPER_RIGHT, ...UPPER_LEFT]}
                data={data}
                label="F"
                onDataCellClick={onDataCellClick}
                missingTeeth={missingTeeth}
            />
          <DataRow teeth={[...UPPER_RIGHT, ...UPPER_LEFT]} data={data} field="pd" siteKeys={lingualSites} label="PD" surface="lingual" missingTeeth={missingTeeth} onDataCellClick={onDataCellClick} />
          <DataRow teeth={[...UPPER_RIGHT, ...UPPER_LEFT]} data={data} field="re" siteKeys={lingualSites} label="RE" surface="lingual" missingTeeth={missingTeeth} onDataCellClick={onDataCellClick} />
        </div>
        </div>
        {/* === MANDIBULAR (LOWER) ARCH === */}
        <div id="pdf-lower-arch">
        <div className="space-y-1 pt-6 border-t-8 border-gray-200">
            <SingleSideRow
                teeth={[...LOWER_RIGHT, ...LOWER_LEFT]}
                data={data}
                label="MO"
                field="mo"
                side="lingual"
                onDataCellClick={onDataCellClick}
                missingTeeth={missingTeeth}
            />
            <FurcationDataRow
                teeth={[...LOWER_RIGHT, ...LOWER_LEFT]}
                data={data}
                label="F"
                onDataCellClick={onDataCellClick}
                missingTeeth={missingTeeth}
            />
            <DataRow teeth={[...LOWER_RIGHT, ...LOWER_LEFT]} data={data} field="re" siteKeys={lingualSites} label="RE" surface="lingual" missingTeeth={missingTeeth} onDataCellClick={onDataCellClick} />
            <DataRow teeth={[...LOWER_RIGHT, ...LOWER_LEFT]} data={data} field="pd" siteKeys={lingualSites} label="PD" surface="lingual" missingTeeth={missingTeeth} onDataCellClick={onDataCellClick} />
            <div className="h-2"></div>
            <div className="flex justify-center items-center">
                <div className="w-10"></div>
                <div className="flex-1 flex">
                    {renderQuadrant(LOWER_RIGHT, 'lingual', 'lower')}
                    <div className="w-4 h-28 self-center"></div>
                    {renderQuadrant(LOWER_LEFT, 'lingual', 'lower')}
                </div>
            </div>
        </div>
        <div className="space-y-1 pt-3 border-t-4 border-gray-200">
            <div className="h-2"></div>
            <div className="flex justify-center items-center">
                <div className="w-10"></div>
                <div className="flex-1 flex">
                    {renderQuadrant(LOWER_RIGHT, 'buccal', 'lower')}
                    <div className="w-4 h-28 self-center"></div>
                    {renderQuadrant(LOWER_LEFT, 'buccal', 'lower')}
                </div>
            </div>
            <DataRow teeth={[...LOWER_RIGHT, ...LOWER_LEFT]} data={data} field="re" siteKeys={buccalSites} label="RE" surface="buccal" missingTeeth={missingTeeth} onDataCellClick={onDataCellClick} />
            <DataRow teeth={[...LOWER_RIGHT, ...LOWER_LEFT]} data={data} field="pd" siteKeys={buccalSites} label="PD" surface="buccal" missingTeeth={missingTeeth} onDataCellClick={onDataCellClick} />
            <MGJDataRow teeth={[...LOWER_RIGHT, ...LOWER_LEFT]} data={data} label="MGJ" missingTeeth={missingTeeth} onDataCellClick={onDataCellClick} />
            <DxPxRow teeth={[...LOWER_RIGHT, ...LOWER_LEFT]} data={data} label="Dx/Px" onDataCellClick={onDxPxClick} missingTeeth={missingTeeth} />
        </div>
        </div>
      </div>
    </div>
  );
};

export default ToothChart;
