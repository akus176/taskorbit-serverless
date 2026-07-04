# TaskOrbit Monitoring

This document summarizes the monitoring, alerting, and cost-control setup for TaskOrbit, a portfolio serverless task manager deployed on AWS.

## 1. Monitoring Goals

The monitoring setup is designed to provide basic visibility into the main serverless components used by TaskOrbit:

- Track API Gateway traffic, latency, and error rates.
- Monitor Lambda usage, failures, and execution duration.
- Support troubleshooting through CloudWatch Logs.
- Send notifications when selected error conditions occur.
- Reduce the risk of unexpected AWS cost during demo and testing.

This setup is intended for a cloud/serverless portfolio project and demonstration environment. It does not claim full production observability coverage.

## 2. CloudWatch Dashboard

TaskOrbit uses a CloudWatch dashboard named `TaskManagerMonitoringDashboard`.

The dashboard provides a single view of key API Gateway and Lambda metrics:

- API Gateway Request Count
- API Gateway Average Latency
- API Gateway 4XX and 5XX Errors
- Lambda Invocations
- Lambda Errors
- Lambda Average Duration

These widgets help identify common operational issues such as increased request volume, client-side API errors, backend failures, or slower Lambda execution.

## 3. CloudWatch Alarms

TaskOrbit includes CloudWatch alarms for selected failure conditions:

| Alarm | Purpose |
| --- | --- |
| `APIGateway5XXAlarm` | Triggers when API Gateway reports 5XX server-side errors. |
| `LambdaCreateTaskErrorAlarm` | Triggers when `CreateTaskFunction` reports Lambda execution errors. |

The API Gateway alarm helps detect backend or integration failures surfaced through the REST API. The Lambda alarm focuses on the create-task workflow, which is a core user action in the application.

## 4. SNS Notifications

CloudWatch alarm actions are connected to an SNS topic with email notifications enabled.

When an alarm enters the configured alarm state, SNS sends an email notification to the subscribed address. This provides a simple alerting path suitable for demo monitoring and manual review.

## 5. CloudWatch Logs

CloudWatch Logs are used to inspect runtime behavior and troubleshoot failures across the serverless backend.

Logs are useful for reviewing:

- Lambda execution output and errors.
- API Gateway request or integration failures.
- DynamoDB access behavior from Lambda functions.
- Authentication or request-shaping issues that affect backend handlers.

During troubleshooting, logs should be reviewed alongside dashboard metrics and alarm history to understand both the failure signal and the underlying cause.

## 6. Cost Control

TaskOrbit uses several controls to limit unexpected cost during demonstration and testing:

- AWS Budget is configured to monitor and control unexpected AWS spending.
- Lambda reserved concurrency is configured to limit unexpected scaling.
- Lambda functions run in private subnets and access DynamoDB through a DynamoDB Gateway Endpoint.
- The architecture avoids a NAT Gateway, reducing recurring network cost.

These controls are especially important because the project is designed for portfolio sharing and manual demo usage rather than continuous production traffic.

## 7. Operational Notes

- Review `TaskManagerMonitoringDashboard` after testing core workflows such as creating, listing, updating, and deleting tasks.
- Check CloudWatch alarm history when investigating API or Lambda failures.
- Use CloudWatch Logs to inspect Lambda handler behavior and DynamoDB integration details.
- Confirm SNS email subscriptions before relying on alarm notifications.
- Keep Lambda reserved concurrency aligned with the current demo or testing needs.
- Do not commit AWS account IDs, access keys, secret keys, JWT tokens, live endpoint secrets, or personal email addresses to the repository.

## 8. Future Improvements

Potential improvements for a more complete monitoring setup include:

- Add alarms for elevated API Gateway 4XX errors and high latency.
- Add alarms for all Lambda functions, not only the create-task workflow.
- Add DynamoDB throttling and capacity-related alarms.
- Add structured JSON logging in Lambda handlers.
- Add CloudWatch Logs metric filters for common application errors.
- Add automated infrastructure deployment for monitoring resources using AWS CDK, SAM, Terraform, or CloudFormation.
- Add synthetic checks for the frontend and authenticated API workflows.
