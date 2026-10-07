(() => {
  "use strict";
  const NAME = "Aaliyah";
  const DEFAULT_PLACE = { name: "Boca Raton, Florida", latitude: 26.3683, longitude: -80.1289, timezone: "America/New_York" };
  const $ = (id) => document.getElementById(id);

  // WMO weather codes -> [description, emoji]
  const WMO = {
    0: ["Clear sky", "☀️"], 1: ["Mainly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁️"],
    45: ["Fog", "🌫️"], 48: ["Rime fog", "🌫️"],
    51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Heavy drizzle", "🌧️"],
    56: ["Freezing drizzle", "🌧️"], 57: ["Freezing drizzle", "🌧️"],
    61: ["Light rain", "🌦️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
    66: ["Freezing rain", "🌧️"], 67: ["Freezing rain", "🌧️"],
    71: ["Light snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Heavy snow", "❄️"], 77: ["Snow grains", "❄️"],
    80: ["Light showers", "🌦️"], 81: ["Showers", "🌧️"], 82: ["Violent showers", "⛈️"],
    85: ["Snow showers", "🌨️"], 86: ["Heavy snow showers", "🌨️"],
    95: ["Thunderstorm", "⛈️"], 96: ["Thunderstorm, hail", "⛈️"], 99: ["Severe thunderstorm", "⛈️"]
  };
  const wmo = (c) => WMO[c] || ["Unknown", "🌡️"];

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

  // ---- Weather ----
  const status = (msg) => { $("status").textContent = msg; };

  async function load(place) {
    status("Loading weather…");
    const p = new URLSearchParams({
      latitude: place.latitude, longitude: place.longitude, timezone: place.timezone || "auto",
      temperature_unit: "fahrenheit", wind_speed_unit: "mph", precipitation_unit: "inch", forecast_days: 7,
      current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day",
      hourly: "temperature_2m,weather_code,precipitation_probability",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
    });
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${p}`);
      if (!res.ok) throw new Error(res.status);
      render(place, await res.json());
      status("");
    } catch (e) {
      status("Couldn't load weather. Check your connection and try again.");
    }
  }

  function render(place, d) {
    const c = d.current;
    const [desc, icon] = wmo(c.weather_code);
    $("place").textContent = place.name;
    $("updated").textContent = "Updated " + new Date(c.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    $("icon").textContent = c.is_day === 0 && c.weather_code <= 1 ? "🌙" : icon;
    $("temp").textContent = Math.round(c.temperature_2m);
    $("cond").textContent = desc;
    $("feels").textContent = Math.round(c.apparent_temperature) + "°F";
    $("humidity").textContent = c.relative_humidity_2m + "%";
    $("wind").textContent = Math.round(c.wind_speed_10m) + " mph";
    $("precip").textContent = c.precipitation + " in";

    // Next 24 hours starting at the current hour (times are in the location's timezone).
    const times = d.hourly.time;
    let start = times.findIndex((t) => t >= c.time.slice(0, 13) + ":00");
    if (start < 0) start = 0;
    const hourly = $("hourly");
    hourly.replaceChildren();
    for (let i = start; i < Math.min(start + 24, times.length); i++) {
      const el = document.createElement("div");
      el.className = "hour";
      const label = new Date(times[i]).toLocaleTimeString([], { hour: "numeric" });
      el.innerHTML = `<div class="t"></div><div class="i"></div><div><strong></strong>°</div><div class="p"></div>`;
      el.querySelector(".t").textContent = i === start ? "Now" : label;
      el.querySelector(".i").textContent = wmo(d.hourly.weather_code[i])[1];
      el.querySelector("strong").textContent = Math.round(d.hourly.temperature_2m[i]);
      const pp = d.hourly.precipitation_probability[i];
      el.querySelector(".p").textContent = pp > 0 ? pp + "%" : "";
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

    ["current", "hourlyWrap", "dailyWrap"].forEach((id) => ($(id).hidden = false));
  }

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
  load(DEFAULT_PLACE);
})();
