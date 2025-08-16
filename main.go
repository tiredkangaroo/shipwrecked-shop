package main

import (
	"crypto/sha256"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"
)

// implementation of github.com/hackclub/shipwrecked/blob/main/lib/shop-utils.ts

const (
	MIN_PERCENT = 90
	MAX_PERCENT = 110
	BASE_PRICE  = 250 // example base price for calculations
)

var TOP_X_TIMES = 6 // number of best times to return

// shop closes at 2025-09-10 00:00:00 EDT, time and timezone are assumed (https://hackclub.slack.com/archives/C08KH979K9U/p1755194865115639)
var shopCloses = time.Date(2025, time.September, 10, 0, 0, 0, 0, time.FixedZone("EDT", -4*3600))

var printLocal bool = false
var itemsUpdated bool = false // whether items.json was updated for this hour

func getHourlyRandom(userID, itemID string, currentHour int) float64 {
	combined := fmt.Sprintf("%s-%s-%d", strings.TrimSpace(userID), itemID, currentHour)

	hashData := sha256.Sum256([]byte(combined))
	hashString := fmt.Sprintf("%x", hashData) // hex encode

	subHash := hashString[0:8]
	intHash, err := strconv.ParseUint(subHash, 16, 32) // convert first 8 hex chars to uint32
	if err != nil {
		panic("unreachable parse uint error: " + err.Error())
	}
	return float64(intHash) / float64(0xffffffff)
}

func calculateRandomizedPrice(userID, itemID string, currentHour int, basePrice float64) int {
	random := getHourlyRandom(userID, itemID, currentHour)

	// Ensure valid percentages
	safeMinPercent := int(math.Max(1, float64(MIN_PERCENT)))
	safeMaxPercent := int(math.Max(float64(safeMinPercent+1), float64(MAX_PERCENT)))

	// Price bounds
	minPrice := int(math.Floor(float64(basePrice) * float64(safeMinPercent) / 100))
	maxPrice := int(math.Ceil(float64(basePrice) * float64(safeMaxPercent) / 100))

	// Percent range and random percent
	percentRange := safeMaxPercent - safeMinPercent
	randomPercent := float64(safeMinPercent) + random*float64(percentRange)
	priceMultiplier := randomPercent / 100

	// Calculate price
	randomizedPrice := int(math.Round(float64(basePrice) * priceMultiplier))
	clampedPrice := int(math.Max(float64(minPrice), math.Min(float64(maxPrice), float64(randomizedPrice))))

	// Ensure at least 1
	finalPrice := int(math.Max(1, float64(clampedPrice)))

	return finalPrice
}

type candidateTime struct {
	t     time.Time
	price int
}

func getBestTimeToBuy(userID, itemID string) []candidateTime {
	var t = time.Now()

	var candidates []candidateTime

	for t.Before(shopCloses) {
		currentHour := getHour(t)
		price := calculateRandomizedPrice(userID, itemID, currentHour, BASE_PRICE) // Example base price of 100
		candidates = append(candidates, candidateTime{t: t, price: price})

		t = t.Add(time.Hour) // next loop iteration checks the next hour
	}

	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].price == candidates[j].price {
			// If prices are equal, compare by time (earlier is better)
			return candidates[i].t.Before(candidates[j].t)
		}
		// Otherwise, sort by price (cheaper is better)
		return candidates[i].price < candidates[j].price
	})

	return candidates[:min(TOP_X_TIMES, len(candidates))]
}

func getHour(t time.Time) int {
	return int(math.Floor(float64(t.UTC().UnixMilli()) / (1000 * 60 * 60)))
}

func getStat(new, old float64) string {
	percentChange := ((new - old) / old) * 100
	if percentChange == 0 {
		return "no change"
	} else if percentChange < 0 {
		return fmt.Sprintf("discount by %.2f%%", -percentChange)
	} else {
		return fmt.Sprintf("hike by %.2f%%", percentChange)
	}
}

func formatCandidate(t candidateTime) string {
	var stat string
	stat = getStat(float64(t.price), BASE_PRICE)

	var isLocal string = "UTC"
	if printLocal {
		t.t = t.t.Local() // convert to local time if requested
		isLocal = "Local Time"
	}
	return fmt.Sprintf("%s %s %s (%d hours away)", t.t.Format("01/02 at 03:00 PM"), isLocal, stat, int(time.Until(t.t).Hours()))
}

func getBasePrice(itemPrice, currentRandomizedBase, fakeBasePrice float64) int {
	pc := (currentRandomizedBase - fakeBasePrice) / fakeBasePrice * 100
	// apply pc to itemPrice
	old := itemPrice / (1 + pc/100) // yes ik im *100 and then /100, but dw
	return int(math.Round(old))
}

func main() {
	fmt.Printf("Enter your User ID: ")
	var userID string
	fmt.Scanln(&userID)
	fmt.Printf("How many best times would you like to see?: ")
	fmt.Scanln(&TOP_X_TIMES)
	fmt.Printf("Print local time? (true/false): ")
	fmt.Scanln(&printLocal)
	fmt.Printf("Was items.json updated for this hour? (true/false): ")
	fmt.Scanln(&itemsUpdated)

	fmt.Println("\nBest times to buy: ")
	for _, item := range items {
		bestTimesToBuy := getBestTimeToBuy(userID, item.ID)

		currentRandomizedBase := calculateRandomizedPrice(userID, item.ID, getHour(time.Now()), BASE_PRICE)
		currentStat := getStat(float64(currentRandomizedBase), BASE_PRICE)

		fmt.Printf("Item: %s (current %s)\n", item.Name, currentStat)
		if itemsUpdated {
			fmt.Printf("Base shell cost: %d\n", getBasePrice(item.Price, float64(currentRandomizedBase), BASE_PRICE))
		}
		for _, t := range bestTimesToBuy {
			fmt.Printf("\t- %s\n", formatCandidate(t))
		}
		fmt.Println()
	}
}
