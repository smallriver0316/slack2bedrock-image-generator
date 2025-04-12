import json
import boto3
import logging
import os
from botocore.config import Config
from datetime import datetime


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

REGION = os.environ.get("AWS_REGION", "")
BUCKET_NAME = os.environ.get("BUCKET_NAME", "")
MODEL_ID = os.environ.get("MODEL_ID", "stability.stable-diffusion-xl-v1")

bedrock_runtime = boto3.client("bedrock-runtime", region_name=REGION)
s3 = boto3.client("s3", config=Config(region_name=REGION))


def handler(event, context):
    logger.info(event)

    body = json.loads(event["Records"][0]["body"])
    channel_id = body.get("channel_id", None)
    input_text = body.get("input_text", None)

    if channel_id is None or input_text is None:
        return {
            "statusCode": 400,
            "body": json.dumps(
                {
                    "message": "Invalid request!",
                    "input": event,
                }
            ),
        }

    current_dt = datetime.now()

    response = bedrock_runtime.invoke_model(
        modelId=MODEL_ID,
        contentType="application/json",
        accept="image/png",
        body=json.dumps(
            {
                "text_prompts": [{
                    "text": input_text
                }]
            }
        )
    )

    s3_key = f"{channel_id}/{current_dt.strftime('%Y-%m-%d')}/{
        current_dt.strftime('%H%M%S')}.png"
    s3.upload_fileobj(
        response["body"],
        BUCKET_NAME, s3_key,
        ExtraArgs={"ContentType": "image/png"})

    return {
        "statusCode": 200,
        "body": json.dumps(
            {
                "message": "Hello from subscriber!",
                "input": event,
            }
        ),
    }
