import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { getAllStationIds } from "./metadata.js";

const execFileAsync = promisify(execFile);

const ASOS_ENDPOINT =
  "https://apis.data.go.kr/1360000/AsosDalyInfoService/getWthrDataList";

function formatDate(year, month, day) {
  return `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

function normalizeServiceKey(serviceKey) {
  try {
    return decodeURIComponent(serviceKey);
  } catch {
    return serviceKey;
  }
}

function getLatestAvailableDate() {
  const current = new Date();
  current.setDate(current.getDate() - 1);
  return formatDate(
    current.getFullYear(),
    current.getMonth() + 1,
    current.getDate(),
  );
}

function clampWindowEndDate(endDate, latestAvailableDate) {
  return endDate > latestAvailableDate ? latestAvailableDate : endDate;
}

function chunkIntoTenYearWindows(startYear, endYear, latestAvailableDate) {
  const windows = [];

  for (let year = startYear; year <= endYear; year += 10) {
    const windowEndYear = Math.min(year + 9, endYear);
    windows.push({
      startDate: formatDate(year, 1, 1),
      endDate: clampWindowEndDate(
        formatDate(windowEndYear, 12, 31),
        latestAvailableDate,
      ),
    });
  }

  return windows.filter((window) => window.startDate <= window.endDate);
}

function unwrapItems(payload) {
  const root = payload?.response ?? payload;
  const items = root?.body?.items?.item ?? root?.body?.items ?? [];
  return Array.isArray(items) ? items : [items];
}

async function requestJsonWithFetch(url, fetchImpl) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`ASOS request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function requestJsonWithCurl(url) {
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const { stdout } = await execFileAsync("curl.exe", [
        "--ssl-no-revoke",
        "-sS",
        String(url),
      ], {
        maxBuffer: 64 * 1024 * 1024,
      });
      return JSON.parse(stdout);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function requestJson(url, { fetchImpl, requestJsonImpl }) {
  if (requestJsonImpl) {
    return requestJsonImpl(url);
  }

  try {
    return await requestJsonWithFetch(url, fetchImpl);
  } catch (error) {
    return requestJsonWithCurl(url);
  }
}

async function fetchStationWindow({
  fetchImpl,
  requestJsonImpl,
  serviceKey,
  stationId,
  startDate,
  endDate,
}) {
  const rows = [];
  let pageNo = 1;

  while (true) {
    const url = new URL(ASOS_ENDPOINT);
    url.search = new URLSearchParams({
      serviceKey: normalizeServiceKey(serviceKey),
      pageNo: String(pageNo),
      numOfRows: "999",
      dataType: "JSON",
      dataCd: "ASOS",
      dateCd: "DAY",
      startDt: startDate,
      endDt: endDate,
      stnIds: String(stationId),
    }).toString();

    const payload = await requestJson(url, {
      fetchImpl,
      requestJsonImpl,
    });
    const items = unwrapItems(payload);
    if (items.length === 0) {
      break;
    }

    rows.push(
      ...items.map((item) => ({
        station_id: Number(item.stnId),
        station_name: item.stnNm,
        date: item.tm,
        tavg: item.avgTa,
        tmin: item.minTa,
        tmax: item.maxTa,
        precip: item.sumRn,
      })),
    );

    if (items.length < 999) {
      break;
    }

    pageNo += 1;
  }

  return rows;
}

export async function fetchAllAsosDailyRows({
  serviceKey,
  startYear = 1973,
  endYear = new Date().getFullYear(),
  stationIds = getAllStationIds(),
  fetchImpl = fetch,
  requestJsonImpl = null,
  latestAvailableDate = getLatestAvailableDate(),
}) {
  const allRows = [];
  const windows = chunkIntoTenYearWindows(startYear, endYear, latestAvailableDate);

  for (const stationId of stationIds) {
    for (const window of windows) {
      const rows = await fetchStationWindow({
        fetchImpl,
        requestJsonImpl,
        serviceKey,
        stationId,
        startDate: window.startDate,
        endDate: window.endDate,
      });
      allRows.push(...rows);
    }
  }

  return allRows.sort(
    (left, right) =>
      left.station_id - right.station_id || left.date.localeCompare(right.date),
  );
}
