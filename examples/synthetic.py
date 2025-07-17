import sys
import os
import time
import requests
import logging
import argparse
from random import randint
from typing import Literal

logger = logging.getLogger(__name__)


class SyntheticTestError(Exception):
    def __init__(
        self,
        test_name: str,
        operation: str,
        details: str,
        original_error: Exception = None,
    ):
        self.test_name = test_name
        self.operation = operation
        self.details = details
        self.original_error = original_error
        super().__init__(f"{test_name}: {operation} - {details}")


def send_slack_notification(environment, errors):
    # Build error message detailing which tests failed
    error_details = []
    for error in errors:
        if "DOCTYPE html" in error.details:
            return  # Not reporting Heroku timeout errors to Slack
        error_details.append(
            f"- {error.test_name}: {error.operation} - {error.details[:100]}"
        )

    message = (
        f":alert: {environment.title()} Spark Synthetic Tests Failed!\n\nErrors:\n"
        + "\n".join(error_details)
    )
    logger.error(message)

    payload = {"text": message}
    if "SLACK_WEBHOOK" in os.environ:
        requests.post(os.environ["SLACK_WEBHOOK"], json=payload)
    else:
        logger.error("SLACK_WEBHOOK is not set. No notification sent.")


def make_transfer(environment, mnemonic, receiver_address, amount_sats):
    response = requests.post(
        "https://sparkproxy.kevz.dev/wallet/transfer",
        headers={
            "accept": "application/json",
            "spark-network": "MAINNET",
            "spark-environment": environment,
            "spark-mnemonic": mnemonic,
            "Content-Type": "application/json",
        },
        json={"amountSats": amount_sats, "receiverSparkAddress": receiver_address},
    )
    logger.info(f"Spark transfer response: {response.text}")
    if "error" in response.text:
        raise SyntheticTestError(
            test_name="Spark",
            operation="transfer",
            details=response.text,
            original_error=Exception(f"Spark transfer failed: {response.text}"),
        )
    return response.ok and "error" not in response.text


def check_blink_lightning(environment, amount_sats: int):
    """Check lightning payments between Spark and Blink"""
    logger.info(
        f"Starting lightning payment test between Spark and Blink for {amount_sats} sats"
    )

    # Create Spark invoice
    logger.info("Creating Spark lightning invoice")
    spark_invoice_response = requests.post(
        "https://sparkproxy.kevz.dev/wallet/lightning/create",
        headers={
            "accept": "application/json",
            "spark-network": "MAINNET",
            "spark-environment": environment,
            "spark-mnemonic": os.environ["MNEMONIC1"],
            "Content-Type": "application/json",
        },
        json={
            "amount": amount_sats,
            "memo": "Spark->Blink test",
            "expirySeconds": 86400,
        },
    )
    logger.info(f"Spark invoice response: {spark_invoice_response.text}")

    if not spark_invoice_response.ok:
        raise SyntheticTestError(
            test_name="Spark",
            operation="create_spark_invoice",
            details=spark_invoice_response.text,
            original_error=Exception(
                f"Failed to create Spark invoice: {spark_invoice_response.text}"
            ),
        )

    spark_invoice = spark_invoice_response.json()["invoice"]

    # Have Blink pay the Spark invoice
    logger.info("Having Blink pay the Spark invoice")
    blink_pay_response = requests.post(
        "https://api.blink.sv/graphql",
        headers={
            "content-type": "application/json",
            "X-API-KEY": os.environ["BLINK_API_KEY"],
        },
        json={
            "query": "mutation LnInvoicePaymentSend($input: LnInvoicePaymentInput!) {\n  lnInvoicePaymentSend(input: $input) {\n    status\n    errors {\n      message\n      path\n      code\n    }\n  }\n}",
            "variables": {
                "input": {
                    "paymentRequest": spark_invoice,
                    "walletId": "c4a7c8f6-1ed6-4246-9715-e92222e9a87f",
                }
            },
        },
    )
    logger.info(f"Blink payment response: {blink_pay_response.text}")

    if not blink_pay_response.ok:
        raise SyntheticTestError(
            test_name="Lightning",
            operation="pay_spark_invoice",
            details=blink_pay_response.text,
            original_error=Exception(
                f"Failed to have Blink pay Spark invoice: {blink_pay_response.text}"
            ),
        )

    # Wait for Blink to pay the Spark invoice
    time.sleep(10)

    # Create Blink invoice
    logger.info("Creating Blink lightning invoice")
    blink_invoice_response = requests.post(
        "https://api.blink.sv/graphql",
        headers={
            "content-type": "application/json",
            "X-API-KEY": os.environ["BLINK_API_KEY"],
        },
        json={
            "query": "mutation LnInvoiceCreate($input: LnInvoiceCreateInput!) {\n  lnInvoiceCreate(input: $input) {\n    invoice {\n      paymentRequest\n      paymentHash\n      paymentSecret\n      satoshis\n    }\n    errors {\n      message\n    }\n  }\n}",
            "variables": {
                "input": {
                    "amount": amount_sats,
                    "walletId": "c4a7c8f6-1ed6-4246-9715-e92222e9a87f",
                }
            },
        },
    )
    logger.info(f"Blink invoice response: {blink_invoice_response.text}")

    if not blink_invoice_response.ok:
        raise SyntheticTestError(
            test_name="Lightning",
            operation="create_blink_invoice",
            details=blink_invoice_response.text,
            original_error=Exception(
                f"Failed to create Blink invoice: {blink_invoice_response.text}"
            ),
        )

    blink_invoice = blink_invoice_response.json()["data"]["lnInvoiceCreate"]["invoice"][
        "paymentRequest"
    ]

    # Have Spark pay the Blink invoice
    logger.info("Having Spark pay the Blink invoice")
    spark_pay_response = requests.post(
        "https://sparkproxy.kevz.dev/wallet/lightning/pay",
        headers={
            "accept": "application/json",
            "spark-network": "MAINNET",
            "spark-environment": environment,
            "spark-mnemonic": os.environ["MNEMONIC1"],
            "Content-Type": "application/json",
        },
        json={"invoice": blink_invoice, "maxFeeSats": 10},
    )
    logger.info(f"Spark payment response: {spark_pay_response.text}")

    if not spark_pay_response.ok:
        raise SyntheticTestError(
            test_name="Lightning",
            operation="pay_blink_invoice",
            details=spark_pay_response.text,
            original_error=Exception(
                f"Failed to have Spark pay Blink invoice: {spark_pay_response.text}"
            ),
        )

    logger.info("Successfully completed bidirectional lightning payments")
    return True


def check_spark_transfer(environment):
    """Check Spark transfer between two addresses"""
    amount_sats = randint(10, 100)
    logger.info(
        f"Starting transfer test between two Spark wallets for {amount_sats} sats"
    )

    # First transfer
    try:
        make_transfer(
            environment,
            os.environ["MNEMONIC1"],
            os.environ["ADDRESS2"],
            amount_sats,
        )
    except SyntheticTestError as e:
        raise e

    # Wait between transfers
    time.sleep(10)

    # Second transfer
    try:
        make_transfer(
            environment,
            os.environ["MNEMONIC2"],
            os.environ["ADDRESS1"],
            amount_sats,
        )
    except SyntheticTestError as e:
        raise e

    # Wait between transfers
    time.sleep(10)

    logger.info("Successfully completed Spark transfer test")
    return True


def main(environment: Literal["dev", "prod"]):
    errors = []

    try:
        check_spark_transfer(environment)
    except SyntheticTestError as e:
        errors.append(e)
    try:
        check_blink_lightning(environment, randint(10, 20))
    except SyntheticTestError as e:
        errors.append(e)

    # Send detailed notification if any tests failed
    if errors:
        send_slack_notification(environment, errors)
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dev", action="store_true", default=False)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    main("dev" if args.dev else "prod")
