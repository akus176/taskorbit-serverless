import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand
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

    const body = JSON.parse(event.body || "{}");

    const allowedFields = ["title", "description", "priority", "dueDate", "status"];
    const updateFields = allowedFields.filter((field) => body[field] !== undefined);

    if (updateFields.length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          message: "No valid fields to update"
        })
      };
    }

    const updateExpression =
      "SET " + updateFields.map((field) => `#${field} = :${field}`).join(", ");

    const expressionAttributeNames = {};
    const expressionAttributeValues = {
      ":userId": userId
    };

    for (const field of updateFields) {
      expressionAttributeNames[`#${field}`] = field;
      expressionAttributeValues[`:${field}`] = body[field];
    }

    const result = await docClient.send(
      new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          taskId
        },
        UpdateExpression: updateExpression,
        ConditionExpression: "userId = :userId",
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW"
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Task updated",
        task: result.Attributes
      })
    };
  } catch (err) {
    console.error(err);

    if (err.name === "ConditionalCheckFailedException") {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({
          message: "You are not allowed to update this task"
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