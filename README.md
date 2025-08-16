# reverse shipwrecked shop

## find your user id

1. make sure you're signed into the [bay](https://shipwrecked.hackclub.com/bay)
2. go to [this](https://shipwrecked.hackclub.com/api/auth/session) api endpoint in your browser
3. copy the `id` field under the `user` key from the json response

there you go, you have your user id

## find the items.json data

1. make sure you're signed into the [bay](https://shipwrecked.hackclub.com/bay)
2. go to [this](https://shipwrecked.hackclub.com/api/bay/shop/items) api endpoint in your browser
3. copy the array of items from the json response (not the WHOLE thing)
4. paste it in `items.json`

## run the program
