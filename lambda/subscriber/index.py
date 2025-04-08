import json
# import boto3
# import base64
import logging
# import os
# import uuid
# from botocore.config import Config


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# bedrock_runtme = boto3.client("bedrock-runtime")
# s3 = boto3.client(
#     "s3",
#     config=Config(region_name=os.environ.get("AWS_REGION"),
#     signature_version="s3v4"))


def handler(event, context):
    logger.info(event)

    return {
        "statusCode": 200,
        "body": json.dumps(
            {
                "message": "Hello from subscriber!",
                "input": event,
            }
        ),
    }
