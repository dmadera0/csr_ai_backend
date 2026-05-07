# Serenity Spa Chat Lambda Function

AWS Lambda function for Serenity Spa wellness center customer service chatbot powered by Claude AI via Amazon Bedrock.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

In AWS Lambda console, set:

```
DYNAMODB_TABLE=serenity-spa-conversations
KB_ID=AB2OOZFU3J
BUSINESS_NAME=serenity-spa
AWS_REGION=us-east-1
```

### 3. Test with Sample Request

```bash
curl -X POST https://your-api-gateway-url/serenity-spa \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-test-789",
    "userId": "guest-001",
    "message": "What are your membership options?"
  }'
```

## Function Details

**Handler:** `index.handler`

**Memory:** 512 MB (recommended)

**Timeout:** 60 seconds (recommended)

**Runtime:** Node.js 20.x

## API Request/Response

### Request

```json
{
  "sessionId": "session-spa-001",
  "userId": "member-jane",
  "message": "What time is your evening massage available?"
}
```

### Response (Success)

```json
{
  "response": "Our evening massage appointments are available from 4:00 PM to 8:00 PM daily. We recommend booking at least 24 hours in advance...",
  "sessionId": "session-spa-001",
  "timestamp": 1715088000000
}
```

### Response (Error)

```json
{
  "error": "Validation error",
  "details": "message must be at least 3 characters long"
}
```

## DynamoDB Configuration

**Table Name:** `serenity-spa-conversations`

**Partition Key:** `sessionId` (String)

**Sort Key:** `timestamp` (Number)

**Attributes:**
- `sessionId` - Chat session ID
- `timestamp` - Unix timestamp (seconds)
- `userId` - Member/guest identifier
- `message` - Customer message
- `response` - Claude's response
- `businessName` - Business identifier
- `createdAt` - ISO 8601 timestamp

## Deployment

### Using AWS CLI

```bash
# Zip the function
zip -r function.zip index.js node_modules/

# Update Lambda
aws lambda update-function-code \
  --function-name serenity-spa-chat-function \
  --zip-file fileb://function.zip
```

### Using AWS Console

1. Go to Lambda console
2. Select `serenity-spa-chat-function`
3. Click "Upload from" → "Local file"
4. Select `function.zip`
5. Click "Save"

## Monitoring

Monitor in CloudWatch:

```
/aws/lambda/serenity-spa-chat-function
```

Key logs to watch:

```
[serenity-spa] Calling Bedrock with KB: AB2OOZFU3J
[serenity-spa] Bedrock response received (XXX chars)
[serenity-spa] Conversation stored successfully
[serenity-spa] Request completed in XXms
```

## Knowledge Base

The function uses Bedrock Knowledge Base scoped to spa and wellness industry documents:

- Treatment descriptions and durations
- Pricing and packages
- Membership benefits and tiers
- Availability and booking policies
- Contraindications and health information
- Wellness philosophy and approach
- Common spa FAQs

Documents are stored in S3 bucket: `serenity-spa-documents`

## Troubleshooting

### Lambda Timeout

**Error:** Task timed out after 30.00 seconds

**Solution:** Increase Lambda timeout to 60 seconds
- Go to Lambda console → Configuration → General configuration → Timeout

### DynamoDB Write Throttled

**Error:** ProvisionedThroughputExceededException

**Solution:** Increase write capacity
- Go to DynamoDB console → serenity-spa-conversations → Capacity tab
- Increase Write capacity units (WCU)

### Bedrock Access Denied

**Error:** User is not authorized to perform: bedrock:InvokeModel

**Solution:** Update Lambda IAM role with Bedrock permissions
```json
{
  "Effect": "Allow",
  "Action": ["bedrock:InvokeModel"],
  "Resource": "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-20250514"
}
```

### CloudWatch Logs Empty

**Error:** No logs in CloudWatch

**Solution:** Check Lambda execution role has CloudWatch permissions
```json
{
  "Effect": "Allow",
  "Action": [
    "logs:CreateLogGroup",
    "logs:CreateLogStream",
    "logs:PutLogEvents"
  ],
  "Resource": "arn:aws:logs:us-east-1:*:*"
}
```

### Knowledge Base Not Finding Answers

**Problem:** Responses are generic, not using knowledge base

**Solution:** Check that spa/wellness documents are uploaded to S3 and indexed in Bedrock Knowledge Base

## Performance

- **Cold start:** ~500ms (first request after deploy)
- **Warm response:** ~200-400ms (subsequent requests)
- **Bedrock latency:** ~150-300ms
- **DynamoDB latency:** ~20-50ms

## Security

- Input validation (message: 3-2000 chars)
- No hardcoded credentials
- CORS headers included
- Error messages sanitized
- All operations logged

## Tone & Personality

This function uses a calm, welcoming tone that reflects the spa's wellness brand. System prompt includes:

> "Maintain a calm and soothing tone that reflects our wellness brand."

Responses are designed to be:
- Peaceful and reassuring
- Professional yet warm
- Focused on member wellbeing
- Educational about treatments and wellness

## Local Testing (Optional)

For local testing, install AWS SAM CLI:

```bash
pip install aws-sam-cli

# Start local API
sam local start-api

# In another terminal
curl -X POST http://localhost:3000/serenity-spa \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-789",
    "message": "Do you offer couples massages?"
  }'
```

## Dependencies

- `@aws-sdk/client-bedrock-runtime` - Bedrock API
- `@aws-sdk/client-dynamodb` - DynamoDB API

## License

MIT
