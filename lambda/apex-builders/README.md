# Apex Builders Chat Lambda Function

AWS Lambda function for Apex Builders construction company customer service chatbot powered by Claude AI via Amazon Bedrock.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

In AWS Lambda console, set:

```
DYNAMODB_TABLE=apex-builders-conversations
KB_ID=AB2OOZFU3J
BUSINESS_NAME=apex-builders
AWS_REGION=us-east-1
```

### 3. Test with Sample Request

```bash
curl -X POST https://your-api-gateway-url/apex-builders \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-test-456",
    "userId": "contractor-001",
    "message": "When can you provide an estimate for my kitchen renovation?"
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
  "sessionId": "session-apex-001",
  "userId": "homeowner-smith",
  "message": "What is the timeline for a bathroom remodel?"
}
```

### Response (Success)

```json
{
  "response": "A typical bathroom remodel takes 4-6 weeks depending on the scope...",
  "sessionId": "session-apex-001",
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

**Table Name:** `apex-builders-conversations`

**Partition Key:** `sessionId` (String)

**Sort Key:** `timestamp` (Number)

**Attributes:**
- `sessionId` - Chat session ID
- `timestamp` - Unix timestamp (seconds)
- `userId` - Contractor/customer identifier
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
  --function-name apex-builders-chat-function \
  --zip-file fileb://function.zip
```

### Using AWS Console

1. Go to Lambda console
2. Select `apex-builders-chat-function`
3. Click "Upload from" → "Local file"
4. Select `function.zip`
5. Click "Save"

## Monitoring

Monitor in CloudWatch:

```
/aws/lambda/apex-builders-chat-function
```

Key logs to watch:

```
[apex-builders] Calling Bedrock with KB: AB2OOZFU3J
[apex-builders] Bedrock response received (XXX chars)
[apex-builders] Conversation stored successfully
[apex-builders] Request completed in XXms
```

## Knowledge Base

The function uses Bedrock Knowledge Base scoped to construction industry documents:

- Pricing and cost estimates
- Service timelines
- Project types and processes
- Warranty information
- Payment terms and conditions
- Common construction FAQs

Documents are stored in S3 bucket: `apex-builders-documents`

## Troubleshooting

### Lambda Timeout

**Error:** Task timed out after 30.00 seconds

**Solution:** Increase Lambda timeout to 60 seconds
- Go to Lambda console → Configuration → General configuration → Timeout

### DynamoDB Write Throttled

**Error:** ProvisionedThroughputExceededException

**Solution:** Increase write capacity
- Go to DynamoDB console → apex-builders-conversations → Capacity tab
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

**Solution:** Check that documents are uploaded to S3 and indexed in Bedrock Knowledge Base

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

## Local Testing (Optional)

For local testing, install AWS SAM CLI:

```bash
pip install aws-sam-cli

# Start local API
sam local start-api

# In another terminal
curl -X POST http://localhost:3000/apex-builders \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-456",
    "message": "Do you offer free estimates?"
  }'
```

## Dependencies

- `@aws-sdk/client-bedrock-runtime` - Bedrock API
- `@aws-sdk/client-dynamodb` - DynamoDB API

## License

MIT
