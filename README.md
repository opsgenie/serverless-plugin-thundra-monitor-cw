# serverless-plugin-thundra-monitor-cw

This plugin is a [serverless framework](https://serverless.com/) plugin which subscribes Thundra monitoring Lambda to the monitored functions' CloudWatch log groups for listening and sending monitor datas asynchronously. 

## Installation

Install the plugin via NPM: 
```
npm install --save serverless-plugin-thundra-monitor-cw
```

Update the plugin to the latest version via NPM: 
```
npm update serverless-plugin-thundra-monitor-cw
```

## Configuration

- `thundraAccessToken`: Specifies your access token to be used for sending your monitor data to our side. This property is *mandatory*.
- `thundraMonitorFunctionMemorySize`: Configures the memory size in MB of the Lambda function which collects monitor data over CloudWatch. This property is *optional*. Default value is `512` MB.
- `thundraMonitorFunctionTimeout`: Configures the timeout in milliseconds of the Lambda function which collects monitor data over CloudWatch. This property is *optional*. Default value is `300` seconds (5 minutes).

Example configuration:
```yml
custom:
  ...
  thundraAccessToken: myAccessToken
  ...
```

## Usage

You need to mark your functions by setting `thundraMonitoredOverCW` flag to be monitored over AWS CloudWatch.

Example usage:
```yml
functions:
  my-function:
      ...
      thundraMonitoredOverCW: true
      ...
  ...    
```
