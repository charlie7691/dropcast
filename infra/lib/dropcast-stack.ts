import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { Construct } from "constructs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface DropcastStackProps extends cdk.StackProps {
  domainName: string;
  subDomain: string;
}

export class DropcastStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DropcastStackProps) {
    super(scope, id, props);

    const fullDomain = `${props.subDomain}.${props.domainName}`;
    const repoRoot = resolve(__dirname, "..", "..");

    // --- Hosted Zone ---
    const zone = new route53.HostedZone(this, "Zone", {
      zoneName: props.domainName,
    });

    // --- ACM Certificate (must be us-east-1 for CloudFront) ---
    const certificate = new acm.Certificate(this, "Certificate", {
      domainName: fullDomain,
      validation: acm.CertificateValidation.fromDns(zone),
      certificateName: `dropcast-${props.subDomain}`,
    });

    // --- S3: Data Bucket ---
    const dataBucket = new s3.Bucket(this, "DataBucket", {
      bucketName: `dropcast-data-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // --- S3: Web Bucket ---
    const webBucket = new s3.Bucket(this, "WebBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // --- Lambda Function ---
    const fn = new nodejs.NodejsFunction(this, "ApiFunction", {
      entry: resolve(repoRoot, "api", "src", "lambda.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        DATA_BUCKET: dataBucket.bucketName,
        NODE_OPTIONS: "--enable-source-maps",
        DROPBOX_APP_KEY: process.env.DROPBOX_APP_KEY || "",
        DROPBOX_APP_SECRET: process.env.DROPBOX_APP_SECRET || "",
        ONEDRIVE_CLIENT_ID: process.env.ONEDRIVE_CLIENT_ID || "",
        ONEDRIVE_CLIENT_SECRET: process.env.ONEDRIVE_CLIENT_SECRET || "",
      },
      bundling: {
        format: nodejs.OutputFormat.ESM,
        target: "node20",
        mainFields: ["module", "main"],
        esbuildArgs: {
          "--conditions": "module",
        },
        banner:
          "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
      },
    });

    dataBucket.grantReadWrite(fn);

    const fnUrl = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    // --- CloudFront Distribution ---
    const lambdaOrigin = new origins.FunctionUrlOrigin(fnUrl);
    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(webBucket);

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        "/api/*": {
          origin: lambdaOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
        "/rss/*": {
          origin: lambdaOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: new cloudfront.CachePolicy(this, "RssCachePolicy", {
            defaultTtl: cdk.Duration.minutes(5),
            maxTtl: cdk.Duration.minutes(60),
            minTtl: cdk.Duration.minutes(0),
          }),
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
      defaultRootObject: "index.html",
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(0),
        },
      ],
      domainNames: [fullDomain],
      certificate,
    });

    // --- Deploy SPA to S3 ---
    new s3deploy.BucketDeployment(this, "DeploySPA", {
      sources: [s3deploy.Source.asset(resolve(repoRoot, "web", "dist"))],
      destinationBucket: webBucket,
      distribution,
      distributionPaths: ["/*"],
    });

    // --- DNS Record ---
    new route53.ARecord(this, "AliasRecord", {
      zone,
      recordName: props.subDomain,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution)
      ),
    });

    // --- Outputs ---
    new cdk.CfnOutput(this, "NameServers", {
      value: cdk.Fn.join(", ", zone.hostedZoneNameServers!),
      description: "Update domain registration to use these nameservers",
    });
    new cdk.CfnOutput(this, "Url", {
      value: `https://${fullDomain}`,
    });
    new cdk.CfnOutput(this, "DistributionId", {
      value: distribution.distributionId,
    });
    new cdk.CfnOutput(this, "DataBucketName", {
      value: dataBucket.bucketName,
    });
    new cdk.CfnOutput(this, "FunctionUrl", {
      value: fnUrl.url,
    });
  }
}
