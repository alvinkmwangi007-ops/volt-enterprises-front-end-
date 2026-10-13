const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api')
  .replace(/\/+$/, '')
const ACCESS_TOKEN_KEY = 'volt-enterprise-access-token'
const REFRESH_TOKEN_KEY = 'volt-enterprise-refresh-token'

export function getAccessToken() {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY)
}

export function saveAuthSession({ access_token: accessToken, refresh_token: refreshToken }) {
  if (!accessToken) throw new Error('The server did not return an access token.')
  sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  if (refreshToken) sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function clearAuthSession() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)
}

async function sendRequest(path, options, token) {
  const headers = new Headers(options.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(`${API_BASE_URL}${path}`, { ...options, headers })
}

export async function apiRequest(path, options = {}) {
  let response
  try {
    response = await sendRequest(path, options, getAccessToken())
  } catch {
    throw new Error('Could not connect to the API. Check that the backend is running.')
  }
  if (response.status === 401 && path !== '/auth/refresh') {
    const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY)
    if (refreshToken) {
      let refreshResponse
      try {
        refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${refreshToken}` },
        })
      } catch {
        throw new Error('Could not connect to the API to refresh your session.')
      }
      if (!refreshResponse.ok) {
        clearAuthSession()
        throw new Error('Your session expired. Please sign in again.')
      }
      const refreshed = await refreshResponse.json()
      sessionStorage.setItem(ACCESS_TOKEN_KEY, refreshed.access_token)
      try {
        response = await sendRequest(path, options, refreshed.access_token)
      } catch {
        throw new Error('Could not connect to the API. Check that the backend is running.')
      }
    }
  }

  if (response.status === 204) return null
  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()
  if (!response.ok) {
    const message = payload && typeof payload === 'object'
      ? payload.error || payload.message
      : payload
    throw new Error(message || `Request failed (${response.status}).`)
  }
  return payload
}

export async function apiDownload(path) {
  const response = await sendRequest(path, {}, getAccessToken())
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error || 'The private document could not be downloaded.')
  }
  return response.blob()
}

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`
}
