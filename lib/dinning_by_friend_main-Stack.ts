import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as neptune from 'aws-cdk-lib/aws-neptune'
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as appsync from '@aws-cdk/aws-appsync-alpha';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { GRAPHQL_MUTATION, GRAPHQL_QUERIES } from '../utils/resolver-fields';

export class dinningByFriendMainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    // VPC instanse //
    const vpc = new ec2.Vpc(this, 'vpc', {
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'myGraphAPISubnet',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED
        }
      ]
    })

    // security groups //
    const sgGraph = new ec2.SecurityGroup(this,  "GraphapiSG", {
      vpc,
      allowAllOutbound: true,
      securityGroupName: "GraphapiSecurityGroup" 
    })
    cdk.Tags.of(sgGraph).add("Name", "neptuneSecurityGroupGraph");
    sgGraph.addIngressRule(sgGraph, ec2.Port.tcp(8182), 'SG-DBRule')
    
    
    // neptune DB subnet //
    const neptuneSubnet = new neptune.CfnDBSubnetGroup(this, "neptunesubnetgroup", {
      dbSubnetGroupDescription:" neptune Subnet",
      subnetIds: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds,
      dbSubnetGroupName: "neptunesubnetgroup",
    }
    ); 

    // neptune DB cluster //
    const neptuneCluster = new neptune.CfnDBCluster(this, "neptuneCluster", {
      dbSubnetGroupName: neptuneSubnet.dbSubnetGroupName,
      dbClusterIdentifier: "graphDBCluster",
      vpcSecurityGroupIds: [sgGraph.securityGroupId],
    });
    neptuneCluster.addDependsOn(neptuneSubnet);

    // Creating neptune instance
    const neptuneInstance = new neptune.CfnDBInstance(this, "neptuneinstance", {
      dbInstanceClass: "db.t3.medium",
      dbClusterIdentifier: neptuneCluster.dbClusterIdentifier,
      availabilityZone: vpc.availabilityZones[0],
    });
    neptuneInstance.addDependsOn(neptuneCluster);

     // creating User Pool //
     const userPool = new cognito.UserPool(this, `${this.stackName}_USER_POOL`, {
      selfSignUpEnabled: true,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      autoVerify: { email: true, },
      standardAttributes: {
        email: { required: true },
      },
    })
    const userPoolClient = new cognito.UserPoolClient(this, `${this.stackName}_USER_POOL_CLIENT`, {
      userPool,
    });


    // creating restaurant api
    const restaurantGraphApi = new appsync.GraphqlApi(this, 'restaurantGraphAPi', {
      name: 'restaurant-graph',
      schema: appsync.Schema.fromAsset('graphql/schema.gql'),
         authorizationConfig: {
          defaultAuthorization: {
            userPoolConfig: { userPool },
            authorizationType: appsync.AuthorizationType.USER_POOL,
          },
        },
    })

    // creating lambdas //
    const lambdaNames = {
      queryHandler: "queryHandler",
      mutationHandler: "mutationHandler",
      addPersonHandler: "addPersonHandler",
    }
    
    const lambdaFn: {[P in keyof typeof lambdaNames ]?: lambda.IFunction} = {}

    Object.keys(lambdaNames).forEach(name => {
      const key = name as keyof typeof lambdaNames;
      lambdaFn[key] = new lambda.Function(this, key, {
        runtime: lambda.Runtime.NODEJS_14_X,
        code: lambda.Code.fromAsset(`lambdas`),
        handler: `${key}.handler`,
        vpc,
        securityGroups: [sgGraph],
        environment: {
          NEPTUNE_ENDPOINT: neptuneCluster.attrEndpoint
        },
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED }
      })
    })

    // user trigger on signup //
    userPool.addTrigger(cognito.UserPoolOperation.POST_CONFIRMATION, lambdaFn["addPersonHandler"]!); 

    // appsync DATASOURCE
    const queryResolverDS = restaurantGraphApi.addLambdaDataSource("queryResolver", lambdaFn['queryHandler']!);
    const mutationResolverDS = restaurantGraphApi.addLambdaDataSource("mutationResolver", lambdaFn['mutationHandler']!);

    // appsync resolvers //
    GRAPHQL_QUERIES.forEach(query => {
      queryResolverDS.createResolver({
        typeName: "Query",
        fieldName: query,
        requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
        responseMappingTemplate: appsync.MappingTemplate.lambdaResult()
      })
    })

    GRAPHQL_MUTATION.forEach(mutation => {
      mutationResolverDS.createResolver({
        typeName: "Mutation",
        fieldName: mutation,
        requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
        responseMappingTemplate: appsync.MappingTemplate.lambdaResult()
      })
    })
    //  printing info //
    new cdk.CfnOutput(this, 'graphql api', {
      value: restaurantGraphApi.graphqlUrl
    })

    new cdk.CfnOutput(this, 'USERPOOLCLIENTID', {
      value: userPoolClient.userPoolClientId
    })

    new cdk.CfnOutput(this, 'USERPOOLID', {
      value: userPool.userPoolId
    })
  }
}
