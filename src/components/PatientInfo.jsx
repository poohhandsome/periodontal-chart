// src/components/PatientInfo.jsx
import React from 'react';

const PatientInfo = ({ patientHN, setPatientHN, patientName, setPatientName }) => {
  return (
    <div className="mb-4 bg-white p-4 rounded-xl shadow-lg">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="patientHN" className="block text-sm font-medium text-gray-700">
            Patient HN (XX-XXXX)
          </label>
          <input
            type="text"
            id="patientHN"
            value={patientHN}
            onChange={(e) => setPatientHN(e.target.value)}
            placeholder="e.g., 12-3456"
            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor="patientName" className="block text-sm font-medium text-gray-700">
            Patient Name
          </label>
          <input
            type="text"
            id="patientName"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder="e.g., John Doe"
            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
      </div>
    </div>
  );
};

export default PatientInfo;
