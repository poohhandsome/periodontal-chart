// src/pages/LandingPage.jsx
import React, { useState } from 'react';
import ReleaseNotesModal from '../components/ReleaseNotesModal';

const ToolCard = ({ title, description, href, icon, isBeta = false }) => (
    <a href={href} className="group block p-8 bg-white rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-2 transition-all duration-300">
        <div className="flex items-center gap-4">
            <div className="text-blue-500 bg-blue-100 p-3 rounded-full">
                {icon}
            </div>
            <div>
                <h3 className="text-2xl font-bold text-gray-800 group-hover:text-blue-600">
                    {title}
                    {isBeta && <span className="ml-2 text-xs font-semibold text-white bg-blue-500 px-2 py-1 rounded-full">BETA</span>}
                </h3>
                <p className="text-gray-600 mt-1">{description}</p>
            </div>
        </div>
    </a>
);


const LandingPage = () => {
    const [isReleaseNotesOpen, setReleaseNotesOpen] = useState(false);

    const PeriodontalIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
    );

    const PlaqueIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
    );
    
    const VoiceIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
    );
   const XRayIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 01-6.23-.872l-1.57-.393M19.8 15.3a2.25 2.25 0 00-2.25-2.25H6.45a2.25 2.25 0 00-2.25 2.25m15.6 0A24.226 24.226 0 0112 18.75a24.226 24.226 0 01-7.8-3.45m15.6 0a2.25 2.25 0 01-2.25 2.25h-5.25a2.25 2.25 0 01-2.25-2.25m3.75-12.25c0 .621.504 1.125 1.125 1.125h3.375c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125h-3.375A1.125 1.125 0 0011.25 4.875v1.5z" />
        </svg>
    );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white shadow-md">
            <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-blue-700">EasyPerio</h1>
                    <p className="text-gray-500">by pooh</p>
                </div>
            </div>
        </header>

        <main className="flex-grow container mx-auto px-6 py-12 flex items-center">
            <div className="w-full">
                <h2 className="text-4xl font-extrabold text-gray-800 text-center">Clinical Data Entry Tools</h2>
                <p className="text-lg text-gray-600 text-center mt-2 mb-10">Select a tool to begin.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    <ToolCard
                        title="Periodontal Chart"
                        description="Comprehensive periodontal charting and analysis."
                        href="#/periodontal-chart"
                        icon={<PeriodontalIcon />}
                    />
                    <ToolCard
                        title="Plaque Index"
                        description="Record and score plaque levels (O'Leary)."
                        href="#/plaque-index"
                        icon={<PlaqueIcon />}
                    />
                    <div className="md:col-span-2">
                        <ToolCard
                            title="Voice-Controlled Periodontal Chart"
                            description="Hands-free charting using Thai voice commands."
                            href="#/voice-periodontal-chart"
                            icon={<VoiceIcon />}
                            isBeta={true}
                        />
                    </div>
                    <ToolCard 
                        title="2D X-Ray Analysis"
                        description="Upload radiographs for manual analysis."
                        href="#/xray-analysis"
                        icon={<XRayIcon />}
                        isBeta={true} 
                    />
                </div>


                <div className="text-center mt-16">
                    <h3 className="text-xl font-semibold text-gray-700">More modules coming soon...</h3>
                    <p className="text-gray-500">OHIS, DMFT, Gingival Index, and more.</p>
                </div>
            </div>
        </main>

        <footer className="bg-white mt-auto">
            <div className="container mx-auto px-6 py-4 text-center text-gray-500">
                &copy; 2025 EasyPerio. All Rights Reserved.
            </div>
        </footer>

        {/* --- VERSION BUTTON --- */}
        <button 
            onClick={() => setReleaseNotesOpen(true)}
            className="fixed bottom-6 left-6 bg-gray-700 text-white px-4 py-2 rounded-full shadow-lg hover:bg-gray-800 transform hover:scale-105 transition-all duration-200 text-sm font-semibold"
            title="View Release Notes"
        >
            Version 1.1.2
        </button>

        {/* --- QR DONATE BUTTON --- */}
        <a 
            href="#/qr-donate"
            className="fixed bottom-6 right-6 bg-white p-3 rounded-full shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-200"
            title="Donate via QR Code"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
        </a>

        {/* --- RELEASE NOTES MODAL --- */}
        {isReleaseNotesOpen && <ReleaseNotesModal onClose={() => setReleaseNotesOpen(false)} />}
    </div>
  );
};

export default LandingPage;