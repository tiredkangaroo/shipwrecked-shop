import { useEffect, useRef, useState } from "react";
import "./App.css";

const endDate = new Date("2025-09-10T00:00:00Z");
const endHour = Math.floor(endDate.getTime() / 1000 / 3600);
const exampleBasePrice = 250;
interface Info {
  UserID: string;
  Items: Item[];
  lastUpdatedUnixHour: number;
}

interface TimeToBuy {
  time: Date;
  discountPercent: number;
}

interface Item {
  id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  bestTimesToBuy: TimeToBuy[];
  basePrice: number;
}

const API_ME = "https://shipwrecked.hackclub.com/api/users/me";
const API_ITEMS = "https://shipwrecked.hackclub.com/api/bay/shop/items";
const BAY_URL = "https://shipwrecked.hackclub.com/bay";

function getCurrentUnixHour(): number {
  return Math.floor(Date.now() / (1000 * 60 * 60));
}
async function sha256(message: string): Promise<string> {
  // encode as UTF-8
  const msgBuffer = new TextEncoder().encode(message);

  // hash the message
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);

  // convert ArrayBuffer to Array
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // convert bytes to hex string
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

function App() {
  const rawInfo = localStorage.getItem("info");
  let lsInfo = JSON.parse(rawInfo!) || undefined;
  if (lsInfo && getCurrentUnixHour() !== lsInfo.lastUpdatedUnixHour) {
    lsInfo = undefined; // reset if last updated hour is not current (to avoid stale data)
  }
  const [info, setInfo] = useState<Info | undefined>(
    lsInfo ? lsInfo : undefined
  );

  // update localStorage when info changes
  useEffect(() => {
    if (info) {
      localStorage.setItem("info", JSON.stringify(info));
    }
  }, [info]);

  if (info) {
    ensureNoStaleData();
  }

  return (
    <div className="w-full h-full">
      {info ? <BestTimeToBuyView info={info} /> : <GetInfo setInfo={setInfo} />}
    </div>
  );
}

function ensureNoStaleData() {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 0, 0);
  const msUntilTurnOfHour = nextHour - now;
  setTimeout(() => {
    window.location.reload();
  }, msUntilTurnOfHour + 1000);
}

async function getPrice(
  userId: string,
  itemId: string,
  basePrice: number,
  currentHour: number
): Promise<number> {
  async function createHourlyRandom(
    userId: string,
    itemId: string,
    hour: number
  ): Promise<number> {
    // Create a combined seed string
    const combined = `${userId}-${itemId}-${hour}`;

    // Use SHA256 for a high-quality hash
    // We could use crypto.subtle.digest without importing Node.js 'crypto', but that's async
    const hash = await sha256(combined);

    // Convert the first 8 characters of the hash (32 bits) to a number between 0 and 1
    const subHash = hash.substring(0, 8);
    const intHash = parseInt(subHash, 16);
    return intHash / 0xffffffff;
  }
  const minPercent = 90;
  const maxPercent = 110;
  const random = await createHourlyRandom(userId, itemId, currentHour);

  // Ensure we're working with valid percentages
  const safeMinPercent = Math.max(1, minPercent);
  const safeMaxPercent = Math.max(safeMinPercent + 1, maxPercent);

  // Calculate price bounds from percentages
  const minPrice = Math.floor((basePrice * safeMinPercent) / 100);
  const maxPrice = Math.ceil((basePrice * safeMaxPercent) / 100);

  // Calculate percentage multiplier - this ensures full sliding scale from min to max
  const percentRange = safeMaxPercent - safeMinPercent;
  const randomPercent = safeMinPercent + random * percentRange;
  const priceMultiplier = randomPercent / 100;

  // Calculate randomized price and clamp between min/max bounds
  const randomizedPrice = Math.round(basePrice * priceMultiplier);
  const clampedPrice = Math.max(minPrice, Math.min(maxPrice, randomizedPrice));

  // Ensure price is at least 1
  const finalPrice = Math.max(1, clampedPrice);

  // Optional: Add debug logging (remove in production)
  // console.log(`User ${userId.slice(0,8)}..., Item ${itemId}, Hour ${currentHour}: random=${random.toFixed(4)}, percent=${randomPercent.toFixed(1)}%, price=${basePrice}->${finalPrice}`);

  return finalPrice;
}

async function bruteForceBasePrice(
  userId: string,
  itemId: string,
  currentPrice: number
): Promise<number> {
  // knowing that the items were created in the current unix hour
  // it just brute forces the base price until it gets the one that creates the current price for the current hour
  for (
    let basePrice = Math.round(currentPrice * 0.7);
    basePrice <= currentPrice * 1.3;
    basePrice++
  ) {
    const price = await getPrice(
      userId,
      itemId,
      basePrice,
      getCurrentUnixHour()
    );
    if (price === currentPrice) {
      console.log(`Found matching base price: ${basePrice}`);
      return basePrice;
    }
  }
  console.log(`No matching base price found for ${currentPrice}`);
  return -1;
}

function BestTimeToBuyView({ info }: { info: Info }) {
  const [TopXTimes, setTopXTimes] = useState<number>(5);
  console.log(info.Items);
  return (
    <div className="mt-2 w-full h-full flex flex-col">
      <div className="flex flex-row items-center">
        <div
          className="ml-4 cursor-pointer border-red-600 text-red-600 border-1 flex flex-col items-center justify-center rounded-lg w-8 h-8"
          onClick={() => {
            localStorage.removeItem("info");
            window.location.reload();
          }}
        >
          X
        </div>

        <div className="w-fit ml-auto mr-5 flex flex-row items-center gap-6">
          <input
            type="number"
            min="1"
            max={endHour - getCurrentUnixHour()}
            value={TopXTimes}
            onChange={(e) => setTopXTimes(Number(e.target.value))}
            className="w-32 border border-gray-300 rounded px-2 py-2 text-center"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {info.Items.map((item) => (
          <InfoCard key={item.id} item={item} top_x_times={TopXTimes} />
        ))}
      </div>
    </div>
  );
}

function InfoCard({ item, top_x_times }: { item: Item; top_x_times: number }) {
  const current_price_change =
    ((item.price - item.basePrice) / item.basePrice) * 100;
  return (
    <div className="bg-white shadow-md rounded-lg p-4 border-1">
      <div className="w-full h-48 rounded-t-lg">
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-full object-contain"
        />
      </div>
      <h2 className="text-xl font-bold mt-2">{item.name}</h2>
      <p className="text-gray-700 mt-1">{item.description}</p>
      <div className="flex flex-col text-lg mt-2">
        <p>
          <span className="font-semibold">Base Price</span>: {item.basePrice}{" "}
          shells
        </p>
        <p>
          <span className="font-semibold">Current Price</span>: {item.price}{" "}
          shells{" "}
          <span
            className={
              current_price_change < 0 ? "text-green-700" : "text-red-700"
            }
          >
            ({current_price_change < 0 ? "" : "+"}
            {current_price_change.toFixed(2)}%)
          </span>
        </p>
      </div>
      <h3 className="text-lg font-semibold mt-4">Best Times to Buy:</h3>
      <ul className="list-disc pl-5">
        {item.bestTimesToBuy.slice(0, top_x_times).map((time) => (
          <li key={new Date(time.time).getTime()} className="mt-1">
            {formatUTCDateToLocalString(time.time)} -{" "}
            {Math.abs(time.discountPercent).toFixed(2)}%{" "}
            <span
              className={
                time.discountPercent > 0 ? "text-green-700" : "text-red-700"
              }
            >
              {time.discountPercent > 0 ? "off" : "hike"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatUTCDateToLocalString(utcDateStr: Date) {
  const date = new Date(utcDateStr); // UTC input -> Local date

  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };

  return date.toLocaleString("en-US", options) + " (Local)";
}

async function getBestTimesToBuy(
  userId: string,
  itemId: string
): Promise<TimeToBuy[]> {
  const nowHour = getCurrentUnixHour();
  const bestTimes: TimeToBuy[] = [];
  for (let hr = nowHour; hr <= endHour; hr++) {
    const price = await getPrice(userId, itemId, exampleBasePrice, hr);
    const discountPercent =
      ((price - exampleBasePrice) / exampleBasePrice) * 100;

    bestTimes.push({
      time: new Date(hr * 3600 * 1000), // convert back to ms
      discountPercent,
    });
  }

  // sort: best discount first, then closest time
  bestTimes.sort((a, b) => {
    if (b.discountPercent !== a.discountPercent) {
      return b.discountPercent - a.discountPercent;
    }
    return a.time.getTime() - b.time.getTime();
  });
  return bestTimes;
}

function GetInfo({ setInfo }: { setInfo: (info: Info) => void }) {
  const idInputRef = useRef<HTMLInputElement>(null);
  const itemsResponseRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    const id = idInputRef.current!.value.trim();
    if (id.length === 0) {
      alert("Please enter a valid ID");
      return;
    }
    let irr;
    try {
      irr = JSON.parse(itemsResponseRef.current!.value);
    } catch (error) {
      alert("Invalid JSON");
      return;
    }
    if (!irr || !irr.items || !Array.isArray(irr.items)) {
      alert("invalid response");
      return;
    }
    const items: Item[] = await Promise.all(
      irr.items.map(async (item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        image: item.image,
        price: item.price,
        bestTimesToBuy: await getBestTimesToBuy(id, item.id),
        basePrice: await bruteForceBasePrice(id, item.id, item.price),
      }))
    );
    items.sort((a, b) => b.basePrice - a.basePrice);
    setInfo({
      UserID: id,
      Items: items,
      lastUpdatedUnixHour: getCurrentUnixHour(),
    });
  };

  return (
    <div className="w-full h-full justify-center items-center flex flex-col p-4">
      <div>
        <b>
          You're going to need information to use this app. Make sure you are
          logged into <a href={BAY_URL}>the bay</a>.
        </b>{" "}
        <br />
        <br />
        Please go to{" "}
        <a href={API_ME} target="_blank">
          this link
        </a>{" "}
        and copy the value of the <code>id</code> field. Provide the value
        below. <br />
        <input ref={idInputRef} placeholder="Enter your ID" />
        <br />
        <br />
        Please go to{" "}
        <a href={API_ITEMS} target="_blank">
          this link
        </a>{" "}
        and copy/paste the whole response. Make sure the response you paste is
        JSON.
        <br />
        <textarea
          ref={itemsResponseRef}
          placeholder="Paste the response here"
          rows={12}
        />
        <br />
        <button onClick={handleSubmit}>Submit</button>
      </div>
    </div>
  );
}

export default App;
