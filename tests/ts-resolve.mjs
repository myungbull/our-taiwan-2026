// Test-only resolve hook: app sources use bundler-style extensionless imports ('../../weather-data').
export async function resolve(specifier, context, next) {
  if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier) && context.parentURL?.endsWith('.ts')) {
    try { return await next(specifier + '.ts', context); } catch { /* fall through to the default resolver */ }
  }
  return next(specifier, context);
}
