// src/components/ToothChart.jsx

import React from 'react';
import Tooth from './Tooth';
import { UPPER_RIGHT, UPPER_LEFT, LOWER_LEFT, LOWER_RIGHT } from '../chart.config';

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


const ToothChart = ({ data, onSiteClick, activeSite, missingTeeth, isEditMode, onDataCellClick }) => {
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
        <div className="space-y-1">
          <DataRow teeth={[...UPPER_RIGHT, ...UPPER_LEFT]} data={data} field="pd" siteKeys={buccalSites} label="PD" surface="buccal" missingTeeth={missingTeeth} onDataCellClick={onDataCellClick} />
          <DataRow teeth={[...UPPER_RIGHT, ...UPPER_LEFT]} data={data} field="re" siteKeys={buccalSites} label="RE" surface="buccal" missingTeeth={missingTeeth} onDataCellClick={onDataCellClick} />
          <MGJDataRow teeth={[...UPPER_RIGHT, ...UPPER_LEFT]} data={data} label="MGJ" missingTeeth={missingTeeth} onDataCellClick={onDataCellClick} />
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
          <DataRow teeth={[...UPPER_RIGHT, ...UPPER_LEFT]} data={data} field="pd" siteKeys={lingualSites} label="PD" surface="lingual" missingTeeth={missingTeeth} onDataCellClick={onDataCellClick} />
          <DataRow teeth={[...UPPER_RIGHT, ...UPPER_LEFT]} data={data} field="re" siteKeys={lingualSites} label="RE" surface="lingual" missingTeeth={missingTeeth} onDataCellClick={onDataCellClick} />
        </div>

        {/* === MANDIBULAR (LOWER) ARCH === */}
        <div className="space-y-1 pt-6 border-t-8 border-gray-200">
            <DataRow teeth={[...LOWER_RIGHT, ...LOWER_LEFT]} data={data} field="pd" siteKeys={lingualSites} label="PD" surface="lingual" missingTeeth={missingTeeth} onDataCellClick={onDataCellClick} />
            <DataRow teeth={[...LOWER_RIGHT, ...LOWER_LEFT]} data={data} field="re" siteKeys={lingualSites} label="RE" surface="lingual" missingTeeth={missingTeeth} onDataCellClick={onDataCellClick} />
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
            <DataRow teeth={[...LOWER_RIGHT, ...LOWER_LEFT]} data={data} field="pd" siteKeys={buccalSites} label="PD" surface="buccal" missingTeeth={missingTeeth} onDataCellClick={onDataCellClick} />
            <DataRow teeth={[...LOWER_RIGHT, ...LOWER_LEFT]} data={data} field="re" siteKeys={buccalSites} label="RE" surface="buccal" missingTeeth={missingTeeth} onDataCellClick={onDataCellClick} />
            <MGJDataRow teeth={[...LOWER_RIGHT, ...LOWER_LEFT]} data={data} label="MGJ" missingTeeth={missingTeeth} onDataCellClick={onDataCellClick} />
        </div>
      </div>
    </div>
  );
};

export default ToothChart;