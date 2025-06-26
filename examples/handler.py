import logging
import json
import uvicorn
import requests
import base64
from fastapi import FastAPI
from pydantic import BaseModel
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_pem_public_key

app = FastAPI()
logger = logging.getLogger(__name__)

public_key = load_pem_public_key(
    requests.get(
        "https://sparkproxy.kevz.dev/.well-known/webhook-public-key.pem"
    ).text.encode()
)


def verify_asymmetric(payload, signature):
    public_key.verify(
        base64.b64decode(signature),
        payload.encode("utf-8"),
        padding.PKCS1v15(),
        hashes.SHA256(),
    )
    return True


class WebhookPayload(BaseModel):
    payload: str
    signature: str


@app.post("/webhook")
def webhook(payload: WebhookPayload):
    if not verify_asymmetric(payload.payload, payload.signature):
        return {"message": "Invalid signature"}
    payload = json.loads(payload.payload)
    logger.info(payload)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    uvicorn.run(app, host="0.0.0.0", port=8000)
