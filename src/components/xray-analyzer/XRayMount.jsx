import React from 'react';
import XRaySlot from './XRaySlot';
import { slotConfigurations } from '../../xray-config';

const XRayMount = ({ slots, onSlotClick }) => {
    
    const renderSlot = (id) => {
        const config = slotConfigurations[id];
        return <XRaySlot 
            key={id} 
            slot={slots[id]} 
            onClick={onSlotClick} 
            isVertical={config.isVertical} 
            label={config.label}
        />
    }
    
    return (
        <div className="p-4 bg-white rounded-2xl shadow-xl w-full max-w-7xl mx-auto border border-gray-200">
            <div className="bg-gray-200 p-4 rounded-lg">
                <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
                    {/* Column 1 (Patient's Right) - 2 grid columns */}
                    <div className="lg:col-span-2 flex flex-col gap-2">
                        <div className="grid grid-cols-2 gap-2">{renderSlot(0)}{renderSlot(1)}</div>
                        <div className="grid grid-cols-2 gap-2">{renderSlot(2)}{renderSlot(3)}</div>
                        <div className="grid grid-cols-2 gap-2">{renderSlot(4)}{renderSlot(5)}</div>
                    </div>

                    {/* Column 2 (Anteriors) - 4 grid columns for better spacing */}
                    <div className="lg:col-span-3 flex flex-col gap-2 justify-between">
                         <div className="grid grid-cols-3 gap-2">
                             {renderSlot(6)}
                             {renderSlot(7)}
                             {renderSlot(8)}
                         </div>
                         <div className="grid grid-cols-3 gap-2">
                            {renderSlot(9)}
                            {renderSlot(10)}
                            {renderSlot(11)}
                        </div>
                    </div>

                    {/* Column 3 (Patient's Left) - 2 grid columns */}
                    <div className="lg:col-span-2 flex flex-col gap-2">
                        <div className="grid grid-cols-2 gap-2">{renderSlot(12)}{renderSlot(13)}</div>
                        <div className="grid grid-cols-2 gap-2">{renderSlot(14)}{renderSlot(15)}</div>
                        <div className="grid grid-cols-2 gap-2">{renderSlot(16)}{renderSlot(17)}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default XRayMount;
