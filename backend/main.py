from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

load_dotenv()
# --- Configuration ---
RECAPTCHA_SECRET_KEY_V3 = os.getenv("RECAPTCHA_SECRET_KEY", "YOUR_RECAPTCHA_SECRET_KEY")
# You need a separate Secret Key for v2. Get this from the reCAPTCHA Admin Console.
RECAPTCHA_SECRET_KEY_V2 = os.getenv("RECAPTCHA_SECRET_KEY_V2", "YOUR_RECAPTCHA_SECRET_KEY2")
RECAPTCHA_THRESHOLD = float(os.environ.get("RECAPTCHA_THRESHOLD", 1.0))

# --- Pydantic Models for Request Bodies ---
class AdviceRequest(BaseModel):
    prompt: str
    recaptcha_token: str

class AdviceRequestV2(BaseModel):
    prompt: str
    recaptcha_token_v2: str
    
class AdviceRequestV2Passed(BaseModel):
    prompt: str

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
    Verifies reCAPTCHA v3 token. If score is low, returns a specific error.
    """
    if not RECAPTCHA_SECRET_KEY_V3 or RECAPTCHA_SECRET_KEY_V3 == "YOUR_RECAPTCHA_SECRET_KEY":
        print("WARNING: RECAPTCHA_SECRET_KEY is not set. Skipping verification.")
    else:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    "https://www.google.com/recaptcha/api/siteverify",
                    data={
                        "secret": RECAPTCHA_SECRET_KEY_V3,
                        "response": request.recaptcha_token,
                    },
                )
                response.raise_for_status()
                result = response.json()
            except httpx.HTTPError as e:
                print(f"HTTPX Error during reCAPTCHA v3 verification: {e}")
                raise HTTPException(status_code=500, detail="Failed to connect to reCAPTCHA v3 service.")
            
            if not result.get("success"):
                print(f"reCAPTCHA v3 verification failed: {result.get('error-codes')}")
                raise HTTPException(status_code=400, detail="reCAPTCHA v3 verification failed.")
            
            score = result.get("score")
            print(f"reCAPTCHA v3 score: {score}")

            if score < RECAPTCHA_THRESHOLD:
                print(f"reCAPTCHA v3 score {score} is below the threshold of {RECAPTCHA_THRESHOLD}.")
                # Return a specific error for the frontend to handle
                raise HTTPException(status_code=400, detail="reCAPTCHA score too low.")

    print(f"Received prompt (v3 verified): {request.prompt}")
    mock_advice = f"This is a mock response for your query about: '{request.prompt}'.\n\n(V3 Verified) This proves the frontend is connected to the FastAPI backend."
    return {"advice": mock_advice}


@app.post("/get-advice-with-v2")
async def get_advice_with_v2(request: AdviceRequestV2):
    """
    Verifies reCAPTCHA v2 token and provides advice.
    """
    if not RECAPTCHA_SECRET_KEY_V2 or RECAPTCHA_SECRET_KEY_V2 == "YOUR_V2_SECRET_KEY":
        print("WARNING: RECAPTCHA_SECRET_KEY_V2 is not set. Skipping verification.")
    else:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    "https://www.google.com/recaptcha/api/siteverify",
                    data={
                        "secret": RECAPTCHA_SECRET_KEY_V2,
                        "response": request.recaptcha_token_v2,
                    },
                )
                response.raise_for_status()
                result = response.json()
            except httpx.HTTPError as e:
                print(f"HTTPX Error during reCAPTCHA v2 verification: {e}")
                raise HTTPException(status_code=500, detail="Failed to connect to reCAPTCHA v2 service.")
            
            if not result.get("success"):
                print(f"reCAPTCHA v2 verification failed: {result.get('error-codes')}")
                raise HTTPException(status_code=400, detail="reCAPTCHA v2 verification failed.")
            
            print("reCAPTCHA v2 verification successful.")

    print(f"Received prompt (v2 verified): {request.prompt}")
    mock_advice = f"This is a mock response for your query about: '{request.prompt}'.\n\n(V2 Verified) This proves the frontend is connected to the FastAPI backend."
    return {"advice": mock_advice}


@app.post("/get-advice-v2-passed")
async def get_advice_v2_passed(request: AdviceRequestV2Passed):
    """
    Endpoint for requests after a successful reCAPTCHA v2 challenge.
    Does not require a reCAPTCHA token.
    """
    print(f"Received prompt (v2 passed): {request.prompt}")
    mock_advice = f"This is a mock response for your query about: '{request.prompt}'.\n\n(V2 Passed) This proves the frontend is connected to the FastAPI backend without needing a new reCAPTCHA token."
    return {"advice": mock_advice}