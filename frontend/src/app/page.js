'use client';

import { useState, useEffect } from 'react';
import Head from 'next/head';

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

export default function Home() {
    const [prompt, setPrompt] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [recaptchaLoaded, setRecaptchaLoaded] = useState(false);

    useEffect(() => {
        if (window.grecaptcha) {
            setRecaptchaLoaded(true);
            return;
        }
        const script = document.createElement('script');
        script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            console.log('reCAPTCHA script loaded.');
            setRecaptchaLoaded(true);
        };
        document.body.appendChild(script);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setResponse('');

        if (!recaptchaLoaded) {
            setResponse('reCAPTCHA script not loaded yet. Please try again in a moment.');
            setLoading(false);
            return;
        }

        try {
            // Execute reCAPTCHA to get a fresh, single-use token.
            const recaptchaToken = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'submit_advice' });

            const res = await fetch('http://localhost:8000/get-advice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: prompt,
                    recaptcha_token: recaptchaToken,
                }),
            });

            if (!res.ok) {
                // If the response is not OK (e.g., 400 Bad Request), parse the error message.
                const errorData = await res.json();
                const errorMessage = errorData.detail || `HTTP error! status: ${res.status}`;
                throw new Error(errorMessage);
            }

            const data = await res.json();
            setResponse(data.advice);

        } catch (error) {
            console.error("Failed to get advice:", error);
            setResponse(`Failed to get advice. Reason: ${error.message || 'Unknown error'}.`);
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
                    <form onSubmit={handleSubmit} className="w-full">
                        <textarea
                            className="w-full p-4 text-lg bg-gray-800 border-2 border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 transition duration-300 resize-none"
                            rows="4"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe the issue with your car... (e.g., 'My 2015 Honda Civic is making a clicking noise when I turn left')"
                        />
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