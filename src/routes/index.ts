import { SwaggerRouter } from "koa-swagger-decorator";

const koaRouterOpts = { prefix: "" };
const swaggerRouterOpts = {
  title: "Sensible Utils API",
  description: "API DOC",
  version: "1.0.0",
};
const router = new SwaggerRouter(koaRouterOpts, swaggerRouterOpts);

// swagger docs avaliable at http://localhost:3000/swagger-html
router.swagger();

router.mapDir(__dirname);

export default router;
