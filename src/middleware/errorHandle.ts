export default () => async (ctx: any, next: any) => {
  try {
    await next();
  } catch (error) {
    ctx.status = error.status || 400;
    ctx.body = { msg: error.toString() };
  }
};
