import { defineMiddleware } from 'astro:middleware';

const PRIVATE_PATH = /^\/dashboard(?:\/|$)/;
const AUTH_ENTRY_PATH = /^\/login(?:\/|$)/;
const NOINDEX_PATH = /^(?:\/dashboard|\/login)(?:\/|$)/;

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = new URL(context.request.url).pathname;

  if (PRIVATE_PATH.test(pathname) || AUTH_ENTRY_PATH.test(pathname)) {
    const sessionResponse = await fetch(new URL('/api/auth/session', context.request.url), {
      headers: { cookie: context.request.headers.get('cookie') || '' }
    }).catch(() => null);
    if (!sessionResponse?.ok) {
      if (PRIVATE_PATH.test(pathname)) {
        const returnTo = `${pathname}${new URL(context.request.url).search}`;
        return Response.redirect(new URL(`/login?returnTo=${encodeURIComponent(returnTo)}`, context.request.url), 302);
      }
    } else if (AUTH_ENTRY_PATH.test(pathname)) {
      return Response.redirect(new URL('/dashboard', context.request.url), 302);
    }
  }

  return next().then(response => {
    if (NOINDEX_PATH.test(pathname)) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  });
});
