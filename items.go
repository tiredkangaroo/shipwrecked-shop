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
