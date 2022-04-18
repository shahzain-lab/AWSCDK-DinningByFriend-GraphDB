import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as appsync from '@aws-cdk/aws-appsync-alpha'

export class dinningByFriendMainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const restaurantGraphApi = new appsync.GraphqlApi(this, 'restaurantGraphAPi', {
      name: 'restaurant-graph',
      schema: appsync.Schema.fromAsset('graphql/schema.gql'),
      authorizationConfig: {
        defaultAuthorization: {
         apiKeyConfig: {
           expires: cdk.Expiration.after(cdk.Duration.days(365))
         },
          authorizationType: appsync.AuthorizationType.API_KEY,
        }
      }
    })
  }
}
