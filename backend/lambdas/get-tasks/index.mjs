import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "http://localhost:5173",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
};

export const handler = async (event) => {
  try {
    const userId = event.requestContext?.authorizer?.claims?.sub;

    if (!userId) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Unauthorized" })
      };
    }

    const result = await docClient.send(
      new QueryCommand({
        TableName: process.env.TABLE_NAME,
        IndexName: "userId-index",
        KeyConditionExpression: "userId = :u",
        ExpressionAttributeValues: {
          ":u": userId
        }
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result.Items || [])
    };
  } catch (err) {
    console.error(err);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: err.message
      })
    };
  }
};