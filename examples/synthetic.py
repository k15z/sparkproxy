import sys
import os
import time
import requests
import logging
from random import randint

logger = logging.getLogger(__name__)

def send_slack_notification(failed_tests):
    # Build error message detailing which tests failed
    error_details = []
    if "blink_lightning" in failed_tests:
        error_details.append("- Lightning payments between Spark and Blink")
    if "spark_transfer" in failed_tests:
        error_details.append("- Spark transfers between Spark wallets")
        
    message = "⚠️ Alert: Spark Synthetic Tests Failed!\n\nFailed Tests:\n" + "\n".join(error_details)
    logger.error(message)
    
    payload = {
        "text": message
    }
    if "SLACK_WEBHOOK" in os.environ:
        requests.post(os.environ["SLACK_WEBHOOK"], json=payload)
    else:
        logger.error("SLACK_WEBHOOK is not set. No notification sent.")

def make_transfer(mnemonic, receiver_address, amount_sats):
    response = requests.post(
        "https://sparkproxy.kevz.dev/wallet/transfer",
        headers={
            "accept": "application/json",
            "spark-network": "MAINNET", 
            "spark-mnemonic": mnemonic,
            "Content-Type": "application/json"
        },
        json={
            "amountSats": amount_sats,
            "receiverSparkAddress": receiver_address
        }
    )
    logger.info(f"Spark transfer response: {response.text}")
    return response.ok and "error" not in response.text

def check_blink_lightning(amount_sats: int):
    """Check lightning payments between Spark and Blink"""
    logger.info(f"Starting lightning payment test between Spark and Blink for {amount_sats} sats")

    # Create Spark invoice
    logger.info("Creating Spark lightning invoice")
    spark_invoice_response = requests.post(
        "https://sparkproxy.kevz.dev/wallet/lightning/create",
        headers={
            "accept": "application/json", 
            "spark-network": "MAINNET",
            "spark-mnemonic": os.environ["MNEMONIC1"],
            "Content-Type": "application/json"
        },
        json={
            "amount": amount_sats,
            "memo": "Spark->Blink test",
            "expirySeconds": 86400
        }
    )
    logger.info(f"Spark invoice response: {spark_invoice_response.text}")
    
    if not spark_invoice_response.ok:
        logger.error("Failed to create Spark invoice")
        return False
    
    spark_invoice = spark_invoice_response.json()["invoice"]
    
    # Have Blink pay the Spark invoice
    logger.info("Having Blink pay the Spark invoice")
    blink_pay_response = requests.post(
        "https://api.blink.sv/graphql",
        headers={
            "content-type": "application/json",
            "X-API-KEY": os.environ["BLINK_API_KEY"]
        },
        json={
            "query": "mutation LnInvoicePaymentSend($input: LnInvoicePaymentInput!) {\n  lnInvoicePaymentSend(input: $input) {\n    status\n    errors {\n      message\n      path\n      code\n    }\n  }\n}",
            "variables": {
                "input": {
                    "paymentRequest": spark_invoice,
                    "walletId": "c4a7c8f6-1ed6-4246-9715-e92222e9a87f"
                }
            }
        }
    )
    logger.info(f"Blink payment response: {blink_pay_response.text}")

    if not blink_pay_response.ok:
        logger.error("Failed to have Blink pay Spark invoice") 
        return False

    # Wait for Blink to pay the Spark invoice
    time.sleep(10)

    # Create Blink invoice
    logger.info("Creating Blink lightning invoice")
    blink_invoice_response = requests.post(
        "https://api.blink.sv/graphql",
        headers={
            "content-type": "application/json",
            "X-API-KEY": os.environ["BLINK_API_KEY"]
        },
        json={
            "query": "mutation LnInvoiceCreate($input: LnInvoiceCreateInput!) {\n  lnInvoiceCreate(input: $input) {\n    invoice {\n      paymentRequest\n      paymentHash\n      paymentSecret\n      satoshis\n    }\n    errors {\n      message\n    }\n  }\n}",
            "variables": {
                "input": {
                    "amount": amount_sats,
                    "walletId": "c4a7c8f6-1ed6-4246-9715-e92222e9a87f"
                }
            }
        }
    )
    logger.info(f"Blink invoice response: {blink_invoice_response.text}")

    if not blink_invoice_response.ok:
        logger.error("Failed to create Blink invoice")
        return False

    blink_invoice = blink_invoice_response.json()["data"]["lnInvoiceCreate"]["invoice"]["paymentRequest"]

    # Have Spark pay the Blink invoice
    logger.info("Having Spark pay the Blink invoice") 
    spark_pay_response = requests.post(
        "https://sparkproxy.kevz.dev/wallet/lightning/pay",
        headers={
            "accept": "application/json",
            "spark-network": "MAINNET",
            "spark-mnemonic": os.environ["MNEMONIC1"],
            "Content-Type": "application/json"
        },
        json={
            "invoice": blink_invoice,
            "maxFeeSats": 10
        }
    )
    logger.info(f"Spark payment response: {spark_pay_response.text}")

    if not spark_pay_response.ok:
        logger.error("Failed to have Spark pay Blink invoice")
        return False

    logger.info("Successfully completed bidirectional lightning payments")
    return True

def check_spark_transfer():
    """Check Spark transfer between two addresses"""
    amount_sats = randint(10, 100)
    logger.info(f"Starting transfer test between two Spark wallets for {amount_sats} sats")

    # First transfer
    success = make_transfer(
        os.environ["MNEMONIC1"],
        os.environ["ADDRESS2"],
        amount_sats
    )
    if not success:
        logger.error("Failed to make first Spark transfer")
        return False
    
    # Wait between transfers
    time.sleep(10)

    # Second transfer  
    success = make_transfer(
        os.environ["MNEMONIC2"],
        os.environ["ADDRESS1"],
        amount_sats
    )
    if not success:
        logger.error("Failed to make second Spark transfer")
        return False

    # Wait between transfers
    time.sleep(10)

    logger.info("Successfully completed Spark transfer test")
    return True

def main():
    failed_tests = []
    
    if not check_spark_transfer():
        failed_tests.append("spark_transfer")
    if not check_blink_lightning(randint(10, 20)):
        failed_tests.append("blink_lightning")

    # Send detailed notification if any tests failed
    if failed_tests:
        send_slack_notification(failed_tests)
        sys.exit(1)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
