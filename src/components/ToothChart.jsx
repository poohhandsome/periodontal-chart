// src/components/ToothChart.jsx

import React, { useMemo } from 'react';
import Tooth from './Tooth';
import DirectionPointer from './DirectionPointer'; // Import the new component
import { UPPER_RIGHT, UPPER_LEFT, LOWER_LEFT, LOWER_RIGHT } from '../chart.config';

// Renders a cell with 3 data points, now with highlighting for PD >= 4mm
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

// Renders a cell with a single data point, centered (for MGJ)
const MGJDataCell = ({ value }) => (
    <div className="flex-1 h-6 flex justify-center items-center text-xs font-mono border-r border-gray-200 last:border-r-0">
        <span>{value ?? '-'}</span>
    </div>
);

// Renders a full row for PD or RE data, passing the 'field' down to DataCell
const DataRow = ({ teeth, data, field, siteKeys, label, missingTeeth=[] }) => (
  <div className="flex items-center">
    <div className="w-10 text-right pr-2 text-blue-600 font-semibold text-xs">{label}</div>
    <div className="flex-1 flex bg-gray-50 border border-gray-200 rounded-sm">
      <div className="flex flex-1">
        {teeth.slice(0, 8).map(toothId => 
          missingTeeth.includes(toothId) 
            ? <div key={toothId} className="flex-1 border-r border-gray-200"></div> 
            : <DataCell key={`${toothId}-${field}`} values={siteKeys.map(site => data[toothId]?.[field]?.[site])} field={field} />
        )}
      </div>
      <div className="w-4 bg-white"></div>
      <div className="flex flex-1">
        {teeth.slice(8).map(toothId => 
          missingTeeth.includes(toothId) 
            ? <div key={toothId} className="flex-1 border-r border-gray-200"></div> 
            : <DataCell key={`${toothId}-${field}`} values={siteKeys.map(site => data[toothId]?.[field]?.[site])} field={field} />
        )}
      </div>
    </div>
  </div>
);

// New component specifically for the MGJ data row
const MGJDataRow = ({ teeth, data, label, missingTeeth=[] }) => (
    <div className="flex items-center">
        <div className="w-10 text-right pr-2 text-blue-600 font-semibold text-xs">{label}</div>
        <div className="flex-1 flex bg-gray-50 border border-gray-200 rounded-sm">
            <div className="flex flex-1">
                {teeth.slice(0, 8).map(toothId => 
                    missingTeeth.includes(toothId) 
                        ? <div key={toothId} className="flex-1 border-r border-gray-200"></div> 
                        : <MGJDataCell key={`${toothId}-mgj`} value={data[toothId]?.mgj?.b} /> 
                )}
            </div>
            <div className="w-4 bg-white"></div>
            <div className="flex flex-1">
                 {teeth.slice(8).map(toothId => 
                    missingTeeth.includes(toothId) 
                        ? <div key={toothId} className="flex-1 border-r border-gray-200"></div> 
                        : <MGJDataCell key={`${toothId}-mgj`} value={data[toothId]?.mgj?.b} /> 
                )}
            </div>
        </div>
    </div>
);


const ToothChart = ({ data, onSiteClick, activeSite, missingTeeth, isEditMode }) => {
  const buccalSites = ['db', 'b', 'mb'];
  const lingualSites = ['dl', 'l', 'ml'];

  // This logic determines the current charting segment to show the direction pointer
  const activeSegmentInfo = useMemo(() => {
    if (!activeSite) return null;

    const { toothId, surface } = activeSite;
    const availableTeeth = (teeth) => teeth.filter(t => !missingTeeth.includes(t));

    const sequence = [
      { arch: 'upper', surface: 'buccal', teeth: availableTeeth(UPPER_RIGHT), reversed: false, quadrant: 'Q1'},
      { arch: 'upper', surface: 'lingual', teeth: availableTeeth(UPPER_RIGHT.slice().reverse()), reversed: true, quadrant: 'Q1'},
      { arch: 'upper', surface: 'buccal', teeth: availableTeeth(UPPER_LEFT), reversed: false, quadrant: 'Q2'},
      { arch: 'upper', surface: 'lingual', teeth: availableTeeth(UPPER_LEFT.slice().reverse()), reversed: true, quadrant: 'Q2'},
      { arch: 'lower', surface: 'lingual', teeth: availableTeeth(LOWER_LEFT.slice().reverse()), reversed: true, quadrant: 'Q3'},
      { arch: 'lower', surface: 'buccal', teeth: availableTeeth(LOWER_LEFT), reversed: false, quadrant: 'Q3'},
      { arch: 'lower', surface: 'lingual', teeth: availableTeeth(LOWER_RIGHT), reversed: false, quadrant: 'Q4'},
      { arch: 'lower', surface: 'buccal', teeth: availableTeeth(LOWER_RIGHT.slice().reverse()), reversed: true, quadrant: 'Q4'},
    ];
    
    const currentSegment = sequence.find(seg => seg.surface === surface && seg.teeth.includes(toothId));

    if (!currentSegment || currentSegment.teeth.length === 0) return null;

    const sites = surface === 'buccal' ? buccalSites : lingualSites;
    const startTooth = currentSegment.teeth[0];
    const endTooth = currentSegment.teeth[currentSegment.teeth.length - 1];
    const startSite = sites[0];
    const endSite = sites[sites.length - 1];

    return {
      ...currentSegment,
      startLabel: `${startTooth}${startSite.toUpperCase()}`,
      endLabel: `${endTooth}${endSite.toUpperCase()}`,
    };
  }, [activeSite, missingTeeth]);


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
  
  const renderPointer = (arch, surface) => {
    if (!activeSegmentInfo || activeSegmentInfo.arch !== arch || activeSegmentInfo.surface !== surface) {
      return null;
    }
    
    const isFullArch = ['Q1', 'Q2'].includes(activeSegmentInfo.quadrant) || ['Q3', 'Q4'].includes(activeSegmentInfo.quadrant);

    if (isFullArch) {
        const isRightSide = ['Q1', 'Q4'].includes(activeSegmentInfo.quadrant);
        const isLeftSide = ['Q2', 'Q3'].includes(activeSegmentInfo.quadrant);
        return (
            <div className="flex-1 flex">
                <div className="flex-1 relative">
                    {isRightSide && <DirectionPointer startLabel={activeSegmentInfo.startLabel} endLabel={activeSegmentInfo.endLabel} isReversed={activeSegmentInfo.reversed} />}
                </div>
                <div className="w-4"></div>
                <div className="flex-1 relative">
                    {isLeftSide && <DirectionPointer startLabel={activeSegmentInfo.startLabel} endLabel={activeSegmentInfo.endLabel} isReversed={activeSegmentInfo.reversed} />}
                </div>
            </div>
        );
    }
    return null;
  };


  return (
    <div className="bg-white p-4 rounded-xl shadow-lg">
      <div className="space-y-3">
        {/* === MAXILLARY (UPPER) ARCH === */}
        <div className="space-y-1">
          <DataRow teeth={[...UPPER_RIGHT, ...UPPER_LEFT]} data={data} field="pd" siteKeys={buccalSites} label="PD" missingTeeth={missingTeeth}/>
          <DataRow teeth={[...UPPER_RIGHT, ...UPPER_LEFT]} data={data} field="re" siteKeys={buccalSites} label="RE" missingTeeth={missingTeeth}/>
          <MGJDataRow teeth={[...UPPER_RIGHT, ...UPPER_LEFT]} data={data} label="MGJ" missingTeeth={missingTeeth}/>
          <div className="h-8 flex items-center">
            <div className="w-10"></div>
            {renderPointer('upper', 'buccal')}
          </div>
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
          <div className="h-8 flex items-center">
            <div className="w-10"></div>
            {renderPointer('upper', 'lingual')}
          </div>
          <div className="flex justify-center items-center">
             <div className="w-10"></div>
             <div className="flex-1 flex">
                {renderQuadrant(UPPER_RIGHT, 'lingual', 'upper')}
                <div className="w-4 h-28 self-center"></div>
                {renderQuadrant(UPPER_LEFT, 'lingual', 'upper')}
             </div>
          </div>
          <DataRow teeth={[...UPPER_RIGHT, ...UPPER_LEFT]} data={data} field="pd" siteKeys={lingualSites} label="PD" missingTeeth={missingTeeth}/>
          <DataRow teeth={[...UPPER_RIGHT, ...UPPER_LEFT]} data={data} field="re" siteKeys={lingualSites} label="RE" missingTeeth={missingTeeth}/>
        </div>

        {/* === MANDIBULAR (LOWER) ARCH === */}
        <div className="space-y-1 pt-6 border-t-8 border-gray-200">
            <DataRow teeth={[...LOWER_RIGHT, ...LOWER_LEFT]} data={data} field="pd" siteKeys={lingualSites} label="PD" missingTeeth={missingTeeth}/>
            <DataRow teeth={[...LOWER_RIGHT, ...LOWER_LEFT]} data={data} field="re" siteKeys={lingualSites} label="RE" missingTeeth={missingTeeth}/>
            <div className="h-8 flex items-center">
              <div className="w-10"></div>
              {renderPointer('lower', 'lingual')}
            </div>
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
            <div className="h-8 flex items-center">
              <div className="w-10"></div>
              {renderPointer('lower', 'buccal')}
            </div>
            <div className="flex justify-center items-center">
                <div className="w-10"></div>
                <div className="flex-1 flex">
                    {renderQuadrant(LOWER_RIGHT, 'buccal', 'lower')}
                    <div className="w-4 h-28 self-center"></div>
                    {renderQuadrant(LOWER_LEFT, 'buccal', 'lower')}
                </div>
            </div>
            <DataRow teeth={[...LOWER_RIGHT, ...LOWER_LEFT]} data={data} field="pd" siteKeys={buccalSites} label="PD" missingTeeth={missingTeeth}/>
            <DataRow teeth={[...LOWER_RIGHT, ...LOWER_LEFT]} data={data} field="re" siteKeys={buccalSites} label="RE" missingTeeth={missingTeeth}/>
            <MGJDataRow teeth={[...LOWER_RIGHT, ...LOWER_LEFT]} data={data} label="MGJ" missingTeeth={missingTeeth}/>
        </div>
      </div>
    </div>
  );
};

export default ToothChart;
