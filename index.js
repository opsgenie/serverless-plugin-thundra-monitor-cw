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
        const me = this;
        const service = this.serverless.service;
        const aws = this.serverless.getProvider('aws');
        const stage = aws.options.stage;
        const region = aws.options.region;
        return aws.request(
                "S3",
                "listObjectVersions",
                {
                    Bucket: "thundra-dist-" + region,
                    Prefix: "thundra-monitor-cw.jar",
                },
                stage,
                region)
            .then(function(response, err) {
                    if (err) {
                        throw new me.serverless.classes.Error(err.message);
                    }
                    var thundraMonitorArtifactLatestVersionId = response.Versions[0].VersionId;
                    me.beforeDeployCreateDeploymentArtifacts0(thundraMonitorArtifactLatestVersionId);
                }
            );
    }

    beforeDeployCreateDeploymentArtifacts0(thundraMonitorArtifactLatestVersionId) {
        const cli = this.serverless.cli;
        const service = this.serverless.service;
        const serviceName = service.service;
        const functions = service.functions;

        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

        cli.log("[THUNDRA] Let the AWS Lambda Monitoring Begin ...");
        cli.log("[THUNDRA] =====================================================================");
        cli.log("[THUNDRA] Using Thundra Monitor artifact with version id " + thundraMonitorArtifactLatestVersionId + " ...");

        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

        var thundraApiKey = "N/A";
        if (service.custom && service.custom.thundraApiKey) {
            thundraApiKey = service.custom.thundraApiKey;
        }

        if (functions) {
            const aws = this.serverless.getProvider('aws');

            const template = service.provider.compiledCloudFormationTemplate;
            template.Resources = template.Resources || {};

            ///////////////////////////////////////////////////////////////////////////////////////////////////////////

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

            var thundraMonitorDataLambdaName = "thundra-collector-lambda";
            if (service.custom && service.custom.thundraMonitorDataLambdaName) {
                thundraMonitorDataLambdaName = service.custom.thundraMonitorDataLambdaName;
            }

            var thundraMonitorDataLambdaAccessAssumedRoleName = "monitorDataLambda_invokeAccess";
            if (service.custom && service.custom.thundraMonitorDataLambdaAccessAssumedRoleName) {
                thundraMonitorDataLambdaAccessAssumedRoleName = service.custom.thundraMonitorDataLambdaAccessAssumedRoleName;
            }

            var thundraMonitorFunctionMemorySize = 512;
            if (service.custom && service.custom.thundraMonitorFunctionMemorySize) {
                thundraMonitorFunctionMemorySize = service.custom.thundraMonitorFunctionMemorySize;
            }

            var thundraMonitorFunctionTimeout = 300;
            if (service.custom && service.custom.thundraMonitorFunctionTimeout) {
                thundraMonitorFunctionTimeout = service.custom.thundraMonitorFunctionTimeout;
            }

            var skipAllLogGroupCreations = false;
            if (service.custom && service.custom.skipAllLogGroupCreations) {
                skipAllLogGroupCreations = service.custom.skipAllLogGroupCreations;
            }

            ///////////////////////////////////////////////////////////////////////////////////////////////////////////

            const thundraMonitorFnName = "thundra-monitor-cw-" + serviceName;
            const thundraMonitorNormalizedFunctionName = aws.naming.getNormalizedFunctionName(thundraMonitorFnName);

            ///////////////////////////////////////////////////////////////////////////////////////////////////////////

            const thundraMonitorLogGroupResourceId = thundraMonitorNormalizedFunctionName + "LogGroup";
            const thundraMonitorLogGroupName = "/aws/lambda/" + thundraMonitorFnName;

            cli.log("[THUNDRA] Adding log group " + thundraMonitorLogGroupName + " for Thundra monitor Lambda ...");

            const thundraMonitorLogGroupResource = {
                Type: "AWS::Logs::LogGroup",
                Properties: {
                    LogGroupName: thundraMonitorLogGroupName
                }
            };
            template.Resources[thundraMonitorLogGroupResourceId] = thundraMonitorLogGroupResource;

            ///////////////////////////////////////////////////////////////////////////////////////////////////////////

            const thundraMonitorRoleResourceId = thundraMonitorNormalizedFunctionName + "Role";
            const thundraMonitorRoleName = thundraMonitorFnName + "Role";

            cli.log("[THUNDRA] Adding " + thundraMonitorRoleName + " role for accessing Thundra account resources ...");

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
                    RoleName: thundraMonitorRoleName,
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
                            PolicyName: thundraMonitorRoleName + "LogRole",
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
                            PolicyName: thundraMonitorRoleName + "S3Role",
                            PolicyDocument: {
                                Version : "2012-10-17",
                                Statement: [{
                                    Effect: "Allow",
                                    Action: "s3:GetObject",
                                    Resource: {
                                        "Fn::Join": [
                                            "", 
                                            [ 
                                                "arn:aws:s3:::",
                                                "thundra-dist-", 
                                                { "Ref": "AWS::Region" },
                                                "/thundra-monitor-cw-conf.properties"
                                            ]
                                         ]
                                    }
                                }]
                            }
                        },
                        {
                            PolicyName: thundraMonitorRoleName + "AssumeRole",
                            PolicyDocument: {
                                Version : "2012-10-17",
                                Statement: [
                                    {
                                        Effect: "Allow",
                                        Action: "sts:AssumeRole",
                                        Resource: [ "arn:aws:iam::" + thundraAwsAccountId + ":role/" + thundraMonitorDataStreamAccessAssumedRoleName ]
                                    },
                                    {
                                        Effect: "Allow",
                                        Action: "sts:AssumeRole",
                                        Resource: [ "arn:aws:iam::" + thundraAwsAccountId + ":role/" + thundraMonitorDataLambdaAccessAssumedRoleName ]
                                    }
                                ]
                            }
                        },
                        {
                            PolicyName: thundraMonitorRoleName + "PutToStreamRole",
                            PolicyDocument: {
                                Version : "2012-10-17",
                                Statement: [
                                    {
                                        Effect: "Allow",
                                        Action: [ "firehose:PutRecord", "firehose:PutRecordBatch" ],
                                        Resource: [ "arn:aws:firehose:" + thundraAwsRegion + ":" + thundraAwsAccountId + ":deliverystream/" + thundraMonitorDataStreamName ]
                                    },
                                    {
                                        Effect: "Allow",
                                        Action: [ "kinesis:PutRecord", "kinesis:PutRecords" ],
                                        Resource: [ "arn:aws:kinesis:" + thundraAwsRegion + ":" + thundraAwsAccountId + ":stream/" + thundraMonitorDataStreamName ]
                                    }
                                ]
                            }
                        },
                        {
                            PolicyName: thundraMonitorRoleName + "InvokeLambdaRole",
                            PolicyDocument: {
                                Version : "2012-10-17",
                                Statement: [
                                    {
                                        Effect: "Allow",
                                        Action: [ "lambda:InvokeFunction" ],
                                        Resource: [ "arn:aws:lambda:" + thundraAwsRegion + ":" + thundraAwsAccountId + ":function:" + thundraMonitorDataLambdaName ]
                                    }
                                ]
                            }
                        }
                    ]     
                }
            };
            template.Resources[thundraMonitorRoleResourceId] = thundraMonitorRoleResource;

            ///////////////////////////////////////////////////////////////////////////////////////////////////////////

            cli.log("[THUNDRA] Adding Thundra monitor Lambda function ...");

            const thundraMonitorFnResourceId = thundraMonitorNormalizedFunctionName;
            const date = new Date();
            const thundraMonitorFnResource = {
                Type: "AWS::Lambda::Function",
                Properties: {
                    FunctionName: thundraMonitorFnName,
                    Description: "Thundra Monitoring over CloudWatch Logs",
                    Handler: "com.opsgenie.thundra.monitor.cw.MonitorDataCloudWatchHandler",
                    Role: {
                        "Fn::Join": [
                            "", 
                            [ 
                                "arn:aws:iam::", 
                                { "Ref": "AWS::AccountId" }, 
                                ":role/" + thundraMonitorRoleName 
                            ]
                         ]
                    },
                    MemorySize: thundraMonitorFunctionMemorySize,
                    Runtime: "java8",
                    Timeout: thundraMonitorFunctionTimeout,
                    Code: {
                        S3Bucket: {
                            "Fn::Join": [
                                "", 
                                [ 
                                    "thundra-dist-", 
                                    { "Ref": "AWS::Region" }
                                ]
                             ]
                        },
                        S3Key: "thundra-monitor-cw.jar",
                        S3ObjectVersion: thundraMonitorArtifactLatestVersionId
                    },
                    Environment: {
                        Variables: {
                            thundra_apiKey: thundraApiKey,
                            thundra_awsAccountId: thundraAwsAccountId,
                            thundra_awsRegion: thundraAwsRegion,
                            thundra_dataStreamName: thundraMonitorDataStreamName,
                            thundra_dataStreamAccessAssumedRoleName: thundraMonitorDataStreamAccessAssumedRoleName,
                            thundra_dataLambdaName: thundraMonitorDataLambdaName,
                            thundra_dataLambdaAccessAssumedRoleName: thundraMonitorDataLambdaAccessAssumedRoleName,
                            thundra_deployTime: date
                        }
                    }
                },
                DependsOn: [ thundraMonitorRoleResourceId ]
            }      
            template.Resources[thundraMonitorFnResourceId] = thundraMonitorFnResource;  

            const thundraMonitorFnVersionResourceId = thundraMonitorNormalizedFunctionName + "Version";
            const thundraMonitorFnVersionResource = {
                Type: "AWS::Lambda::Version",
                DeletionPolicy: "Retain",
                Properties: {          
                    FunctionName: {
                        Ref: thundraMonitorFnResourceId
                    }
                }
            }
            template.Resources[thundraMonitorFnVersionResourceId] = thundraMonitorFnVersionResource;  

            ///////////////////////////////////////////////////////////////////////////////////////////////////////////

            Object.keys(functions).forEach(functionName => {
                const fn = functions[functionName];
                var fnName = functionName;
                if (fn.name) {
                    fnName = fn.name;
                }
                const thundraMonitorEnabled = fn.thundraMonitoredOverCW;
                var skipLogGroupCreation = fn.skipLogGroupCreation;
                if (skipAllLogGroupCreations == true) {
                    skipLogGroupCreation = true;
                } 

                if (thundraMonitorEnabled == true) {
                    const normalizedFunctionName = aws.naming.getNormalizedFunctionName(fnName);
                    const logGroupResourceId = normalizedFunctionName + "LogGroup";
                    const logGroupName = "/aws/lambda/" + fnName;

                    ///////////////////////////////////////////////////////////////////////////////////////////////////

                    if (skipLogGroupCreation != true) {
                        cli.log("[THUNDRA] Adding log group " + logGroupName + " for Lambda function " + fnName + " ...");

                        const logGroupResource = {
                            Type: "AWS::Logs::LogGroup",
                            Properties: {
                                LogGroupName: logGroupName
                            }
                        };
                        template.Resources[logGroupResourceId] = logGroupResource;
                    } else {
                        cli.log("[THUNDRA] Skipping log group " + logGroupName + " creationg for Lambda function " + fnName + " ...");
                    }

                    ///////////////////////////////////////////////////////////////////////////////////////////////////

                    cli.log("[THUNDRA] Adding log group permission for log group " + logGroupName + " ...");

                    const lambdaLogGroupPermissionResourceId = normalizedFunctionName + "LogGroupPermission";
                    const lambdaLogGroupPermissionResourceDepdendencies = [ thundraMonitorFnResourceId ];
                    if (skipLogGroupCreation != true) {
                        lambdaLogGroupPermissionResourceDepdendencies.push(logGroupResourceId);
                    }    
                    const lambdaLogGroupPermissionResource = {
                        Type: "AWS::Lambda::Permission",
                        Properties: {
                            Action: "lambda:InvokeFunction",
                            FunctionName: {
                                "Fn::Join": [
                                    "", 
                                    [ 
                                        "arn:aws:lambda:", 
                                        { "Ref": "AWS::Region" }, 
                                        ":", 
                                        { "Ref": "AWS::AccountId" }, 
                                        ":function:" + thundraMonitorFnName 
                                    ]
                                ]
                            },
                            Principal: {
                                "Fn::Join": [ 
                                    "", 
                                    [
                                        "logs.", 
                                        { "Ref": "AWS::Region" }, 
                                        ".amazonaws.com"
                                    ] 
                                ]
                            },
                            SourceAccount: { "Ref": "AWS::AccountId" },
                            SourceArn: {
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
                            }
                        },
                        DependsOn: lambdaLogGroupPermissionResourceDepdendencies  
                    }
                    template.Resources[lambdaLogGroupPermissionResourceId] = lambdaLogGroupPermissionResource;

                    ///////////////////////////////////////////////////////////////////////////////////////////////////

                    cli.log("[THUNDRA] Adding log subscription for log group " + logGroupName + " ...");

                    const logGroupSubscriptionId = aws.naming.getNormalizedFunctionName(fnName + "Subscription");
                    const logGroupSubscriptionResourceDepdendencies = [ thundraMonitorFnResourceId, lambdaLogGroupPermissionResourceId ];
                    if (skipLogGroupCreation != true) {
                        logGroupSubscriptionResourceDepdendencies.push(logGroupResourceId);
                    }  
                    const logGroupSubscriptionResource = {
                        Type : "AWS::Logs::SubscriptionFilter",
                        Properties: {
                            DestinationArn: {
                                "Fn::Join": [
                                    "", 
                                    [ 
                                        "arn:aws:lambda:", 
                                        { "Ref": "AWS::Region" }, 
                                        ":", 
                                        { "Ref": "AWS::AccountId" }, 
                                        ":function:" + thundraMonitorFnName 
                                    ]
                                ]
                            },
                            FilterPattern: '{$.type = AuditData || $.type = MonitoredLog || $.type = StatData}',
                            LogGroupName: logGroupName,
                        },
                        DependsOn: logGroupSubscriptionResourceDepdendencies
                    }
                    template.Resources[logGroupSubscriptionId] = logGroupSubscriptionResource;
                }
            });

            cli.log("[THUNDRA] =====================================================================");
        }
    }

};
