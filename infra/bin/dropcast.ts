import * as cdk from "aws-cdk-lib";
import { DropcastStack } from "../lib/dropcast-stack.js";

const app = new cdk.App();

new DropcastStack(app, "DropcastStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
  domainName: "cmcxo.com",
  subDomain: "dropcast",
});
