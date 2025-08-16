from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx
from fastapi.middleware.cors import CORSMiddleware
import os

# --- Configuration ---
RECAPTCHA_SECRET_KEY = #os.environ.get("RECAPTCHA_SECRET_KEY", "YOUR_RECAPTCHA_SECRET_KEY")
RECAPTCHA_THRESHOLD = float(os.environ.get("RECAPTCHA_THRESHOLD", 0.5))

# --- Pydantic Models for Request Bodies ---
class AdviceRequest(BaseModel):
    prompt: str
    recaptcha_token: str

# --- FastAPI App Initialization ---
app = FastAPI()

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API Endpoints ---
@app.get("/")
def read_root():
    return {"status": "Mechanical Advisor API is running!"}


@app.post("/get-advice")
async def get_advice(request: AdviceRequest):
    """
    Provides mechanical advice.
    This is a MOCK endpoint that now also handles reCAPTCHA verification.
    """
    # Verify the reCAPTCHA token
    if not RECAPTCHA_SECRET_KEY or RECAPTCHA_SECRET_KEY == "YOUR_RECAPTCHA_SECRET_KEY":
        print("WARNING: RECAPTCHA_SECRET_KEY is not set. Skipping verification.")
    else:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    "https://www.google.com/recaptcha/api/siteverify",
                    data={
                        "secret": RECAPTCHA_SECRET_KEY,
                        "response": request.recaptcha_token,
                    },
                )
                response.raise_for_status()  # This will raise an exception for 4xx/5xx responses
                result = response.json()
            except httpx.HTTPError as e:
                print(f"HTTPX Error during reCAPTCHA verification: {e}")
                raise HTTPException(status_code=500, detail="Failed to connect to reCAPTCHA service.")
            except Exception as e:
                print(f"An unexpected error occurred: {e}")
                raise HTTPException(status_code=500, detail="An unexpected error occurred during reCAPTCHA verification.")
            
            if not result.get("success"):
                print(f"reCAPTCHA verification failed: {result.get('error-codes')}")
                raise HTTPException(status_code=400, detail="reCAPTCHA verification failed.")
            
            score = result.get("score")
            if score < RECAPTCHA_THRESHOLD:
                print(f"reCAPTCHA score {score} is below the threshold of {RECAPTCHA_THRESHOLD}.")
                raise HTTPException(status_code=400, detail=f"reCAPTCHA score too low. Score: {score}")

            print(f"reCAPTCHA verification successful with score: {score}")

    print(f"Received prompt: {request.prompt}")
    mock_advice = f"This is a mock response for your query about: '{request.prompt}'.\n\nThis proves the frontend is successfully connected to the FastAPI backend. To get real advice, you would need to integrate the OpenAI GPT-4 API here."
    return {"advice": mock_advice}
