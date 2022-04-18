
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as CodePipeline from 'aws-cdk-lib/aws-codepipeline';
import * as CodePipelineAction from 'aws-cdk-lib/aws-codepipeline-actions';
import * as CodeBuild from 'aws-cdk-lib/aws-codebuild';

    

export class dinningByFriendBuildStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
        const stackName = 'dinningByFriendMainStack';
    
        
        const sourceOutput = new CodePipeline.Artifact();
    
        const CDKOutput = new CodePipeline.Artifact()
        
        const cdkBuild = new CodeBuild.PipelineProject(this, 'dinningByFriendMain-buildstack', {
          buildSpec: CodeBuild.BuildSpec.fromObject({
            version: '0.2',
            phases: {
              install: {
                "runtime-versions": {
                  "nodejs": 12
                },
                commands: [
                  'npm install'
                ],
              },
              build: {
                commands: [
                  'npm run build',
                  'npm run cdk synth -- -o dist'
                ]
              }
            },
            artifacts: {
              'base-directory': 'dist',
              files: [
                `${stackName}.template.json`
              ]
            }
          }),
          environment: {
            buildImage: CodeBuild.LinuxBuildImage.STANDARD_3_0
          }
        })
        
        const pipeline = new CodePipeline.Pipeline(this, 'dinningByFriendMainStack-cdkPipelineApp', {
          pipelineName: 'dinningByFriendGraph-pipeline',
          crossAccountKeys: false,
          restartExecutionOnUpdate: true
        })

        //cdk deploy MyStack --parameters githubAccessTokenSecret=your secrets.
    const githubAccess = new cdk.CfnParameter(this, 'githubAccessTokenSecret', {
        type: 'String',
        description: 'write your github secret here'
  
      })
    
        pipeline.addStage({
          stageName: 'Source',
          actions: [
            new CodePipelineAction.GitHubSourceAction({
              actionName: 'Checkout',
              owner: 'shahzain-lab',
              repo: 'AWSCDK-DinningByFriend-GraphDB',
              oauthToken: cdk.SecretValue.plainText(githubAccess.valueAsString),
              output: sourceOutput,
              branch: 'master',
            })
          ]
        })
    
        pipeline.addStage({
          stageName: 'Build',
          actions: [
            new CodePipelineAction.CodeBuildAction({
              actionName: 'cdkBuild',
              project: cdkBuild,
              input: sourceOutput,
              outputs: [CDKOutput],
            }),
          ],
        })
    
        pipeline.addStage({
          stageName: 'DeployCDK',
          actions: [
            new CodePipelineAction.CloudFormationCreateUpdateStackAction({
              actionName: "AdministerPipeline",
              templatePath: CDKOutput.atPath(`${stackName}.template.json`),   ///Input artifact with the CloudFormation template to deploy
              stackName: stackName,                                           ///Name of stack
              adminPermissions: true  
            }),
          ],
        })

    // stack out
      }
    }
    
