// src/App.jsx
import React, { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import PeriodontalChartPage from './pages/PeriodontalChartPage';
import PlaqueIndexPage from './pages/PlaqueIndexPage';

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