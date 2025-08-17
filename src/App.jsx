// src/App.jsx
import React, { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import PeriodontalChartPage from './pages/PeriodontalChartPage';
import PlaqueIndexPage from './pages/PlaqueIndexPage';
import VoicePeriodontalChartPage from './pages/VoicePeriodontalChartPage';
import QRCodePage from './pages/QRCodePage'; // Import the new page
import XRayAnalysisPage from './pages/XRayAnalysisPage';
import XRayAnalysisONNXPage from './pages/XRayAnalysisONNXPage'; 
const App = () => {
    const [route, setRoute] = useState(window.location.hash);

    useEffect(() => {
        const handleHashChange = () => {
            setRoute(window.location.hash);
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const renderPage = () => {
        switch (route) {
            case '#/periodontal-chart':
                return <PeriodontalChartPage />;
            case '#/plaque-index':
                return <PlaqueIndexPage />;
            case '#/voice-periodontal-chart':
                return <VoicePeriodontalChartPage />;
            case '#/qr-donate': // Add the new route
                return <QRCodePage />;
            case '#/xray-analysis': return <XRayAnalysisPage />;
            case '#/xray-analysis-onnx': // <-- 2. Add the new route
                return <XRayAnalysisONNXPage />;
            default:
                return <LandingPage />;
        }
    };

    return (
        <div>
            {renderPage()}
        </div>
    );
};

export default App;