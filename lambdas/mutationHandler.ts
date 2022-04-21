import { Callback, Context } from 'aws-lambda';
import { g, gremlinQueryHandler, __, P } from './gremlinSocketHandler';
import { collections, relationships } from './dbSchema.json';



////////////////////////// Handler //////////////////////////
export const handler = async (event: any, __: Context, callback: Callback) => {
    console.log("EVENT==>", event);
    const EVENT_ACTION = event.info.fieldName;
    const USER_ID = event.identity.sub;

    try {

        switch (EVENT_ACTION) {

            case "add_user":
                callback(null, {
                    id: "123",
                    name: "EXAMPLE",
                    email: "example222@gmail.com",
                    friends: []
                })
                break;


            case "add_restaurant":
                return gremlinQueryHandler(async () => {
                    const { name } = event.arguments.input;
                    const result = await g.addV(collections[1].collectionName as "Restaurant")
                        .property("name", name)
                        .elementMap().next()
                    console.log("Result", result)
                    const value = result.value as { id: string, label: string, name: string }
                   
                    const restaurant = { id: value.id, name: value.name, reviews: [] }
                    return restaurant;
                })
                break;


            case "create_recipe":
                return gremlinQueryHandler(async () => {
                    const { name, restaurantId } = event.arguments.input;
                    // console.log('{ "units" : {{units}} }'.replace("{{units}}", `${location.units}`))
                    const result = await g.addV(collections[2].collectionName as "Cuisine")
                        .property("name", name).as('cuisine')
                        .V(restaurantId).as('restaurant')
                        .addE(relationships[1].name as "Serves")
                        .from_('restaurant').to('cuisine')
                        .select("cuisine", "restaurant")
                        .by(__.elementMap()).by(__.elementMap())
                        .next()
                    console.log("Result", JSON.stringify(result, null, 2))
                    const v = result.value as {
                        cuisine: { id: string, label: string, name: string },
                        restaurant: { id: string, label: string, name: string, location: string }
                    }
                    const cuisine = {
                        id: v.cuisine.id, name: v.cuisine.name, servedBy: {
                            restaurant_id: v.restaurant.id,
                            restaurant_location: JSON.parse(v.restaurant.location),
                            restaurant_name: v.restaurant.name
                        }
                    }
                    return cuisine;
                })
                break;


            case "create_review":
                return gremlinQueryHandler(async () => {
                    const _person = "person"; const _review = "review"; const _restaurant = "restaurant";
                    const { restaurantId, text } = event.arguments.input;
                    const result = await g.addV(collections[3].collectionName as "Review")
                        .property("text", text).property("datetime", new Date().getTime()).as(_review)
                        .V().has(collections[0].collectionName as "Person", '_id', USER_ID).as(_person)
                        .V(restaurantId).as(_restaurant)
                        .addE(relationships[2].name as "Writes")
                        .from_(_person).to(_review)
                        .addE(relationships[4].name as "Are About")
                        .from_(_review).to(_restaurant)
                        .select(_person, _review, _restaurant)
                        .by(__.elementMap()).by(__.elementMap()).by(__.elementMap())
                        .next()
                    console.log("Result", result)
                    const v = result.value as {
                        [_review]: { id: string, label: string, text: string, datetime: number },
                        [_restaurant]: { id: string, label: string, name: string, location: string },
                        [_person]: { id: string, _id: string, label: string, name: string, email: string }
                    }
                    const review = {
                        id: v[_review].id,
                        text: v[_review].text,
                        datetime: v[_review].datetime,
                        isAbout: { restaurant_id: v[_restaurant].id, restaurant_location: JSON.parse(v[_restaurant].location), restaurant_name: v[_restaurant].name },
                        wroteBy: { person_id: v[_person].id, person_name: v[_person].name, person_email: v[_person].email },
                        rating: [],
                    }
                    return review;
                })
                break;


            case "rate_to_review":
                return gremlinQueryHandler(async () => {
                    const _person = "person"; const _review = "review"; const _rate = "rate";
                    const { reviewId, thumb } = event.arguments.input;
                    const result = await g.V(reviewId).as(_review)
                        .V().has(collections[0].collectionName as "Person", '_id', USER_ID).as(_person)
                        .addE(relationships[3].name as "Rates")
                        .from_(_person).to(_review)
                        .property("thumb", thumb).property("datetime", new Date().getTime()).as(_rate)
                        .select(_person, _review, _rate)
                        .by(__.elementMap()).by(__.elementMap()).by(__.elementMap())
                        .next()
                    console.log("Result", JSON.stringify(result, null, 2))
                    const v = result.value as {
                        [_rate]: { id: string, label: string, thumb: any, datetime: number, IN: { id: string, label: string }, OUT: { id: string, label: string } },
                        [_review]: { id: string, label: string, text: string, datetime: number },
                        [_person]: { id: string, _id: string, label: string, name: string, email: string }
                    }
                    const rate = {
                        id: v[_rate].id,
                        thumb: v[_rate].thumb,
                        datetime: v[_rate].datetime,
                        givenBy: { person_id: v[_person].id, person_name: v[_person].name, person_email: v[_person].email },
                        givenTo: { review_id: v[_review].id, review_text: v[_review].text, review_datetime: v[_review].datetime },
                    }
                    return rate;
                })
                break;

            case "add_friend":
                return gremlinQueryHandler(async () => {
                    const { friend_Id } = event.arguments;
                    const _person = "person"; const _friend = "friend"; const _friendsOfFriend = "friendsOfFriend";
                    const isAlreadyFriend = await g.V(friend_Id).as(_friend)
                        .V().has(collections[0].collectionName as "Person", '_id', USER_ID)
                        .out(relationships[0].name as "Friends").where(P.eq(_friend)).hasNext()
                    if (isAlreadyFriend) {
                        throw Error("Both are already Friends")
                    }

                    const result = await g.V()
                        .has(collections[0].collectionName as "Person", '_id', USER_ID).as(_person)
                        .V(friend_Id).as(_friend).as(_friendsOfFriend)
                        .addE(relationships[0].name as "Friends").from_(_person).to(_friend)
                        .addE(relationships[0].name as "Friends").from_(_friend).to(_person)
                        .select(_friend, _friendsOfFriend).by(__.elementMap())
                        .by(__.out(relationships[0].name as "Friends").elementMap().fold()).next()

                    console.log("Result", JSON.stringify(result, null, 2))
                    const v = result.value as {
                        [_friend]: { id: string, _id: string, label: string, name: string, email: string }
                        [_friendsOfFriend]: { id: string, _id: string, label: string, name: string, email: string }[]
                    }

                    const personFriend = {
                        id: v[_friend].id, email: v[_friend].email, name: v[_friend].name,
                        friends: v[_friendsOfFriend].map((v) => ({ person_id: v.id, person_name: v.name, person_email: v.email }))
                    }
                    return personFriend
                    // return { id: "23fw", email: "mur@gmail.com", name: "Murtaza", friends: [] }
                })
                break;



        }

    } catch (e) {
        console.log("Error ==>", e);
        callback(e, null)

    }


}