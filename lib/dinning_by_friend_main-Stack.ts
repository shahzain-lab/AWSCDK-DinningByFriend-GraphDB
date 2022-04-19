import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as appsync from '@aws-cdk/aws-appsync-alpha'

export class dinningByFriendMainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

     //////////////////////// creating User Pool /////////////////////////////////
     const userPool = new cognito.UserPool(this, `${this.stackName}_USER_POOL`, {
      selfSignUpEnabled: true,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      autoVerify: { email: true, },
      standardAttributes: {
        email: { required: true, mutable: true, },
        // phoneNumber: { required: true, mutable: true }
      },
    })
    const userPoolClient = new cognito.UserPoolClient(this, `${this.stackName}_USER_POOL_CLIENT`, {
      userPool,
    });


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
  }
}
