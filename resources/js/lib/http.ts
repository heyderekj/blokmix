/** Laravel's CSRF token, from the XSRF-TOKEN cookie it sets, for requests the page makes itself. */
export function xsrf(): Record<string, string> {
  if (typeof document === 'undefined') return {}
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
  return m ? { 'X-XSRF-TOKEN': decodeURIComponent(m[1]) } : {}
}
