import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import App from './App';
import './index.css';

if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        environment: import.meta.env.MODE,
        integrations: [Sentry.browserTracingIntegration()],
        tracesSampleRate: 0.1,
        beforeSend(event) {
            // Redactar PII: emails y teléfonos de pacientes
            if (event.request?.url) {
                event.request.url = event.request.url.replace(/[?&]bid=\d+/, '');
            }
            if (event.user?.email) {
                event.user.email = '[redacted]';
            }
            return event;
        },
    });
}

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </StrictMode>
);
