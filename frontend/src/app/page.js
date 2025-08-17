'use client';

import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

// Ensure you have these in your .env.local file
const RECAPTCHA_SITE_KEY_V3 = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
const RECAPTCHA_SITE_KEY_V2 = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY_V2;

export default function Home() {
    const [prompt, setPrompt] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [recaptchaLoaded, setRecaptchaLoaded] = useState(false);
    const [needsV2Challenge, setNeedsV2Challenge] = useState(false);
    const [v2ChallengePassed, setV2ChallengePassed] = useState(false); // New state flag
    
    // State to hold the ID of the rendered v2 widget
    const [v2WidgetId, setV2WidgetId] = useState(null);
    // A ref to the container div for the v2 reCAPTCHA
    const recaptchaV2Container = useRef(null);

    // Effect to load the single reCAPTCHA script
    useEffect(() => {
        // Prevent script from loading multiple times
        if (window.grecaptcha) {
             window.grecaptcha.ready(() => setRecaptchaLoaded(true));
             return;
        }

        const script = document.createElement('script');
        // Load the api.js script with the 'render' parameter for v3.
        // This script can handle both v3 and v2 functionality.
        script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY_V3}`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            console.log('reCAPTCHA script loaded.');
            // Once loaded, the grecaptcha object is available globally.
            // The 'ready' function ensures we don't use it before it's initialized.
            window.grecaptcha.ready(() => {
                setRecaptchaLoaded(true);
            });
        };
        script.onerror = () => {
            console.error('Failed to load reCAPTCHA script.');
            setResponse('Could not load reCAPTCHA. Please check your connection or ad-blocker.');
        }

        document.body.appendChild(script);

    }, []);

    // Effect to render the v2 checkbox when it's needed
    useEffect(() => {
        // This runs when needsV2Challenge becomes true
        if (needsV2Challenge && recaptchaLoaded && recaptchaV2Container.current) {
            
            // Ensure the container is empty before rendering to avoid duplicates
            recaptchaV2Container.current.innerHTML = '';

            // Check if the v2 site key is available before rendering.
            if (!RECAPTCHA_SITE_KEY_V2) {
                console.error("reCAPTCHA v2 site key is missing. Check your .env.local file.");
                setResponse("Configuration error: The reCAPTCHA v2 site key is not set. Please inform the site administrator.");
                return;
            }

            console.log('Rendering reCAPTCHA v2 challenge.');
            try {
                const widgetId = window.grecaptcha.render(recaptchaV2Container.current, {
                    'sitekey': RECAPTCHA_SITE_KEY_V2,
                    'theme': 'dark', // Matching the dark theme of the site
                });
                setV2WidgetId(widgetId);
            } catch (error) {
                console.error("Error rendering reCAPTCHA v2:", error);
                setResponse("There was an error displaying the reCAPTCHA challenge.");
            }
        }
    }, [needsV2Challenge, recaptchaLoaded]);


    // Handles the initial v3-verified submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setResponse('');
        setNeedsV2Challenge(false);

        // If the user has already passed the v2 challenge, use the dedicated endpoint
        if (v2ChallengePassed) {
            console.log("v2 challenge already passed. Skipping reCAPTCHA check.");
            try {
                const res = await fetch('http://localhost:8000/get-advice-v2-passed', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt }),
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    const errorMessage = errorData.detail || `HTTP error! status: ${res.status}`;
                    throw new Error(errorMessage);
                }

                const data = await res.json();
                setResponse(data.advice);
            } catch (error) {
                console.error("Failed to get advice after v2 pass:", error);
                setResponse(`Failed to get advice. Reason: ${error.message || 'Unknown error'}.`);
            } finally {
                setLoading(false);
            }
            return; // Exit the function to prevent further execution
        }

        if (!recaptchaLoaded) {
            setResponse('reCAPTCHA is not loaded yet. Please wait a moment and try again.');
            setLoading(false);
            return;
        }

        try {
            // The 'ready' check is important
            await new Promise(resolve => window.grecaptcha.ready(resolve));
            const recaptchaToken = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY_V3, { action: 'submit_advice' });

            const res = await fetch('http://localhost:8000/get-advice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: prompt,
                    recaptcha_token: recaptchaToken,
                }),
            });

            const data = await res.json();

            // If the v3 score is too low, trigger the v2 challenge
            if (res.status === 400 && data.detail === "reCAPTCHA score too low.") {
                console.warn("reCAPTCHA v3 score too low. Initiating v2 challenge.");
                setNeedsV2Challenge(true); // This will trigger the useEffect above to render the v2 widget
                setLoading(false);
                setResponse("Please complete the challenge below to prove you're human.");
                return;
            }

            if (!res.ok) {
                const errorMessage = data.detail || `HTTP error! status: ${res.status}`;
                throw new Error(errorMessage);
            }

            setResponse(data.advice);

        } catch (error) {
            console.error("Failed to get advice:", error);
            setResponse(`Failed to get advice. Reason: ${error.message || 'Unknown error'}.`);
        } finally {
            setLoading(false);
        }
    };

    // Handles the submission after a successful v2 challenge
    const handleV2Submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setResponse('');

        // Get the response from the specific v2 widget instance
        const v2Token = window.grecaptcha.getResponse(v2WidgetId);
        if (!v2Token) {
            setResponse("Please complete the reCAPTCHA challenge.");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch('http://localhost:8000/get-advice-with-v2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: prompt,
                    recaptcha_token_v2: v2Token,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                const errorMessage = errorData.detail || `HTTP error! status: ${res.status}`;
                throw new Error(errorMessage);
            }

            const data = await res.json();
            setResponse(data.advice);
            setNeedsV2Challenge(false); // Hide the v2 challenge on success
            setV2ChallengePassed(true); // Set the flag to true for subsequent submissions

        } catch (error) {
            console.error("Failed to get advice with v2 token:", error);
            setResponse(`Failed to get advice. Reason: ${error.message || 'Unknown error'}.`);
            // Reset the v2 challenge on failure so the user can try again
            window.grecaptcha.reset(v2WidgetId);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center font-sans">
            <Head>
                <title>AI Mechanical Advisor</title>
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className="flex flex-col items-center justify-center w-full flex-1 px-4 sm:px-20 text-center">
                <h1 className="text-5xl sm:text-6xl font-bold text-blue-400">
                    AI Mechanical Advisor
                </h1>
                <p className="mt-3 text-xl sm:text-2xl text-gray-400">
                    Get expert advice for your car troubles
                </p>

                <div className="mt-8 w-full max-w-2xl">
                    <form onSubmit={needsV2Challenge ? handleV2Submit : handleSubmit} className="w-full">
                        <textarea
                            className="w-full p-4 text-lg bg-gray-800 border-2 border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 transition duration-300 resize-none"
                            rows="4"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe the issue with your car... (e.g., 'My 2015 Honda Civic is making a clicking noise when I turn left')"
                        />

                        {/* This div is now the target for our programmatic render */}
                        {needsV2Challenge && (
                            <div className="flex flex-col items-center mt-4">
                                <div ref={recaptchaV2Container}></div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 disabled:bg-gray-500"
                        >
                            {loading ? 'Getting Advice...' : 'Get Advice'}
                        </button>
                    </form>

                    {response && (
                        <div className="mt-8 p-6 bg-gray-800 rounded-lg shadow-lg w-full text-left">
                            <h2 className="text-2xl font-semibold mb-4 text-gray-200">Advisor's Response:</h2>
                            <p className="text-lg text-gray-300 whitespace-pre-wrap">{response}</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}