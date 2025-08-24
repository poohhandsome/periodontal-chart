// src/App.jsx

import React, { useState, useEffect } from 'react';
import { auth } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import ShareRedeemPage from './pages/ShareRedeemPage';
// Import Pages and Components
import LandingPage from './pages/LandingPage';
import PeriodontalChartPage from './pages/PeriodontalChartPage';
import PlaqueIndexPage from './pages/PlaqueIndexPage';
import VoicePeriodontalChartPage from './pages/VoicePeriodontalChartPage';
import QRCodePage from './pages/QRCodePage';
import XRayAnalysisPage from './pages/XRayAnalysisPage';
import XRayAnalysisONNXPage from './pages/XRayAnalysisONNXPage';
// AuthPage is no longer needed here if we use the modal-based approach

const App = () => {
    const [route, setRoute] = useState(window.location.hash || '#/');
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true); // Start with loading true

    useEffect(() => {
        const handleHashChange = () => {
            setRoute(window.location.hash || '#/');
        };
        window.addEventListener('hashchange', handleHashChange);
        
        // This is the crucial listener. We will add a log here.
        const unsubscribe = onAuthStateChanged(auth, user => {
            console.log("Auth state changed. User:", user); // <-- NEW DEBUGGING LINE
            setCurrentUser(user);
            setIsLoading(false);
        });

        // Cleanup function
        return () => {
            window.removeEventListener('hashchange', handleHashChange);
            unsubscribe();
        };
    }, []); // Empty dependency array ensures this runs only once on mount

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <h1 className="text-xl font-semibold">Loading Application...</h1>
            </div>
        );
    }

    // This is the router logic that shows the correct page based on the URL hash
    // It now passes the 'currentUser' to every page.
    if (route.startsWith('#/share/')) {
  const code = route.split('/')[2] || '';
  return <ShareRedeemPage code={code} />;
}
    switch (route) {
        case '#/periodontal-chart':
            return <PeriodontalChartPage user={currentUser} />;
        case '#/plaque-index':
            return <PlaqueIndexPage user={currentUser} />;
        case '#/voice-periodontal-chart':
            return <VoicePeriodontalChartPage user={currentUser} />;
        case '#/xray-analysis':
            return <XRayAnalysisPage user={currentUser} />;
        case '#/xray-onnx':
            return <XRayAnalysisONNXPage user={currentUser} />;
        case '#/qr-donate':
            return <QRCodePage />;
        default:
            return <LandingPage user={currentUser} />;
    }
};

export default App;