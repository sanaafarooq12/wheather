const weatherCodeMap = {
    0: { desc: "Clear Sky", icon: "fa-sun", theme: "weather-clear" },
    1: { desc: "Mainly Clear", icon: "fa-cloud-sun", theme: "weather-clear" },
    2: { desc: "Partly Cloudy", icon: "fa-cloud-sun", theme: "weather-cloudy" },
    3: { desc: "Overcast", icon: "fa-cloud", theme: "weather-cloudy" },
    45: { desc: "Foggy", icon: "fa-smog", theme: "weather-cloudy" },
    48: { desc: "Depositing Rime Fog", icon: "fa-smog", theme: "weather-cloudy" },
    51: { desc: "Light Drizzle", icon: "fa-cloud-rain", theme: "weather-rainy" },
    53: { desc: "Moderate Drizzle", icon: "fa-cloud-rain", theme: "weather-rainy" },
    55: { desc: "Dense Drizzle", icon: "fa-cloud-showers-heavy", theme: "weather-rainy" },
    61: { desc: "Slight Rain", icon: "fa-cloud-rain", theme: "weather-rainy" },
    63: { desc: "Moderate Rain", icon: "fa-cloud-rain", theme: "weather-rainy" },
    65: { desc: "Heavy Rain", icon: "fa-cloud-showers-heavy", theme: "weather-rainy" },
    71: { desc: "Slight Snow Fall", icon: "fa-snowflake", theme: "weather-snowy" },
    73: { desc: "Moderate Snow Fall", icon: "fa-snowflake", theme: "weather-snowy" },
    75: { desc: "Heavy Snow Fall", icon: "fa-snowflake", theme: "weather-snowy" },
    80: { desc: "Slight Rain Showers", icon: "fa-cloud-sun-rain", theme: "weather-rainy" },
    81: { desc: "Moderate Rain Showers", icon: "fa-cloud-showers-heavy", theme: "weather-rainy" },
    82: { desc: "Violent Rain Showers", icon: "fa-cloud-showers-water", theme: "weather-rainy" },
    95: { desc: "Thunderstorm", icon: "fa-cloud-bolt", theme: "weather-stormy" },
    96: { desc: "Thunderstorm with Hail", icon: "fa-cloud-meatball", theme: "weather-stormy" }
};

const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const locationBtn = document.getElementById('locationBtn');
const loadingState = document.getElementById('loadingState');
const weatherDashboard = document.getElementById('weatherDashboard');
const recentHistoryContainer = document.getElementById('recentHistory');

document.addEventListener('DOMContentLoaded', () => {
    renderHistoryTags();
    getCoordinatesByCity("Lahore"); // Premium baseline default city
});

searchBtn.addEventListener('click', () => performSearch());
cityInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
locationBtn.addEventListener('click', () => getBrowserLocation());

function performSearch() {
    const cityName = cityInput.value.trim();
    if (cityName) getCoordinatesByCity(cityName);
}

async function getCoordinatesByCity(city) {
    toggleLoader(true);
    try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
        const res = await fetch(geoUrl);
        const data = await res.json();

        if (!data.results || data.results.length === 0) {
            alert(`⚠️ City "${city}" not found.`);
            toggleLoader(false);
            return;
        }

        const result = data.results[0];
        const formattedCityName = `${result.name}, ${result.country || ''}`;
        
        saveToHistory(result.name);
        await fetchWeatherData(result.latitude, result.longitude, formattedCityName);

    } catch (err) {
        console.error(err);
        toggleLoader(false);
    }
}

async function fetchWeatherData(lat, lon, displayName) {
    try {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
        const res = await fetch(weatherUrl);
        const data = await res.json();
        updateDashboardUI(data, displayName);
    } catch (err) {
        console.error(err);
    } finally {
        toggleLoader(false);
    }
}

function updateDashboardUI(data, displayName) {
    const current = data.current;
    const daily = data.daily;
    const weatherConfig = weatherCodeMap[current.weather_code] || { desc: "Unknown", icon: "fa-cloud", theme: "weather-cloudy" };

    document.body.className = weatherConfig.theme;
    document.getElementById('cityName').innerText = displayName;
    document.getElementById('currentDateTime').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    document.getElementById('mainWeatherIcon').className = `fas ${weatherConfig.icon} dynamic-icon`;
    document.getElementById('mainTemp').innerText = `${Math.round(current.temperature_2m)}°C`;
    document.getElementById('weatherDesc').innerText = weatherConfig.desc;

    document.getElementById('feelsLike').innerText = `${Math.round(current.apparent_temperature)}°C`;
    document.getElementById('humidity').innerText = `${current.relative_humidity_2m}%`;
    document.getElementById('windSpeed').innerText = `${current.wind_speed_10m} km/h`;
    document.getElementById('uvIndex').innerText = current.uv_index !== undefined ? current.uv_index.toFixed(1) : "0.0";

    const forecastContainer = document.getElementById('forecastContainer');
    forecastContainer.innerHTML = '';

    for (let i = 0; i < daily.time.length; i++) {
        const dayDate = new Date(daily.time[i]);
        const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
        const dayConfig = weatherCodeMap[daily.weather_code[i]] || { icon: "fa-cloud" };

        const forecastCard = document.createElement('div');
        forecastCard.className = 'forecast-item';
        forecastCard.innerHTML = `
            <p class="item-date">${dayName}</p>
            <i class="fas ${dayConfig.icon}"></i>
            <p class="item-temp">${Math.round(daily.temperature_2m_max[i])}°</p>
        `;
        forecastContainer.appendChild(forecastCard);
    }

    weatherDashboard.classList.remove('hidden');
}

function getBrowserLocation() {
    if (!navigator.geolocation) return alert("Geolocation not supported.");
    toggleLoader(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        try {
            const revGeo = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
            const geoData = await revGeo.json();
            await fetchWeatherData(lat, lon, `${geoData.city || 'Live Position'}, ${geoData.countryName || ''}`);
        } catch {
            await fetchWeatherData(lat, lon, "Live Location");
        }
    }, () => toggleLoader(false));
}

function saveToHistory(city) {
    let history = JSON.parse(localStorage.getItem('weatherHistory')) || [];
    if (!history.includes(city)) {
        history.unshift(city);
        if (history.length > 5) history.pop();
        localStorage.setItem('weatherHistory', JSON.stringify(history));
        renderHistoryTags();
    }
}

function renderHistoryTags() {
    let history = JSON.parse(localStorage.getItem('weatherHistory')) || [];
    recentHistoryContainer.innerHTML = '';
    history.forEach(city => {
        const tag = document.createElement('span');
        tag.className = 'history-tag';
        tag.innerText = city;
        tag.addEventListener('click', () => getCoordinatesByCity(city));
        recentHistoryContainer.appendChild(tag);
    });
}

function toggleLoader(show) {
    if (show) {
        loadingState.classList.remove('hidden');
        weatherDashboard.classList.add('hidden');
    } else {
        loadingState.classList.add('hidden');
    }
}