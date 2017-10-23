'use strict';

module.exports = class ThundraMonitorCWPlugin {

    constructor(serverless) {
        this.provider = 'aws';
        this.serverless = serverless;
        this.hooks = {
            'before:deploy:createDeploymentArtifacts': this.beforeDeployCreateDeploymentArtifacts.bind(this)
        };
    }

    beforeDeployCreateDeploymentArtifacts() {
        const cli = this.serverless.cli;
        const service = this.serverless.service;
        const serviceName = service.service;
        const functions = service.functions;

        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

        var nodeModuleDir = require("os").homedir() + "/node_modules";
        if (service.custom && service.custom.nodeModuleDir) {
            nodeModuleDir = service.custom.nodeModuleDir;
        }
        const thundraMonitorCWArtifactPath = nodeModuleDir + "/serverless-plugin-thundra-monitor-cw/thundra-monitor-cw.jar";

        cli.log("[THUNDRA] Using Thundra monitor CloudWatch artifact from " + thundraMonitorCWArtifactPath + " ...");

        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

        var thundraAccessToken = null;
        if (service.custom && service.custom.thundraAccessToken) {
            thundraAccessToken = service.custom.thundraAccessToken;
        }
        
        if (thundraAccessToken == null) {
            throw new Error(
                "[THUNDRA] Thundra access token must be provided by 'thundraAccessToken' variable " +
                "on 'custom' property!");
        }

        if (functions) {
            const aws = this.serverless.getProvider('aws');

            const template = service.provider.compiledCloudFormationTemplate;
            template.Resources = template.Resources || {};

            ///////////////////////////////////////////////////////////////////////////////////////////////////////////

            const thundraMonitorFnName = "thundra-monitor-" + serviceName;
            const thundraMonitorNormalizedFunctionName = aws.naming.getNormalizedFunctionName(thundraMonitorFnName);
            const thundraMonitorLogGroupId = thundraMonitorNormalizedFunctionName + "LogGroup";
            const thundraMonitorLogGroupName = "/aws/lambda/" + thundraMonitorFnName;

            ///////////////////////////////////////////////////////////////////////////////////////////////////////////

            cli.log("[THUNDRA] Adding log group " + thundraMonitorLogGroupName + " for Thundra monitor Lambda ...");

            const thundraMonitorLogGroupResource = {
                Type: "AWS::Logs::LogGroup",
                Properties: {
                    LogGroupName: thundraMonitorLogGroupName
                }
            };
            template.Resources[thundraMonitorLogGroupId] = thundraMonitorLogGroupResource;

            ///////////////////////////////////////////////////////////////////////////////////////////////////////////

            const thundraMonitorRoleName = "ThundraMonitorRole";

            cli.log("[THUNDRA] Adding " + thundraMonitorRoleName + " role for accessing Thundra account resources ...");

            var thundraAwsAccountId = "269863060030";
            if (service.custom && service.custom.thundraAwsAccountId) {
                thundraAwsAccountId = service.custom.thundraAwsAccountId;
            }

            var thundraAwsRegion = "us-west-2";
            if (service.custom && service.custom.thundraAwsRegion) {
                thundraAwsRegion = service.custom.thundraAwsRegion;
            }

            var thundraMonitorDataStreamName = "monitorDataStream";
            if (service.custom && service.custom.thundraMonitorDataStreamName) {
                thundraMonitorDataStreamName = service.custom.thundraMonitorDataStreamName;
            }

            var thundraMonitorDataStreamAccessAssumedRoleName = "monitorDataStream_putAccess";
            if (service.custom && service.custom.thundraMonitorDataStreamAccessAssumedRoleName) {
                thundraMonitorDataStreamAccessAssumedRoleName = service.custom.thundraMonitorDataStreamAccessAssumedRoleName;
            }

            const targetLogGroups = [];
            targetLogGroups.push({
                    "Fn::Join": [
                        "", 
                        [ 
                            "arn:aws:logs:", 
                            { "Ref": "AWS::Region" }, 
                            ":", 
                            { "Ref": "AWS::AccountId" }, 
                            ":log-group:" + thundraMonitorLogGroupName + ":*" 
                        ]
                    ]
                });
            Object.keys(functions).forEach(functionName => {
                const logGroupName = "/aws/lambda/" + functionName;
                targetLogGroups.push({
                    "Fn::Join": [
                        "", 
                        [ 
                            "arn:aws:logs:", 
                            { "Ref": "AWS::Region" }, 
                            ":", 
                            { "Ref": "AWS::AccountId" }, 
                            ":log-group:" + logGroupName + ":*" 
                        ]
                    ]
                });
            });

            const thundraMonitorRoleResource = {
                Type: "AWS::IAM::Role",
                Properties: {
                    RoleName: "ThundraMonitorRole",
                    AssumeRolePolicyDocument: {
                        Version: "2012-10-17",
                        Statement: [{
                            Effect: "Allow",
                            Principal: {
                                Service: [ "lambda.amazonaws.com" ]
                            },
                            Action: "sts:AssumeRole"
                        }]   
                    },
                    Policies: [
                        {
                            PolicyName: "ThundraMonitorLogRole",
                            PolicyDocument: {
                                Version : "2012-10-17",
                                Statement: [{
                                    Effect: "Allow",
                                    Action: "logs:*",
                                    Resource: targetLogGroups
                                }]
                            }
                        },
                        {
                            PolicyName: "ThundraMonitorAssumeRole",
                            PolicyDocument: {
                                Version : "2012-10-17",
                                Statement: [{
                                    Effect: "Allow",
                                    Action: "sts:AssumeRole",
                                    Resource: [ "arn:aws:iam::" + thundraAwsAccountId + ":role/" + thundraMonitorDataStreamAccessAssumedRoleName ]
                                }]
                            }
                        },
                        {
                            PolicyName: "ThundraMonitorPutToFirehoseRole",
                            PolicyDocument: {
                                Version : "2012-10-17",
                                Statement: [{
                                    Effect: "Allow",
                                    Action: [ "firehose:PutRecord", "firehose:PutRecordBatch" ],
                                    Resource: [ "arn:aws:firehose:" + thundraAwsRegion + ":" + thundraAwsAccountId + ":deliverystream/" + thundraMonitorDataStreamName ]
                                }]
                            }
                        }
                    ]     
                }
            };
            template.Resources[thundraMonitorRoleName] = thundraMonitorRoleResource;

            ///////////////////////////////////////////////////////////////////////////////////////////////////////////

            cli.log("[THUNDRA] Adding Thundra monitor Lambda function ...");

            const thundraMonitorFn = {
                name: thundraMonitorFnName,
                description: "Thundra Monitoring over CloudWatch Logs",
                handler: "com.opsgenie.sirocco.monitor.handler.CloudWatchMonitoringDataHandler",
                role: thundraMonitorRoleName,
                package: {
                    artifact: thundraMonitorCWArtifactPath
                },
                environment: {
                    thundra_monitor_accessToken: thundraAccessToken,
                    thundra_monitor_awsAccountId: thundraAwsAccountId,
                    thundra_monitor_awsRegion: thundraAwsRegion,
                    thundra_monitor_dataStreamName: thundraMonitorDataStreamName,
                    thundra_monitor_dataStreamAccessAssumedRoleName: thundraMonitorDataStreamAccessAssumedRoleName
                },
                events: []
            };
            functions[thundraMonitorFnName] = thundraMonitorFn;

            ///////////////////////////////////////////////////////////////////////////////////////////////////////////

            Object.keys(functions).forEach(functionName => {
                const fn = functions[functionName];
                const thundraMonitorEnabled = fn.thundraMonitoredOverCW;

                if (thundraMonitorEnabled == true) {
                    const normalizedFunctionName = aws.naming.getNormalizedFunctionName(functionName);
                    const logGroupId = normalizedFunctionName + "LogGroup";
                    const logGroupName = "/aws/lambda/" + functionName;

                    ///////////////////////////////////////////////////////////////////////////////////////////////////

                    cli.log("[THUNDRA] Adding log group " + logGroupName + " for Lambda function " + functionName + " ...");

                    const logGroupResource = {
                        Type: "AWS::Logs::LogGroup",
                        Properties: {
                            LogGroupName: logGroupName
                        }
                    };
                    template.Resources[logGroupId] = logGroupResource;

                    ///////////////////////////////////////////////////////////////////////////////////////////////////

                    cli.log("[THUNDRA] Adding log subscription for log group " + logGroupName + " ...");

                    const logGroupSubscription = {
                        cloudwatchLog: {
                            logGroup: logGroupName,
                            filter: '{$.type = AuditData || $.type = MonitoredLog || $.type = StatData}'
                        }
                    };
                    thundraMonitorFn.events.push(logGroupSubscription);
                }
            });
        }
    }

};
