#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "breez_sdk_spark>=0.9.0",
#   "python-dotenv>=1.0.0",
#   "requests>=2.31",
# ]
# ///
import os
import logging
import asyncio
import time
import requests
from random import randint
from dotenv import load_dotenv
from breez_sdk_spark import (
    Seed,
    default_config,
    Network,
    connect,
    ConnectRequest,
    GetInfoRequest,
    GetPaymentRequest,
    ReceivePaymentRequest,
    ReceivePaymentMethod,
    PrepareSendPaymentRequest,
    SendPaymentRequest,
    SendPaymentMethod,
    SendPaymentOptions,
    PaymentStatus,
    PaymentDetails,
    SdkError,
)
from breez_sdk_spark.breez_sdk_spark import uniffi_set_event_loop

load_dotenv()

logger = logging.getLogger(__name__)

BLINK_WALLET_ID = "c4a7c8f6-1ed6-4246-9715-e92222e9a87f"
BUFFER_SATS = 100 + randint(0, 100)


def blink_pay_invoice(invoice: str) -> dict:
    """Have Blink pay a Lightning invoice"""
    response = requests.post(
        "https://api.blink.sv/graphql",
        headers={
            "content-type": "application/json",
            "X-API-KEY": os.environ["BLINK_API_KEY"],
        },
        json={
            "query": """mutation LnInvoicePaymentSend($input: LnInvoicePaymentInput!) {
                lnInvoicePaymentSend(input: $input) {
                    status
                    errors {
                        message
                        path
                        code
                    }
                }
            }""",
            "variables": {
                "input": {
                    "paymentRequest": invoice,
                    "walletId": BLINK_WALLET_ID,
                }
            },
        },
    )
    response.raise_for_status()
    return response.json()


def blink_create_invoice(amount_sats: int) -> str:
    """Create a Blink Lightning invoice"""
    response = requests.post(
        "https://api.blink.sv/graphql",
        headers={
            "content-type": "application/json",
            "X-API-KEY": os.environ["BLINK_API_KEY"],
        },
        json={
            "query": """mutation LnInvoiceCreate($input: LnInvoiceCreateInput!) {
                lnInvoiceCreate(input: $input) {
                    invoice {
                        paymentRequest
                        paymentHash
                        paymentSecret
                        satoshis
                    }
                    errors {
                        message
                    }
                }
            }""",
            "variables": {
                "input": {
                    "amount": amount_sats,
                    "walletId": BLINK_WALLET_ID,
                }
            },
        },
    )
    response.raise_for_status()
    data = response.json()
    return data["data"]["lnInvoiceCreate"]["invoice"]["paymentRequest"]


async def wait_for_payment_completion(
    sdk,
    payment_id: str,
    *,
    timeout_secs: float = 120.0,
    poll_interval_secs: float = 2.0,
):
    """
    Poll until a Lightning payment is completed or failed.
    Returns the payment object, or None if timed out.
    Handles StorageError when payment record isn't persisted yet.
    """
    deadline = time.monotonic() + timeout_secs
    while time.monotonic() < deadline:
        try:
            response = await sdk.get_payment(request=GetPaymentRequest(payment_id=payment_id))
        except SdkError.StorageError as e:
            # Payment record may not be persisted yet, keep polling
            logger.debug("Payment %s not found in storage yet: %s", payment_id, e)
            await asyncio.sleep(poll_interval_secs)
            continue
        payment = response.payment
        if payment.status in (PaymentStatus.COMPLETED, PaymentStatus.FAILED):
            return payment
        logger.debug("Payment %s status: %s, polling again...", payment_id, payment.status)
        await asyncio.sleep(poll_interval_secs)
    logger.warning("Payment %s did not complete within %s seconds", payment_id, timeout_secs)
    return None


async def main():
    uniffi_set_event_loop(asyncio.get_event_loop())
    mnemonic = os.environ["BREEZ_MNEMONIC"]
    seed = Seed.MNEMONIC(mnemonic=mnemonic, passphrase=None)
    config = default_config(network=Network.MAINNET)
    config.api_key = os.environ["BREEZ_API_KEY"]

    # Connect to the SDK
    logger.info("Connecting to Breez SDK...")
    sdk = await connect(
        request=ConnectRequest(config=config, seed=seed, storage_dir="./.data")
    )

    try:
        # Step 1: Create a Breez Lightning invoice
        amount_sats = 1000 + randint(0, 1000)
        logger.info(f"Creating Breez invoice for {amount_sats} sats...")
        request = ReceivePaymentRequest(
            payment_method=ReceivePaymentMethod.BOLT11_INVOICE(
                description="Breez synthetic test",
                amount_sats=amount_sats,
                expiry_secs=3600,  # 1 hour expiry
                payment_hash=None,
            )
        )
        response = await sdk.receive_payment(request=request)
        breez_invoice = response.payment_request
        logger.info(f"Breez invoice created: {breez_invoice[:50]}...")

        # Step 2: Have Blink pay the Breez invoice
        logger.info("Having Blink pay the Breez invoice...")
        blink_response = blink_pay_invoice(breez_invoice)
        logger.info(f"Blink payment response: {blink_response}")

        # Wait for payment to settle
        logger.info("Waiting 5 seconds for payment to settle...")
        time.sleep(5)

        # Step 3: Get Breez balance
        logger.info("Getting Breez balance...")
        info = await sdk.get_info(request=GetInfoRequest(ensure_synced=False))
        available_sats = info.balance_sats
        logger.info(f"Breez balance: {available_sats} sats")

        # Calculate amount to send back (balance minus buffer for fees)
        send_amount = available_sats - BUFFER_SATS
        
        if send_amount <= 0:
            logger.warning(f"Insufficient balance to send back. Available: {available_sats}, Buffer: {BUFFER_SATS}")
            return sdk

        # Step 4: Create a Blink invoice for (balance - buffer)
        logger.info(f"Creating Blink invoice for {send_amount} sats...")
        blink_invoice = blink_create_invoice(send_amount)
        logger.info(f"Blink invoice created: {blink_invoice[:50]}...")

        # Step 5: Prepare and send Breez payment to Blink invoice
        logger.info("Preparing Breez payment...")
        prepare_request = PrepareSendPaymentRequest(
            payment_request=blink_invoice, amount=send_amount
        )
        prepare_response = await sdk.prepare_send_payment(request=prepare_request)
        
        if isinstance(prepare_response.payment_method, SendPaymentMethod.BOLT11_INVOICE):
            lightning_fee_sats = prepare_response.payment_method.lightning_fee_sats
            spark_transfer_fee_sats = prepare_response.payment_method.spark_transfer_fee_sats
            logger.info(f"Lightning Fees: {lightning_fee_sats} sats")
            logger.info(f"Spark Transfer Fees: {spark_transfer_fee_sats} sats")
        
        logger.info("Having Breez pay the Blink invoice...")
        # Optional: wait up to 15s for payment to complete in send_payment itself
        options = SendPaymentOptions.BOLT11_INVOICE(
            prefer_spark=False,
            completion_timeout_secs=15,
        )
        pay_request = SendPaymentRequest(
            prepare_response=prepare_response,
            options=options,
        )
        pay_response = await sdk.send_payment(request=pay_request)
        payment = pay_response.payment
        logger.info("Breez payment: id=%s status=%s", payment.id, payment.status)

        # Wait for payment to complete (also handles storage persistence race condition)
        final = await wait_for_payment_completion(sdk, payment.id, timeout_secs=120, poll_interval_secs=2)
        if not final or final.status != PaymentStatus.COMPLETED:
            raise RuntimeError("Breez payment did not complete successfully")

        # Print preimage (proof of payment)
        if isinstance(final.details, PaymentDetails.LIGHTNING) and final.details.htlc_details.preimage:
            logger.info("Payment preimage: %s", final.details.htlc_details.preimage)

        logger.info("Successfully completed bidirectional lightning payments!")
        return sdk

    except Exception as error:
        logger.error(f"Test failed: {error}")
        raise


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
