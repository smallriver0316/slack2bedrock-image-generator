import base64
import boto3
import json
import logging
import io
import os
from botocore.config import Config
from datetime import datetime
from slack_sdk import WebClient


logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

REGION = os.environ.get("AWS_REGION", "")
STAGE = os.environ.get("STAGE", "")
BUCKET_NAME = os.environ.get("BUCKET_NAME", "")
MODEL_ID = os.environ.get("MODEL_ID", "stability.stable-diffusion-xl-v1")
SQS_QUEUE_URL = os.environ.get("SQS_QUEUE_URL", "")

bedrock_runtime = boto3.client("bedrock-runtime", region_name=REGION)
s3 = boto3.client("s3", config=Config(region_name=REGION))
ssm = boto3.client("ssm", region_name=REGION)
sqs = boto3.client("sqs", region_name=REGION)

param = ssm.get_parameter(
    Name=f"/slack2bedrock-image-generator/{STAGE}/SLACK_BOT_TOKEN",
    WithDecryption=True,
)

SLACK_BOT_TOKEN = param["Parameter"]["Value"]
slack_client = WebClient(token=SLACK_BOT_TOKEN)


def handler(event, context):
    logger.debug(event)

    try:
        body = json.loads(event["Records"][0]["body"])
        channel_id = body.get("channel_id", None)
        input_text = body.get("input_text", None)

        if channel_id is None or input_text is None:
            logger.error(f"Invalid request: {json.dumps(body)}")
            raise Exception("Invalid request")

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

        image_data = response["body"].read()
        if image_data is None:
            raise Exception("Failed to generate image")

        s3_key = f"{channel_id}/{current_dt.strftime('%Y-%m-%d')}/{
            current_dt.strftime('%H%M%S')}.png"
        s3.upload_fileobj(
            io.BytesIO(image_data),
            BUCKET_NAME,
            s3_key,
            ExtraArgs={"ContentType": "image/png"})

        result = slack_client.files_upload_v2(
            channel=channel_id,
            content=image_data,
            filename=f"{current_dt.strftime('%Y-%m-%dT%H:%M:%S')}.png",
            title=f"Input text: {input_text}",
            initial_comment="Generated image from Bedrock",
        )

        logger.debug(result)
    except Exception as e:
        logger.error(e)

        sqs.delete_message(
            QueueUrl=SQS_QUEUE_URL,
            ReceiptHandle=event["Records"][0]["receiptHandle"],
        )

        slack_client.chat_postMessage(
            channel=channel_id,
            text=f"Error occurred: {e}",
        )
