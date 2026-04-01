import * as cdk from "aws-cdk-lib";
import { PostcastifyStack } from "../lib/postcastify-stack.js";

const app = new cdk.App();

new PostcastifyStack(app, "PostcastifyStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
  domainName: "cmcxo.com",
  subDomain: "postcastify",
});
