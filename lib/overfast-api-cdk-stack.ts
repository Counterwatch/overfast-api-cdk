import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Period } from 'aws-cdk-lib/aws-apigateway';

export class OverfastApiCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Lambda from Docker image
    const overfastLambda = new lambda.DockerImageFunction(this, 'OverfastApiLambda', {
      code: lambda.DockerImageCode.fromImageAsset('../overfast-api'),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      architecture: lambda.Architecture.ARM_64,
    });

    // 2. API Gateway REST API in front of Lambda
    const api = new apigateway.LambdaRestApi(this, 'OverfastApi', {
      handler: overfastLambda,
      proxy: true, // forwards all routes to Lambda
      deployOptions: {
        stageName: 'prod', // change as needed
        // Optional: setup stage logging, throttling, etc.
      },
      // You can set endpointConfiguration: { types: [apigateway.EndpointType.REGIONAL] } if desired
    });

    // 3. Generate API Key
    const apiKey = api.addApiKey('OverfastApiKey', {
      apiKeyName: 'overfast-api-key',
      // Optionally: value: 'your-preferred-key-value' // leave out for random
    });

    // 4. Usage plan (rate limiting)
    const plan = api.addUsagePlan('OverfastApiUsagePlan', {
      name: 'OverfastUsagePlan',
      throttle: {
        rateLimit: 40,       // max 40/sec sustained
        burstLimit: 100,      // up to 100 instantly
      },
      quota: {
        limit: 400000,        // 400k/day
        period: Period.DAY, // per day
      },
    });

    // 5. Attach API Key and API Stage to Usage Plan
    plan.addApiKey(apiKey);
    plan.addApiStage({
      stage: api.deploymentStage,
      api,
    });

    // 6. Output the API endpoint and API key
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url ?? 'No endpoint',
    });

    new cdk.CfnOutput(this, 'ApiKeyValue', {
      value: apiKey.keyId, // This is the logical id; to get the actual key, see below!
      description: 'Find the actual API key value in the API Gateway Console > API Keys',
    });
  }
}
