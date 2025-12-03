// services/weather.service.ts
import axios from "axios";

export async function getWeather(location: string) {
  const API_KEY = process.env.OPENWEATHER_KEY;

  if (!API_KEY) {
    return { error: "Falta la API KEY del clima." };
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
    location
  )}&appid=${API_KEY}&units=metric&lang=es`;

  const res = await axios.get(url);
  const data = res.data;

  return {
    location,
    temperature: `${data.main.temp}°C`,
    description: data.weather[0].description,
    humidity: `${data.main.humidity}%`,
  };
}
