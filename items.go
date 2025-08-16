package main

import (
	_ "embed"
	"encoding/json"
)

//go:embed items.json
var rawItems string
var items []Item

type Item struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Image       string  `json:"image"`
	Price       float64 `json:"price"`
}

func init() {
	if err := json.Unmarshal([]byte(rawItems), &items); err != nil {
		panic("parse items.json: " + err.Error())
	}
}

// func bruteforceBasePrice(userID, itemID string, item Item, itemsCreated time.Time) int {
// 	minimum := item.Price * 0.7 // this isn't the real minimum, but we'll start calculations from here
// 	maximum := item.Price * 1.3 // this isn't the real maximum, but we'll start calculations from here

// 	hr := math.Floor(float64(itemsCreated.UTC().UnixMilli()) / (1000 * 60 * 60))

// 	basePrice := minimum
// 	for basePrice <= maximum {
// 		rprice := calculateRandomizedPrice(userID, itemID, int(hr), basePrice)
// 		if rprice == int(item.Price) {
// 			return int(basePrice)
// 		}
// 		basePrice += 1 // increment by a small amount
// 	}
// 	return int(basePrice)
// }

// func getCurrentPrice(userID, itemID string, item Item, itemsCreated time.Time) int {
// 	basePrice := bruteforceBasePrice(userID, itemID, item, itemsCreated)
// 	if basePrice <= 0 {
// 		return -1
// 	}

// 	currentHour := math.Floor(float64(itemsCreated.UTC().UnixMilli()) / (1000 * 60 * 60))
// 	return calculateRandomizedPrice(userID, itemID, int(currentHour), float64(basePrice))
// }
