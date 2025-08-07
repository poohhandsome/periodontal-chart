// src/pages/LandingPage.jsx
import React from 'react';

const ToolCard = ({ title, description, href, icon }) => (
    <a href={href} className="group block p-8 bg-white rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-2 transition-all duration-300">
        <div className="flex items-center gap-4">
            <div className="text-blue-500 bg-blue-100 p-3 rounded-full">
                {icon}
            </div>
            <div>
                <h3 className="text-2xl font-bold text-gray-800 group-hover:text-blue-600">{title}</h3>
                <p className="text-gray-600 mt-1">{description}</p>
            </div>
        </div>
    </a>
);

const LandingPage = () => {
    const PeriodontalIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
    );

    const PlaqueIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
    );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white shadow-md">
            <div className="container mx-auto px-6 py-4">
                <h1 className="text-3xl font-bold text-blue-700">EasyPerio</h1>
                <p className="text-gray-500">by pooh</p>
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
                </div>

                <div className="text-center mt-16">
                    <h3 className="text-xl font-semibold text-gray-700">More modules coming soon...</h3>
                    <p className="text-gray-500">OHIS, DMFT, Gingival Index, and more.</p>
                </div>
            </div>
        </main>

        <footer className="bg-white mt-auto">
            <div className="container mx-auto px-6 py-4 text-center text-gray-500">
                &copy; 2024 EasyPerio. All Rights Reserved.
            </div>
        </footer>
    </div>
  );
};

export default LandingPage;