(() => {
  "use strict";
  const NAME = "Aaliyah";
  const DEFAULT_PLACE = { name: "Boca Raton, Florida", latitude: 26.3683, longitude: -80.1289, timezone: "America/New_York" };
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  // WMO weather codes -> [description, emoji, sky]
  const WMO = {
    0: ["Clear sky", "☀️", "clear"], 1: ["Mainly clear", "🌤️", "clear"], 2: ["Partly cloudy", "⛅", "cloudy"], 3: ["Overcast", "☁️", "cloudy"],
    45: ["Fog", "🌫️", "fog"], 48: ["Rime fog", "🌫️", "fog"],
    51: ["Light drizzle", "🌦️", "rain"], 53: ["Drizzle", "🌦️", "rain"], 55: ["Heavy drizzle", "🌧️", "rain"],
    56: ["Freezing drizzle", "🌧️", "rain"], 57: ["Freezing drizzle", "🌧️", "rain"],
    61: ["Light rain", "🌦️", "rain"], 63: ["Rain", "🌧️", "rain"], 65: ["Heavy rain", "🌧️", "rain"],
    66: ["Freezing rain", "🌧️", "rain"], 67: ["Freezing rain", "🌧️", "rain"],
    71: ["Light snow", "🌨️", "snow"], 73: ["Snow", "🌨️", "snow"], 75: ["Heavy snow", "❄️", "snow"], 77: ["Snow grains", "❄️", "snow"],
    80: ["Light showers", "🌦️", "rain"], 81: ["Showers", "🌧️", "rain"], 82: ["Violent showers", "⛈️", "storm"],
    85: ["Snow showers", "🌨️", "snow"], 86: ["Heavy snow showers", "🌨️", "snow"],
    95: ["Thunderstorm", "⛈️", "storm"], 96: ["Thunderstorm, hail", "⛈️", "storm"], 99: ["Severe thunderstorm", "⛈️", "storm"]
  };
  const wmo = (c) => WMO[c] || ["Unknown", "🌡️", "cloudy"];

  // Fun sticker messages per sky. Tap the sticker for another one.
  const STICKERS = {
    clear: [["😎", "Sunglasses weather!"], ["🌴", "Palm tree vibes"], ["🍦", "Ice cream o'clock"], ["🏄", "Surf's up (maybe)"]],
    cloudy: [["🧁", "Cozy cloud day"], ["📚", "Perfect library weather"], ["🎧", "Headphones on, world off"], ["☁️", "Cloud watching time"]],
    rain: [["☔", "Umbrella time!"], ["🐸", "Frog party outside"], ["🍵", "Hot drink weather"], ["💃", "Dance in the puddles"]],
    storm: [["⚡", "Stay inside, snack up"], ["🍿", "Movie marathon alert"], ["🛋️", "Blanket fort mode"], ["🦸", "Thor is busy today"]],
    snow: [["⛄", "Build a snowman!"], ["🧤", "Mittens required"], ["☕", "Cocoa season"], ["🛷", "Sled time"]],
    fog: [["👻", "Spooky and mysterious"], ["🔦", "Drive with care"], ["🌫️", "Dreamy morning"], ["🕵️", "Detective weather"]],
    night: [["🌙", "Goodnight moon"], ["⭐", "Make a wish"], ["🦉", "Night owl hours"], ["😴", "Sweet dreams soon"]]
  };

  // ---- State ----
  let units = store.get("units", "imperial"); // imperial = °F/mph/in, metric = °C/km/h/mm
  let place = store.get("place", DEFAULT_PLACE);
  let favs = store.get("favs", []);
  let sky = "clear";
  let loadId = 0;
  const imperial = () => units === "imperial";
  const tUnit = () => (imperial() ? "°F" : "°C");

  // ---- Greeting ----
  function greet() {
    const h = new Date().getHours();
    const part = h < 5 ? "Hello" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    $("greeting").textContent = `${part}, ${NAME}! 👋`;
    $("greetingSub").textContent = "Here's the latest weather for you.";
  }

  // ---- Theme (light / dark / system) ----
  const root = document.documentElement;
  function applyTheme(choice) {
    if (choice === "light" || choice === "dark") root.dataset.theme = choice;
    else delete root.dataset.theme;
    document.querySelectorAll("[data-theme-choice]").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.themeChoice === choice)));
  }
  function initTheme() {
    let saved = "system";
    try { saved = localStorage.getItem("theme") || "system"; } catch (e) {}
    applyTheme(saved);
    document.querySelectorAll("[data-theme-choice]").forEach((b) =>
      b.addEventListener("click", () => {
        const c = b.dataset.themeChoice;
        try { c === "system" ? localStorage.removeItem("theme") : localStorage.setItem("theme", c); } catch (e) {}
        applyTheme(c);
      }));
  }

  // ---- Units ----
  function syncUnitButtons() {
    document.querySelectorAll("[data-unit-choice]").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.unitChoice === units)));
  }
  function initUnits() {
    syncUnitButtons();
    document.querySelectorAll("[data-unit-choice]").forEach((b) =>
      b.addEventListener("click", () => {
        if (units === b.dataset.unitChoice) return;
        units = b.dataset.unitChoice;
        store.set("units", units);
        syncUnitButtons();
        load(place);
      }));
  }

  // ---- Fun effects ----
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function setSky(s) {
    sky = s;
    $("sky").dataset.sky = s;
    const fx = $("fx");
    fx.replaceChildren();
    if (reduceMotion) return;
    const kinds = { rain: ["💧", 28], storm: ["💧", 40], snow: ["❄️", 30], clear: ["✨", 10], night: ["⭐", 14] };
    const k = kinds[s];
    if (!k) return;
    for (let i = 0; i < k[1]; i++) {
      const el = document.createElement("span");
      el.className = "drop";
      el.textContent = k[0];
      el.style.left = Math.random() * 100 + "%";
      el.style.fontSize = 10 + Math.random() * 14 + "px";
      el.style.opacity = String(0.4 + Math.random() * 0.5);
      const slow = s === "snow" || s === "clear" || s === "night";
      el.style.animationDuration = (slow ? 8 + Math.random() * 8 : 1.2 + Math.random() * 1.2) + "s";
      el.style.animationDelay = -Math.random() * 10 + "s";
      fx.appendChild(el);
    }
  }
  function confetti(x, y) {
    if (reduceMotion) return;
    const set = ["🎉", "✨", "💖", "🌈", "⭐", "🌸"];
    for (let i = 0; i < 14; i++) {
      const el = document.createElement("span");
      el.className = "confetti";
      el.textContent = set[i % set.length];
      el.style.left = x + "px";
      el.style.top = y + "px";
      const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 90;
      el.style.setProperty("--dx", Math.cos(a) * d + "px");
      el.style.setProperty("--dy", Math.sin(a) * d - 30 + "px");
      el.style.setProperty("--rot", Math.random() * 360 - 180 + "deg");
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1000);
    }
  }
  function showSticker(first) {
    const list = STICKERS[sky] || STICKERS.clear;
    let pick;
    do { pick = list[Math.floor(Math.random() * list.length)]; }
    while (list.length > 1 && pick[1] === $("stickerText").textContent);
    $("stickerEmoji").textContent = pick[0];
    $("stickerText").textContent = pick[1];
  }
  $("sticker").addEventListener("click", (e) => {
    showSticker();
    const r = e.currentTarget.getBoundingClientRect();
    confetti(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2);
  });

  // ---- Weather ----
  const status = (msg) => { $("status").textContent = msg; };

  async function load(p) {
    place = p;
    store.set("place", p);
    const id = ++loadId;
    status("Loading weather…");
    const q = new URLSearchParams({
      latitude: p.latitude, longitude: p.longitude, timezone: p.timezone || "auto", forecast_days: 7,
      temperature_unit: imperial() ? "fahrenheit" : "celsius",
      wind_speed_unit: imperial() ? "mph" : "kmh",
      precipitation_unit: imperial() ? "inch" : "mm",
      current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,cloud_cover,is_day",
      hourly: "temperature_2m,weather_code,precipitation_probability",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max"
    });
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      if (id !== loadId) return; // a newer request superseded this one
      render(p, data);
      status("");
    } catch (e) {
      if (id === loadId) status("Couldn't load weather. Check your connection and try again.");
    }
  }

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const toF = (t) => (imperial() ? t : t * 9 / 5 + 32);
  const toMph = (w) => (imperial() ? w : w / 1.609);
  const clockTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  function render(p, d) {
    const c = d.current;
    const [desc, icon, condSky] = wmo(c.weather_code);
    const night = c.is_day === 0;
    $("place").textContent = p.name;
    $("updated").textContent = "Updated " + clockTime(c.time);
    $("icon").textContent = night && c.weather_code <= 1 ? "🌙" : icon;
    $("temp").textContent = Math.round(c.temperature_2m);
    $("tempUnit").textContent = tUnit();
    $("cond").textContent = desc;
    $("feels").textContent = Math.round(c.apparent_temperature) + tUnit();
    $("humidity").textContent = c.relative_humidity_2m + "%";
    $("wind").textContent = Math.round(c.wind_speed_10m) + (imperial() ? " mph" : " km/h");
    $("precip").textContent = c.precipitation + (imperial() ? " in" : " mm");
    $("clouds").textContent = c.cloud_cover + "%";
    const uv = d.daily.uv_index_max[0];
    $("uv").textContent = uv == null ? "–" : Math.round(uv) + (uv >= 8 ? " 🥵" : uv >= 6 ? " 😬" : uv >= 3 ? " 🙂" : " 😌");
    $("sunrise").textContent = clockTime(d.daily.sunrise[0]);
    $("sunset").textContent = clockTime(d.daily.sunset[0]);

    const nightClear = night && (condSky === "clear" || c.weather_code === 2);
    setSky(nightClear ? "night" : condSky);
    showSticker(true);

    const rainChance = d.daily.precipitation_probability_max[0] || 0;
    beach(c, uv, rainChance);
    outfit(c, uv, rainChance);

    // Next 24 hours starting at the current hour (times are in the location's timezone).
    const times = d.hourly.time;
    let start = times.findIndex((t) => t >= c.time.slice(0, 13) + ":00");
    if (start < 0) start = 0;
    const hourly = $("hourly");
    hourly.replaceChildren();
    for (let i = start; i < Math.min(start + 24, times.length); i++) {
      const el = document.createElement("div");
      el.className = "hour";
      el.innerHTML = `<div class="t"></div><div class="i"></div><div><strong></strong>°</div><div class="p"></div>`;
      el.querySelector(".t").textContent = i === start ? "Now" : new Date(times[i]).toLocaleTimeString([], { hour: "numeric" });
      el.querySelector(".i").textContent = wmo(d.hourly.weather_code[i])[1];
      el.querySelector("strong").textContent = Math.round(d.hourly.temperature_2m[i]);
      const pp = d.hourly.precipitation_probability[i];
      el.querySelector(".p").textContent = pp > 0 ? "💧" + pp + "%" : "";
      hourly.appendChild(el);
    }

    const daily = $("daily");
    daily.replaceChildren();
    d.daily.time.forEach((day, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="d"></span><span class="i"></span><span class="c"></span><span class="r"><strong></strong> <span class="lo"></span></span>`;
      // Parse as local date parts to avoid UTC off-by-one.
      const [y, m, dd] = day.split("-").map(Number);
      li.querySelector(".d").textContent = i === 0 ? "Today" : new Date(y, m - 1, dd).toLocaleDateString([], { weekday: "short" });
      li.querySelector(".i").textContent = wmo(d.daily.weather_code[i])[1];
      const rain = d.daily.precipitation_probability_max[i];
      li.querySelector(".c").textContent = wmo(d.daily.weather_code[i])[0] + (rain > 0 ? ` · ${rain}%` : "");
      li.querySelector("strong").textContent = Math.round(d.daily.temperature_2m_max[i]) + "°";
      li.querySelector(".lo").textContent = Math.round(d.daily.temperature_2m_min[i]) + "°";
      daily.appendChild(li);
    });

    ["current", "funWrap", "hourlyWrap", "dailyWrap"].forEach((id) => ($(id).hidden = false));
    renderFavs();
  }

  function beach(c, uv, rainChance) {
    const t = toF(c.temperature_2m), wind = toMph(c.wind_speed_10m);
    const score = Math.round(clamp(100 - Math.abs(t - 86) * 2.5 - rainChance * 0.5 - Math.max(0, wind - 12) * 2 - (uv > 9 ? 8 : 0), 0, 100));
    $("beachScore").textContent = score + "/100";
    $("beachBar").style.width = score + "%";
    $("beachNote").textContent =
      score >= 85 ? "Drop everything and go! 🌊" :
      score >= 65 ? "Pretty great beach day. Pack snacks! 🥤" :
      score >= 40 ? "Meh, maybe a quick dip. 🧴" :
      "Beach is a no today. Try the mall or a movie. 🍿";
  }

  function outfit(c, uv, rainChance) {
    const f = toF(c.apparent_temperature);
    let e, text;
    if (f < 50) { e = "🧥"; text = "Big coat, scarf and cozy socks."; }
    else if (f < 65) { e = "🧶"; text = "Hoodie or light jacket weather."; }
    else if (f < 78) { e = "👕"; text = "T-shirt and jeans. Easy."; }
    else if (f < 88) { e = "🩳"; text = "Shorts, tee and sandals."; }
    else { e = "🩱"; text = "Lightest clothes you own. Stay hydrated!"; }
    const extra = [];
    if (rainChance >= 40) extra.push("bring an umbrella ☔");
    if (uv >= 6) extra.push("sunscreen + sunglasses 🕶️");
    $("wearEmoji").textContent = e;
    $("wearText").textContent = text + (extra.length ? " Also: " + extra.join(", ") + "." : "");
  }

  // ---- Saved cities ----
  const sameCity = (a, b) => Math.abs(a.latitude - b.latitude) < 0.01 && Math.abs(a.longitude - b.longitude) < 0.01;
  function renderFavs() {
    const saved = favs.some((f) => sameCity(f, place));
    const star = $("favBtn");
    star.textContent = saved ? "⭐" : "☆";
    star.setAttribute("aria-pressed", String(saved));
    star.setAttribute("aria-label", saved ? "Remove this city from saved" : "Save this city");
    const box = $("favs");
    box.replaceChildren();
    favs.forEach((f) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      const go = document.createElement("button");
      go.type = "button";
      go.className = "chip-go";
      
      go.textContent = "⭐ " + f.name.split(",")[0];
      go.addEventListener("click", () => load(f));
      const x = document.createElement("button");
      x.type = "button";
      x.className = "x";
      x.textContent = "✕";
      x.setAttribute("aria-label", "Remove " + f.name);
      x.addEventListener("click", () => { favs = favs.filter((v) => v !== f); store.set("favs", favs); renderFavs(); });
      chip.append(go, x);
      box.appendChild(chip);
    });
  }
  $("favBtn").addEventListener("click", (e) => {
    if (favs.some((f) => sameCity(f, place))) favs = favs.filter((f) => !sameCity(f, place));
    else { favs.push(place); confetti(e.clientX, e.clientY); }
    store.set("favs", favs);
    renderFavs();
  });

  // ---- Location + refresh ----
  $("refreshBtn").addEventListener("click", () => load(place));
  $("locBtn").addEventListener("click", () => {
    if (!navigator.geolocation) { status("Your browser doesn't support location."); return; }
    status("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (pos) => load({ name: "My location", latitude: pos.coords.latitude, longitude: pos.coords.longitude, timezone: "auto" }),
      () => status("Couldn't get your location. You can search for a city instead."),
      { timeout: 10000 }
    );
  });

  // ---- City search (Open-Meteo geocoding) ----
  const results = $("results");
  const hideResults = () => { results.hidden = true; results.replaceChildren(); };

  $("searchForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("searchInput").value.trim();
    if (!q) return;
    status("Searching…");
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&name=${encodeURIComponent(q)}`);
      const data = await res.json();
      hideResults();
      if (!data.results || !data.results.length) { status(`No places found for "${q}".`); return; }
      status("");
      data.results.forEach((r) => {
        const li = document.createElement("li");
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
        b.addEventListener("click", () => {
          hideResults();
          $("searchInput").value = "";
          load({ name: [r.name, r.admin1].filter(Boolean).join(", "), latitude: r.latitude, longitude: r.longitude, timezone: r.timezone });
        });
        li.appendChild(b);
        results.appendChild(li);
      });
      results.hidden = false;
    } catch (err) {
      status("Search failed. Please try again.");
    }
  });
  document.addEventListener("click", (e) => { if (!$("searchForm").contains(e.target)) hideResults(); });

  greet();
  initTheme();
  initUnits();
  renderFavs();
  load(place);
  setInterval(() => load(place), 10 * 60 * 1000); // keep it live
})();
