# reverse shipwrecked shop

## things you might need

### find your user id

1. make sure you're signed into the [bay](https://shipwrecked.hackclub.com/bay)
2. go to [this](https://shipwrecked.hackclub.com/api/auth/session) api endpoint in your browser
3. copy the `id` field under the `user` key from the json response

there you go, you have your user id

### find the items.json data

1. make sure you're signed into the [bay](https://shipwrecked.hackclub.com/bay)
2. go to [this](https://shipwrecked.hackclub.com/api/bay/shop/items) api endpoint in your browser
3. copy the array of items from the json response (not the WHOLE thing)
4. paste it in `items.json`

## questions

### how do u know this?

we do forward, guess-and-check-like, system to find the best times to buy. it ranges from now to every hour until the shop closes and calculates the price at each hour. then, it sorts them and gives you the best times to buy.

[the code](github.com/hackclub/shipwrecked/blob/main/lib/shop-utils.ts)

### why do u need items.json and user id?

they're used as part of the calculation. see the code linked above for more information.

### can i set reminders for the best times to buy?

not yet, but ill prolly add it soon.

### uh why are the discounts 10%?

organized by best times to buy to worst. the best it can go is a 10% discount. it is highly likely that you will see a 10% discount, especially the further away you are from the end of the shop.
