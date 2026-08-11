// The project uses webpack-style extensionless imports; Node's ESM resolver
// requires them. This hook appends .js when a bare relative specifier misses.
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) {
    if (spec.startsWith('.') && !spec.endsWith('.js')) return next(spec + '.js', ctx);
    throw e;
  }
}
