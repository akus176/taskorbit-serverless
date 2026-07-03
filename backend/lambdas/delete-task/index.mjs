import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand
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
    const taskId = event.pathParameters?.id;

    if (!userId) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Unauthorized" })
      };
    }

    if (!taskId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "taskId is required" })
      };
    }

    await docClient.send(
      new DeleteCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          taskId
        },
        ConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId
        }
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Task deleted"
      })
    };
  } catch (err) {
    console.error(err);

    if (err.name === "ConditionalCheckFailedException") {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({
          message: "You are not allowed to delete this task"
        })
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: err.message
      })
    };
  }
};