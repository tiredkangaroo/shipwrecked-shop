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

  return (
    <div className="w-full h-full flex flex-col justify-center items-center">
      {info ? <BestTimeToBuyView info={info} /> : <GetInfo setInfo={setInfo} />}
    </div>
  );
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

async function BestTimeToBuyView({ info }: { info: Info }) {
  for (const item of info.Items) {
    const nowHour = getCurrentUnixHour();
    const bestTimes: TimeToBuy[] = [];
    for (let hr = nowHour; hr <= endHour; hr++) {
      const price = await getPrice(info.UserID, item.id, exampleBasePrice, hr);
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
  }
}

function GetInfo({ setInfo }: { setInfo: (info: Info) => void }) {
  const idInputRef = useRef<HTMLInputElement>(null);
  const itemsResponseRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
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
    const items: Item[] = irr.items.map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      image: item.image,
      price: item.price,
    }));
    setInfo({
      UserID: id,
      Items: items,
      lastUpdatedUnixHour: getCurrentUnixHour(),
    });
  };

  return (
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
      and copy the value of the <code>id</code> field. Provide the value below.{" "}
      <br />
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
      <textarea ref={itemsResponseRef} placeholder="Paste the response here" />
      <br />
      <button onClick={handleSubmit}>Submit</button>
    </div>
  );
}

export default App;
