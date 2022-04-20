import { Callback, Context, BasePostConfirmationTriggerEvent } from 'aws-lambda';
import { g, gremlinQueryHandler, __ } from './gremlinSocketHandler';
import { collections } from './dbSchema.json';

export const handler = async (event: BasePostConfirmationTriggerEvent<string>):Promise<any> => {
    console.log("EVENT-", event);

    try {
        await gremlinQueryHandler(async () => {
            const result = await g.addV(collections[0].collectionName as "Person")
                .property("_id", event.request.userAttributes.sub)
                .property("email", event.request.userAttributes.email)
                .property("name", event.userName)
                .elementMap()
                .next();
            console.log(result);
        })
        return event;
    } catch (e) {
        console.log(e, null);
    }
}