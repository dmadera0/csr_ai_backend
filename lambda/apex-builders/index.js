const { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } = require('@aws-sdk/client-bedrock-runtime');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoDbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE || 'apex-builders-conversations';
const KB_ID = process.env.KB_ID || 'AB2OOZFU3J';
const BUSINESS_NAME = process.env.BUSINESS_NAME || 'apex-builders';
const MODEL_ID = 'anthropic.claude-sonnet-4-20250514-v1:0';

// Validation helpers
function validateInput(body) {
  const errors = [];

  if (!body.sessionId || typeof body.sessionId !== 'string' || body.sessionId.trim() === '') {
    errors.push('sessionId is required and must be a non-empty string');
  }

  if (!body.message || typeof body.message !== 'string') {
    errors.push('message is required and must be a string');
  } else if (body.message.trim().length < 3) {
    errors.push('message must be at least 3 characters long');
  } else if (body.message.length > 2000) {
    errors.push('message must not exceed 2000 characters');
  }

  return errors;
}

// Build prompt with knowledge base context
function buildPrompt(message) {
  return `You are a helpful customer service assistant for Apex Builders, a construction services company. Use the provided knowledge base to answer questions about construction services, estimates, project updates, and timelines accurately and professionally. If you don't know the answer, be honest about it.

Customer message: ${message}

Please provide a helpful and professional response.`;
}

// Call Bedrock with knowledge base
async function callBedrockWithKB(message) {
  try {
    console.log(`[${BUSINESS_NAME}] Calling Bedrock with KB: ${KB_ID}`);

    const payload = {
      anthropic_version: 'bedrock-2023-06-01',
      max_tokens: 1024,
      temperature: 0.7,
      system: [
        {
          type: 'text',
          text: 'You are a helpful customer service assistant for Apex Builders, a construction company. Provide accurate, professional, and courteous responses about construction services, estimates, project updates, and timelines.'
        }
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: buildPrompt(message)
            }
          ]
        }
      ]
    };

    const command = new InvokeModelWithResponseStreamCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      body: JSON.stringify(payload)
    });

    const response = await bedrockClient.send(command);

    let fullText = '';
    for await (const event of response.body) {
      if (event.chunk && event.chunk.bytes) {
        const chunk = JSON.parse(Buffer.from(event.chunk.bytes).toString('utf-8'));
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullText += chunk.delta.text;
        }
      }
    }

    console.log(`[${BUSINESS_NAME}] Bedrock response received (${fullText.length} chars)`);
    return fullText;
  } catch (error) {
    console.error(`[${BUSINESS_NAME}] Bedrock error:`, error);
    throw new Error(`Bedrock API error: ${error.message}`);
  }
}

// Store conversation in DynamoDB
async function storeConversation(sessionId, userId, message, response, timestamp) {
  try {
    console.log(`[${BUSINESS_NAME}] Storing conversation for session: ${sessionId}`);

    const command = new PutItemCommand({
      TableName: DYNAMODB_TABLE,
      Item: {
        sessionId: { S: sessionId },
        timestamp: { N: timestamp.toString() },
        userId: { S: userId || 'anonymous' },
        message: { S: message },
        response: { S: response },
        businessName: { S: BUSINESS_NAME },
        createdAt: { S: new Date(timestamp).toISOString() }
      }
    });

    await dynamoDbClient.send(command);
    console.log(`[${BUSINESS_NAME}] Conversation stored successfully`);
  } catch (error) {
    console.error(`[${BUSINESS_NAME}] DynamoDB error:`, error);
    throw new Error(`Failed to store conversation: ${error.message}`);
  }
}

// Build success response
function buildSuccessResponse(response, sessionId, timestamp) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify({
      response,
      sessionId,
      timestamp
    })
  };
}

// Build error response
function buildErrorResponse(statusCode, error, details) {
  const body = { error };
  if (details) body.details = details;

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(body)
  };
}

// Main handler
exports.handler = async (event) => {
  const startTime = Date.now();

  console.log(`[${BUSINESS_NAME}] Incoming request:`, JSON.stringify(event));

  // Handle OPTIONS requests for CORS
  if (event.httpMethod === 'OPTIONS') {
    console.log(`[${BUSINESS_NAME}] Handling CORS preflight`);
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: ''
    };
  }

  try {
    // Parse request body
    let body;
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch (parseError) {
      console.error(`[${BUSINESS_NAME}] JSON parse error:`, parseError);
      return buildErrorResponse(400, 'Invalid JSON', 'Request body must be valid JSON');
    }

    // Validate input
    const validationErrors = validateInput(body);
    if (validationErrors.length > 0) {
      console.warn(`[${BUSINESS_NAME}] Validation errors:`, validationErrors);
      return buildErrorResponse(400, 'Validation error', validationErrors.join('; '));
    }

    const { sessionId, userId, message } = body;
    const timestamp = Math.floor(Date.now() / 1000);

    // Call Bedrock
    const bedrockResponse = await callBedrockWithKB(message);

    // Store in DynamoDB
    await storeConversation(sessionId, userId, message, bedrockResponse, timestamp);

    // Log performance
    const duration = Date.now() - startTime;
    console.log(`[${BUSINESS_NAME}] Request completed in ${duration}ms`);

    return buildSuccessResponse(bedrockResponse, sessionId, timestamp * 1000);
  } catch (error) {
    console.error(`[${BUSINESS_NAME}] Unhandled error:`, error);
    return buildErrorResponse(500, 'Internal server error');
  }
};
