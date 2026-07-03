import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "http://localhost:5173",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
};

export const handler = async (event) => {
  try {
    console.log("EVENT:", JSON.stringify(event, null, 2));
    console.log("TABLE_NAME:", process.env.TABLE_NAME);

    const userId = event.requestContext?.authorizer?.claims?.sub;

    if (!userId) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Unauthorized" })
      };
    }

    const body = JSON.parse(event.body || "{}");

    const taskId = randomUUID();

    const item = {
      taskId,
      userId,
      title: body.title || "Untitled task",
      description: body.description || "",
      priority: body.priority || "medium",
      dueDate: body.dueDate || "",
      status: "pending",
      createdAt: new Date().toISOString()
    };

    console.log("TASK_ID:", taskId);
    console.log("ITEM_KEYS:", Object.keys(item));
    console.log("ITEM_TO_SAVE:", JSON.stringify(item, null, 2));

    await docClient.send(
      new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: item
      })
    );

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify(item)
    };
  } catch (err) {
    console.error("CREATE_TASK_ERROR:", err);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: err.message
      })
    };
  }
};