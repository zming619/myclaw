type TaskExecutionStatus = "succeeded" | "failed" | "needs_clarification"

interface TaskExecutionResult {
  taskType: "weather"
  taskStatus: TaskExecutionStatus
  taskTitle: string
  replyContent: string
  taskInput: Record<string, unknown>
  taskOutput: Record<string, unknown>
  errorMessage: string | null
  startedAt: Date
  finishedAt: Date
}

type DetectedWeatherTask = {
  type: "weather"
  locationQuery: string | null
  dayOffset: number
  dayLabel: string
}

type GeocodingResult = {
  id?: number
  name: string
  country?: string
  country_code?: string
  admin1?: string
  admin2?: string
  timezone?: string
  feature_code?: string
  population?: number
  latitude: number
  longitude: number
}

type ForecastDailyPayload = {
  time: string[]
  weather_code: number[]
  temperature_2m_max: number[]
  temperature_2m_min: number[]
  precipitation_probability_max?: Array<number | null>
}

const weatherKeywordPattern =
  /(天气|气温|温度|下雨|降雨|降水|冷不冷|热不热|会不会下雨|会下雨吗)/

const relativeDayPatterns = [
  { keyword: "大后天", offset: 3, label: "大后天" },
  { keyword: "后天", offset: 2, label: "后天" },
  { keyword: "明天", offset: 1, label: "明天" },
  { keyword: "今天", offset: 0, label: "今天" },
] as const

const weatherCodeLabels: Record<number, string> = {
  0: "晴",
  1: "大部晴朗",
  2: "多云",
  3: "阴",
  45: "有雾",
  48: "雾凇",
  51: "毛毛雨",
  53: "小毛毛雨",
  55: "中毛毛雨",
  56: "冻毛毛雨",
  57: "强冻毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  66: "冻雨",
  67: "强冻雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  77: "雪粒",
  80: "小阵雨",
  81: "中阵雨",
  82: "强阵雨",
  85: "小阵雪",
  86: "强阵雪",
  95: "雷阵雨",
  96: "弱冰雹雷暴",
  99: "强冰雹雷暴",
}

function normalizeWeatherQuery(message: string) {
  return message.replace(/[？?！!，,。.；;：:\s]/g, "").trim()
}

function detectRelativeDay(message: string) {
  for (const item of relativeDayPatterns) {
    if (message.includes(item.keyword)) {
      return { dayOffset: item.offset, dayLabel: item.label }
    }
  }

  return { dayOffset: 0, dayLabel: "今天" }
}

function cleanLocationCandidate(value: string) {
  return value
    .replace(/(今天|明天|后天|大后天)/g, "")
    .replace(/(帮我查查|帮我查|查一下|查查|请问|想问下|想问|一下|一下子|天气|气温|温度|会不会下雨|会下雨吗|下雨|降雨|降水|冷不冷|热不热|怎么样|咋样|如何|呢|呀|啊|吧)/g, "")
    .trim()
}

function extractLocationQuery(message: string): string | null {
  const normalized = normalizeWeatherQuery(message)
  const patterns = [
    /(?:今天|明天|后天|大后天)?([A-Za-z\u4e00-\u9fa5]{2,20}?)(?:的)?(?:天气|气温|温度|会不会下雨|会下雨吗|下雨|降雨|降水|冷不冷|热不热)/,
    /([A-Za-z\u4e00-\u9fa5]{2,20}?)(?:今天|明天|后天|大后天)(?:的)?(?:天气|气温|温度|会不会下雨|会下雨吗|下雨|降雨|降水|冷不冷|热不热)/,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    const candidate = cleanLocationCandidate(match?.[1] ?? "")
    if (candidate.length >= 2) {
      return candidate
    }
  }

  const tokenMatches = normalized.match(/[A-Za-z\u4e00-\u9fa5]{2,20}/g) ?? []
  for (const token of tokenMatches) {
    const candidate = cleanLocationCandidate(token)
    if (
      candidate.length >= 2 &&
      !weatherKeywordPattern.test(candidate) &&
      !relativeDayPatterns.some((item) => candidate.includes(item.keyword))
    ) {
      return candidate
    }
  }

  return null
}

function detectWeatherTask(message: string): DetectedWeatherTask | null {
  if (!weatherKeywordPattern.test(message)) {
    return null
  }

  const { dayOffset, dayLabel } = detectRelativeDay(message)

  return {
    type: "weather",
    locationQuery: extractLocationQuery(message),
    dayOffset,
    dayLabel,
  }
}

function buildLocationLabel(location: GeocodingResult) {
  const admin1 =
    location.admin1 &&
    (location.admin1 === location.name || `${location.admin1}市` === location.name)
      ? null
      : location.admin1
  const regionParts = [admin1, location.country].filter(Boolean)
  return regionParts.length ? `${location.name}（${regionParts.join(" / ")}）` : location.name
}

function formatForecastDate(date: string, timezone: string) {
  const parsed = new Date(`${date}T12:00:00`)
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(parsed)
}

function resolveWeatherLabel(code: number | null | undefined) {
  if (typeof code !== "number") {
    return "天气未知"
  }

  return weatherCodeLabels[code] ?? `天气代码 ${code}`
}

async function geocodeLocation(locationQuery: string): Promise<GeocodingResult | null> {
  const normalizedQuery = locationQuery.trim().toLowerCase()
  const normalizedQueryWithoutCitySuffix = normalizedQuery.replace(/市$/u, "")
  const queryVariants = Array.from(
    new Set(
      [
        locationQuery.trim(),
        /市$/u.test(locationQuery.trim()) ? null : `${locationQuery.trim()}市`,
      ].filter((item): item is string => Boolean(item))
    )
  )

  const candidates: GeocodingResult[] = []

  for (const queryVariant of queryVariants) {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search")
    url.searchParams.set("name", queryVariant)
    url.searchParams.set("count", "10")
    url.searchParams.set("language", "zh")
    url.searchParams.set("format", "json")

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      throw new Error("天气地理编码接口调用失败。")
    }

    const payload = (await response.json()) as {
      results?: GeocodingResult[]
    }

    candidates.push(...(payload.results ?? []))
  }

  if (!candidates.length) {
    return null
  }

  const uniqueCandidates = Array.from(
    new Map(
      candidates.map((candidate) => [
        `${candidate.id ?? "na"}:${candidate.latitude}:${candidate.longitude}`,
        candidate,
      ])
    ).values()
  )

  const featureScoreMap: Record<string, number> = {
    PPLC: 300,
    PPLA: 250,
    PPLA2: 240,
    PPLA3: 230,
    PPLA4: 220,
    PPLG: 210,
    PPL: 200,
  }

  uniqueCandidates.sort((left, right) => {
    const leftName = left.name.toLowerCase()
    const rightName = right.name.toLowerCase()
    const leftAdmin1 = (left.admin1 ?? "").toLowerCase()
    const rightAdmin1 = (right.admin1 ?? "").toLowerCase()
    const leftExact =
      leftName === normalizedQuery ||
      leftName === `${normalizedQueryWithoutCitySuffix}市` ||
      leftAdmin1 === normalizedQuery ||
      leftAdmin1 === `${normalizedQueryWithoutCitySuffix}市`
    const rightExact =
      rightName === normalizedQuery ||
      rightName === `${normalizedQueryWithoutCitySuffix}市` ||
      rightAdmin1 === normalizedQuery ||
      rightAdmin1 === `${normalizedQueryWithoutCitySuffix}市`

    if (leftExact !== rightExact) {
      return leftExact ? -1 : 1
    }

    const leftCountryScore = left.country_code === "CN" ? 1 : 0
    const rightCountryScore = right.country_code === "CN" ? 1 : 0
    if (leftCountryScore !== rightCountryScore) {
      return rightCountryScore - leftCountryScore
    }

    const leftFeatureScore = featureScoreMap[left.feature_code ?? ""] ?? 0
    const rightFeatureScore = featureScoreMap[right.feature_code ?? ""] ?? 0
    if (leftFeatureScore !== rightFeatureScore) {
      return rightFeatureScore - leftFeatureScore
    }

    const leftPopulation = left.population ?? 0
    const rightPopulation = right.population ?? 0
    if (leftPopulation !== rightPopulation) {
      return rightPopulation - leftPopulation
    }

    return 0
  })

  return uniqueCandidates[0] ?? null
}

async function fetchDailyForecast(location: GeocodingResult, dayOffset: number) {
  const timezone = location.timezone || "Asia/Shanghai"
  const url = new URL("https://api.open-meteo.com/v1/forecast")
  url.searchParams.set("latitude", String(location.latitude))
  url.searchParams.set("longitude", String(location.longitude))
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
  )
  url.searchParams.set("forecast_days", String(Math.max(dayOffset + 2, 4)))
  url.searchParams.set("timezone", timezone)

  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    throw new Error("天气预报接口调用失败。")
  }

  const payload = (await response.json()) as {
    timezone?: string
    daily?: ForecastDailyPayload
  }

  if (!payload.daily?.time?.length) {
    throw new Error("天气预报接口未返回可用的日级数据。")
  }

  const index = Math.min(dayOffset, payload.daily.time.length - 1)

  return {
    timezone: payload.timezone || timezone,
    date: payload.daily.time[index],
    weatherCode: payload.daily.weather_code[index] ?? null,
    temperatureMax: payload.daily.temperature_2m_max[index] ?? null,
    temperatureMin: payload.daily.temperature_2m_min[index] ?? null,
    precipitationProbabilityMax:
      payload.daily.precipitation_probability_max?.[index] ?? null,
  }
}

function buildWeatherReply(input: {
  location: GeocodingResult
  dayLabel: string
  timezone: string
  date: string
  weatherCode: number | null
  temperatureMax: number | null
  temperatureMin: number | null
  precipitationProbabilityMax: number | null
}) {
  const weatherLabel = resolveWeatherLabel(input.weatherCode)
  const temperatureText =
    typeof input.temperatureMin === "number" && typeof input.temperatureMax === "number"
      ? `${Math.round(input.temperatureMin)}°C ~ ${Math.round(input.temperatureMax)}°C`
      : "温度数据暂缺"
  const precipitationText =
    typeof input.precipitationProbabilityMax === "number"
      ? `，降水概率约 ${Math.round(input.precipitationProbabilityMax)}%`
      : ""

  return `${buildLocationLabel(input.location)}${input.dayLabel}（${formatForecastDate(
    input.date,
    input.timezone
  )}）天气：${weatherLabel}，气温 ${temperatureText}${precipitationText}。`
}

export async function tryExecuteAutoReplyTask(
  message: string
): Promise<TaskExecutionResult | null> {
  const detectedTask = detectWeatherTask(message)

  if (!detectedTask) {
    return null
  }

  const startedAt = new Date()
  const taskTitle = "天气查询"

  if (!detectedTask.locationQuery) {
    const finishedAt = new Date()
    return {
      taskType: "weather",
      taskStatus: "needs_clarification",
      taskTitle,
      replyContent: "可以，我能帮你查天气。你直接发“明天北京天气怎么样”这种格式就行。",
      taskInput: {
        message,
        dayLabel: detectedTask.dayLabel,
      },
      taskOutput: {},
      errorMessage: "未能从消息中识别出城市名。",
      startedAt,
      finishedAt,
    }
  }

  try {
    const location = await geocodeLocation(detectedTask.locationQuery)
    if (!location) {
      const finishedAt = new Date()
      return {
        taskType: "weather",
        taskStatus: "failed",
        taskTitle,
        replyContent: `我刚刚没查到“${detectedTask.locationQuery}”这个地点的天气，麻烦换一个更完整的城市名试试。`,
        taskInput: {
          message,
          locationQuery: detectedTask.locationQuery,
          dayLabel: detectedTask.dayLabel,
        },
        taskOutput: {},
        errorMessage: "地理编码接口未返回匹配地点。",
        startedAt,
        finishedAt,
      }
    }

    const forecast = await fetchDailyForecast(location, detectedTask.dayOffset)
    const replyContent = buildWeatherReply({
      location,
      dayLabel: detectedTask.dayLabel,
      timezone: forecast.timezone,
      date: forecast.date,
      weatherCode: forecast.weatherCode,
      temperatureMax: forecast.temperatureMax,
      temperatureMin: forecast.temperatureMin,
      precipitationProbabilityMax: forecast.precipitationProbabilityMax,
    })
    const finishedAt = new Date()

    return {
      taskType: "weather",
      taskStatus: "succeeded",
      taskTitle,
      replyContent,
      taskInput: {
        message,
        locationQuery: detectedTask.locationQuery,
        dayLabel: detectedTask.dayLabel,
        dayOffset: detectedTask.dayOffset,
      },
      taskOutput: {
        location: {
          name: location.name,
          admin1: location.admin1 ?? null,
          country: location.country ?? null,
          latitude: location.latitude,
          longitude: location.longitude,
          timezone: location.timezone ?? null,
        },
        forecast,
      },
      errorMessage: null,
      startedAt,
      finishedAt,
    }
  } catch (error) {
    const finishedAt = new Date()
    return {
      taskType: "weather",
      taskStatus: "failed",
      taskTitle,
      replyContent: `我刚刚查询“${detectedTask.locationQuery}”的天气时遇到接口波动，麻烦稍后再试一次。`,
      taskInput: {
        message,
        locationQuery: detectedTask.locationQuery,
        dayLabel: detectedTask.dayLabel,
        dayOffset: detectedTask.dayOffset,
      },
      taskOutput: {},
      errorMessage:
        error instanceof Error ? error.message : "天气任务执行失败，原因未知。",
      startedAt,
      finishedAt,
    }
  }
}
