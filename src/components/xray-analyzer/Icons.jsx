import React from 'react';

export const UploadIcon = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className || 'h-6 w-6'}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
    />
  </svg>
);

export const CameraIcon = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className || 'h-6 w-6'}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
export const RedoIcon = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    className={className || "h-6 w-6"} 
    fill="none" 
    viewBox="0 0 24 24" 
    stroke="currentColor" 
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 9a9 9 0 0115-1.54M20 15a9 9 0 01-15 1.54" />
  </svg>
);
export const CloseIcon = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className || 'h-6 w-6'}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
export const MagicWandIcon = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className || 'h-6 w-6'}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 21.6c-1.2-2.4-3.6-6-3.6-6s-3.6-2.4-6-3.6c2.4-1.2 6-3.6 6-3.6s2.4-3.6 3.6-6c1.2 2.4 3.6 6 3.6 6s3.6 2.4 6 3.6c-2.4 1.2-6 3.6-6 3.6s-2.4 3.6-3.6 6zM4.8 4.8l1.2 2.4m12 12l1.2 2.4M4.8 19.2l1.2-2.4m12-12l1.2-2.4"
    />
  </svg>
);
export const RotateIcon = ({ className }) => (
<svg xmlns="http://www.w3.org/2000/svg" className={className || 'h-5 w-5'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M4 4v6h6" strokeLinecap="round" strokeLinejoin="round" />
<path d="M20.49 9A9 9 0 106 20.49" strokeLinecap="round" strokeLinejoin="round" />
</svg>
);


export const TrashIcon = ({ className }) => (
<svg xmlns="http://www.w3.org/2000/svg" className={className || 'h-5 w-5'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M3 6h18" strokeLinecap="round" strokeLinejoin="round" />
<path d="M8 6v14a2 2 0 002 2h4a2 2 0 002-2V6" strokeLinecap="round" strokeLinejoin="round" />
<path d="M10 6l1-2h2l1 2" strokeLinecap="round" strokeLinejoin="round" />
</svg>
);